import { Router, type IRouter } from "express";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  db,
  registrationsTable,
  paymentTransactionsTable,
  refundRequestsTable,
} from "@workspace/db";
import { invoicesTable } from "@workspace/db";
import { requireRole } from "../middlewares/authMiddleware";
import { logger } from "../lib/logger";
import { sendRefundBankInfoEmail, sendRefundNotifyEmail, sendRefundedNotifyEmail } from "../services/email-service";
import { voidInvoice } from "../lib/ecpay-invoice";

const router: IRouter = Router();

const EVENT_DATES = new Set(["2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26"]);

// 訂單總人頭數。combo 訂單的多個日期 legs 是同一批人（共用同一個 qrToken），
// 因此以 qrToken 分組後取每組的最大 ticketCount 相加。
function orderTotalHeads(regs: Array<{ qrToken: string | null; ticketCount: number }>): number {
  const byToken = new Map<string, number>();
  let noToken = 0;
  for (const r of regs) {
    if (r.qrToken) {
      byToken.set(r.qrToken, Math.max(byToken.get(r.qrToken) ?? 0, r.ticketCount));
    } else {
      noToken += r.ticketCount;
    }
  }
  let sum = noToken;
  for (const v of byToken.values()) sum += v;
  return sum;
}

// 訂單目前有效（未退款）票券的實付金額。部分退票核准後，承載金額的 leg 會被
// 扣減，因此退款計算必須以 regs 的餘額為準，不能用 payment_transactions 的
// 原始金額（那是最初付款的全額，退過一次後就會偏高）。
function orderRemainingAmount(regs: Array<{ amount: number | null; paymentStatus: string }>): number {
  return regs
    .filter((r) => r.paymentStatus !== "refunded")
    .reduce((s, r) => s + (r.amount ?? 0), 0);
}

// 按張數比例計算退款金額（無條件捨去到整數元；全退時退全額）。
function proRataAmount(orderAmount: number, count: number, totalHeads: number): number {
  if (totalHeads <= 0 || count >= totalHeads) return orderAmount;
  return Math.floor((orderAmount * count) / totalHeads);
}

function normalizeContact(raw: string): { isEmail: boolean; emailLc: string; digits: string } {
  const trimmed = raw.trim();
  return {
    isEmail: trimmed.includes("@"),
    emailLc: trimmed.toLowerCase(),
    digits: trimmed.replace(/\D/g, ""),
  };
}

function contactMatches(reg: { email: string | null; phone: string | null }, contact: ReturnType<typeof normalizeContact>): boolean {
  if (contact.isEmail) {
    return (reg.email || "").toLowerCase() === contact.emailLc;
  }
  return contact.digits.length >= 8 && (reg.phone || "").replace(/\D/g, "") === contact.digits;
}

// ── Public: buyer submits a refund request ─────────────────────────────────
router.post("/refund-requests", async (req, res): Promise<void> => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const ref = typeof body.paymentRef === "string" ? body.paymentRef.trim() : "";
    const contactRaw = typeof body.contact === "string" ? body.contact.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!ref || !contactRaw) {
      res.status(400).json({ error: "請填寫訂單編號與聯絡方式" });
      return;
    }
    if (reason.length < 5 || reason.length > 500) {
      res.status(400).json({ error: "請填寫退票原因（5~500 字）" });
      return;
    }

    const [tx] = await db
      .select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.paymentRef, ref));
    const regs = await db
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.paymentRef, ref));

    if (!tx || regs.length === 0) {
      res.status(404).json({ error: "查無此訂單，請確認訂單編號與聯絡方式是否正確" });
      return;
    }

    const contact = normalizeContact(contactRaw);
    const matched = regs.find((r) => contactMatches(r, contact));
    if (!matched) {
      res.status(404).json({ error: "查無此訂單，請確認訂單編號與聯絡方式是否正確" });
      return;
    }

    const requestedCountRaw = body.ticketCount;

    // Eligibility checks + duplicate guard + insert all run in one transaction
    // under a per-order advisory lock, with the registrations re-read FOR
    // UPDATE inside the lock. This prevents both (a) two concurrent
    // submissions passing the duplicate check, and (b) a concurrent approval
    // fully refunding the order between the eligibility check and the insert.
    const outcome = await db.transaction(async (txn) => {
      await txn.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`refund:${ref}`}))`);
      const lockedRegs = await txn
        .select()
        .from(registrationsTable)
        .where(eq(registrationsTable.paymentRef, ref))
        .for("update");
      if (lockedRegs.every((r) => r.paymentStatus === "refunded")) {
        return { error: { status: 400, message: "此訂單已退款，無法再次申請" } };
      }
      if (lockedRegs.some((r) => r.checkedInAt)) {
        return { error: { status: 400, message: "已入場的票券無法退票，請聯絡客服" } };
      }

      // 訂單總人頭數：combo 兩天的 legs 是同一批人（共用 qrToken），只算一次。
      const totalHeads = orderTotalHeads(lockedRegs);
      // 申請退票張數：預設整筆全退；可指定 1..totalHeads。
      let refundCount = totalHeads;
      if (requestedCountRaw !== undefined && requestedCountRaw !== null) {
        const n = Number(requestedCountRaw);
        if (!Number.isInteger(n) || n < 1 || n > totalHeads) {
          return { error: { status: 400, message: `退票張數需為 1 到 ${totalHeads} 之間的整數` } };
        }
        refundCount = n;
      }
      const refundAmount = proRataAmount(orderRemainingAmount(lockedRegs), refundCount, totalHeads);

      const [existing] = await txn
        .select({ id: refundRequestsTable.id })
        .from(refundRequestsTable)
        .where(
          and(
            eq(refundRequestsTable.paymentRef, ref),
            // 只擋「待處理」。已核准的整筆全退訂單會被上面的「此訂單已退款」
            // 檢查擋下；部分退票核准後，買家仍可再申請退剩餘的票。
            sql`${refundRequestsTable.status} = 'pending'`,
          ),
        )
        .limit(1);
      if (existing) {
        return { error: { status: 409, message: "此訂單已有處理中的退票申請，請耐心等候或來電查詢" } };
      }
      const [created] = await txn
        .insert(refundRequestsTable)
        .values({
          paymentRef: ref,
          buyerName: matched.parentName,
          buyerContact: contactRaw,
          reason,
          status: "pending",
          refundAmount,
          refundTicketCount: refundCount,
        })
        .returning({ id: refundRequestsTable.id });
      return { created };
    });
    if ("error" in outcome && outcome.error) {
      res.status(outcome.error.status).json({ error: outcome.error.message });
      return;
    }
    const created = (outcome as { created: { id: number } }).created;

    logger.info({ refundId: created.id, paymentRef: ref }, "[refund] new request submitted");

    // Fire-and-forget: email the buyer a tokenized link to the refund
    // bank-info form. Failures are logged (admins can resend from the
    // back-office) and never block the request submission itself.
    void sendRefundBankInfoEmail(created.id)
      .then((r) => {
        if (!r.delivered) {
          logger.warn({ refundId: created.id, message: r.message }, "[refund] bank-info email not delivered");
        }
      })
      .catch((err) => logger.error({ err, refundId: created.id }, "[refund] bank-info email error"));

    res.status(201).json({ id: created.id, status: "pending", message: "已收到您的退票申請，我們已寄出退款資料表單 Email，請依信件指示填寫退款帳戶資訊；提交後退款需要 7 到 14 個工作天。" });
  } catch (err) {
    logger.error({ err }, "[refund] submit error");
    res.status(500).json({ error: "申請失敗，請稍後再試" });
  }
});

// ── Public: check a buyer's outstanding refund request status (used by /lookup)
// Returns only status-level fields. The user-submitted `reason` is intentionally
// omitted because this endpoint is unauthenticated — anyone who happens to know
// a payment_ref shouldn't be able to read the buyer's free-form note. The buyer
// already typed the reason themselves; admin staff can see it in the back-office.
router.get("/refund-requests/by-ref/:ref", async (req, res): Promise<void> => {
  const ref = req.params.ref?.trim();
  if (!ref) { res.status(400).json({ error: "missing ref" }); return; }
  const rows = await db
    .select({
      id: refundRequestsTable.id,
      status: refundRequestsTable.status,
      adminNote: refundRequestsTable.adminNote,
      processedAt: refundRequestsTable.processedAt,
      createdAt: refundRequestsTable.createdAt,
    })
    .from(refundRequestsTable)
    .where(eq(refundRequestsTable.paymentRef, ref))
    .orderBy(desc(refundRequestsTable.createdAt))
    .limit(5);
  res.json(rows);
});

// ── Public: refund bank-info form (tokenized link from the email) ─────────
router.get("/refund-info/:token", async (req, res): Promise<void> => {
  const token = req.params.token?.trim();
  if (!token || token.length < 16) { res.status(400).json({ error: "無效的連結" }); return; }
  const [request] = await db
    .select({
      id: refundRequestsTable.id,
      paymentRef: refundRequestsTable.paymentRef,
      buyerName: refundRequestsTable.buyerName,
      status: refundRequestsTable.status,
      refundAmount: refundRequestsTable.refundAmount,
      bankInfoSubmittedAt: refundRequestsTable.bankInfoSubmittedAt,
      createdAt: refundRequestsTable.createdAt,
    })
    .from(refundRequestsTable)
    .where(eq(refundRequestsTable.bankInfoToken, token))
    .limit(1);
  if (!request) { res.status(404).json({ error: "連結無效或已失效，請聯絡客服" }); return; }
  res.json(request);
});

router.post("/refund-info/:token", async (req, res): Promise<void> => {
  try {
    const token = req.params.token?.trim();
    if (!token || token.length < 16) { res.status(400).json({ error: "無效的連結" }); return; }
    const [request] = await db
      .select()
      .from(refundRequestsTable)
      .where(eq(refundRequestsTable.bankInfoToken, token))
      .limit(1);
    if (!request) { res.status(404).json({ error: "連結無效或已失效，請聯絡客服" }); return; }
    if (request.status === "rejected" || request.status === "rescheduled") {
      res.status(400).json({ error: "此退票申請已結案，如有疑問請聯絡客服" });
      return;
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const field = (key: string, label: string, max: number): string | null => {
      const v = typeof body[key] === "string" ? body[key].trim() : "";
      if (!v) { res.status(400).json({ error: `請填寫${label}` }); return null; }
      if (v.length > max) { res.status(400).json({ error: `${label}長度過長` }); return null; }
      return v;
    };
    const formPurchaseInfo = field("purchaseInfo", "購買的時間、日期", 200); if (formPurchaseInfo === null) return;
    const formName = field("name", "姓名", 100); if (formName === null) return;
    const formPhone = field("phone", "電話／手機", 50); if (formPhone === null) return;
    const bankName = field("bankName", "銀行名稱", 100); if (bankName === null) return;
    const bankBranch = field("bankBranch", "分行", 100); if (bankBranch === null) return;
    const bankAccountName = field("bankAccountName", "戶名", 100); if (bankAccountName === null) return;
    const bankAccountNumber = field("bankAccountNumber", "帳號", 30); if (bankAccountNumber === null) return;
    if (!/^[0-9-]{6,30}$/.test(bankAccountNumber)) {
      res.status(400).json({ error: "帳號格式錯誤，請輸入 6~30 位數字" });
      return;
    }

    await db
      .update(refundRequestsTable)
      .set({
        formPurchaseInfo,
        formName,
        formPhone,
        bankName,
        bankBranch,
        bankAccountName,
        bankAccountNumber,
        bankInfoSubmittedAt: new Date(),
      })
      .where(eq(refundRequestsTable.id, request.id));

    logger.info({ refundId: request.id }, "[refund] bank info submitted");
    res.json({
      ok: true,
      message: "已收到您的退款帳戶資料，我們將統一進行退款作業。退款需要 7 到 14 個工作天，敬請耐心等候。",
    });
  } catch (err) {
    logger.error({ err }, "[refund] bank info submit error");
    res.status(500).json({ error: "提交失敗，請稍後再試" });
  }
});

// ── Admin: (re)send the refund bank-info email ─────────────────────────────
router.post(
  "/admin/refund-requests/:id/resend-bank-email",
  requireRole("editor"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
    try {
      const result = await sendRefundBankInfoEmail(id);
      if (!result.delivered) {
        res.status(400).json({ error: result.message || "寄送失敗" });
        return;
      }
      logger.info({ id }, "[refund] bank-info email resent by admin");
      res.json({ ok: true, message: result.message });
    } catch (err) {
      logger.error({ err, id }, "[refund] resend bank-info email error");
      res.status(500).json({ error: "寄送失敗，請稍後再試" });
    }
  },
);

// ── Admin: list ────────────────────────────────────────────────────────────
router.get(
  "/admin/refund-requests",
  requireRole("editor", "viewer", "checkin"),
  async (req, res): Promise<void> => {
    try {
      const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;
      const rows = statusFilter
        ? await db
            .select()
            .from(refundRequestsTable)
            .where(eq(refundRequestsTable.status, statusFilter))
            .orderBy(desc(refundRequestsTable.createdAt))
        : await db
            .select()
            .from(refundRequestsTable)
            .orderBy(desc(refundRequestsTable.createdAt));
      res.json(rows.map((r) => redactBankFields(r, req.hasRole("editor"))));
    } catch (err) {
      logger.error({ err }, "[refund] admin list error");
      res.status(500).json({ error: "Failed to load refund requests" });
    }
  },
);

// ── Admin: CSV export ──────────────────────────────────────────────────────
// Includes bank-account PII, so this is editor-only (viewer/checkin cannot
// bypass redaction via export).
const REFUND_STATUS_LABELS: Record<string, string> = {
  pending: "待處理",
  approved: "退票成功",
  rejected: "已拒絕",
  rescheduled: "已改期",
};
router.get(
  "/admin/refund-requests/export",
  requireRole("editor"),
  async (req, res): Promise<void> => {
    try {
      const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;
      const rows = statusFilter
        ? await db
            .select()
            .from(refundRequestsTable)
            .where(eq(refundRequestsTable.status, statusFilter))
            .orderBy(desc(refundRequestsTable.createdAt))
        : await db
            .select()
            .from(refundRequestsTable)
            .orderBy(desc(refundRequestsTable.createdAt));

      // CSV-quote and neutralize formula injection: values starting with
      // = + - @ (after optional whitespace) get a leading ' so spreadsheet
      // apps treat them as text, not formulas.
      const escape = (v: unknown) => {
        let s = String(v ?? "");
        if (/^\s*[=+\-@]/.test(s)) s = `'${s}`;
        return `"${s.replace(/"/g, '""')}"`;
      };
      const header =
        "ID,訂單編號,購票人姓名,聯絡方式,退票原因,狀態,退票金額(元),表單購買資訊,表單姓名,表單電話,銀行名稱,分行,戶名,帳號,銀行資料提交時間,表單信寄出時間,通知信寄出時間,管理備註,處理人,處理時間,申請時間\n";
      const csvRows = rows.map((r) =>
        [
          r.id,
          escape(r.paymentRef),
          escape(r.buyerName),
          escape(r.buyerContact),
          escape(r.reason),
          escape(REFUND_STATUS_LABELS[r.status] ?? r.status),
          r.refundAmount ?? "",
          escape(r.formPurchaseInfo),
          escape(r.formName),
          escape(r.formPhone),
          escape(r.bankName),
          escape(r.bankBranch),
          escape(r.bankAccountName),
          escape(r.bankAccountNumber),
          r.bankInfoSubmittedAt ? r.bankInfoSubmittedAt.toISOString() : "",
          r.bankInfoEmailSentAt ? r.bankInfoEmailSentAt.toISOString() : "",
          r.notifyEmailSentAt ? r.notifyEmailSentAt.toISOString() : "",
          escape(r.adminNote),
          escape(r.processedBy),
          r.processedAt ? r.processedAt.toISOString() : "",
          r.createdAt.toISOString(),
        ].join(","),
      );
      const csv = header + csvRows.join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=refund-requests.csv");
      res.send("\uFEFF" + csv);
    } catch (err) {
      logger.error({ err }, "[refund] admin export error");
      res.status(500).json({ error: "匯出失敗" });
    }
  },
);

// Bank-account details are sensitive financial PII: only editors (and owner)
// may read them. Viewer/checkin staff still see the request itself, plus
// whether the buyer has submitted their bank info, but not the values.
function redactBankFields<T extends Record<string, unknown>>(row: T, canReadBank: boolean): T {
  if (canReadBank) return row;
  return {
    ...row,
    formPurchaseInfo: null,
    formName: null,
    formPhone: null,
    bankName: null,
    bankBranch: null,
    bankAccountName: null,
    bankAccountNumber: null,
    bankInfoToken: null,
  };
}

// Helper: load a request + its order regs
async function loadRequestWithRegs(id: number) {
  const [request] = await db.select().from(refundRequestsTable).where(eq(refundRequestsTable.id, id));
  if (!request) return null;
  const regs = await db
    .select()
    .from(registrationsTable)
    .where(eq(registrationsTable.paymentRef, request.paymentRef));
  return { request, regs };
}

// ── Approve helper (shared by single + bulk endpoints) ─────────────────────
// Marks the request approved, flags all order registrations as refunded
// (releases inventory), voids the payment transaction, and best-effort voids
// the issued e-invoice via ECPay. The external invoice call runs OUTSIDE the
// DB transaction; its outcome is reported back (never silently swallowed).
async function approveRefundRequest(
  id: number,
  opts: { adminNote?: string; refundAmount?: number; userId: string | null },
): Promise<
  | { ok: true; invoiceVoid: { attempted: boolean; success: boolean; message: string } }
  | { ok: false; status: number; error: string }
> {
  const result = await db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(refundRequestsTable)
      .where(eq(refundRequestsTable.id, id))
      .for("update");
    if (!request) return { ok: false as const, status: 404, error: "找不到此退票申請" };
    if (request.status !== "pending") {
      return { ok: false as const, status: 400, error: `此申請已處於「${request.status}」狀態，無法重複處理` };
    }

    const regs = await tx
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.paymentRef, request.paymentRef))
      .for("update");
    const totalHeads = orderTotalHeads(regs);
    const requestedCount = request.refundTicketCount ?? totalHeads;
    const isPartial = totalHeads > 0 && requestedCount < totalHeads;

    if (isPartial) {
      // 部分退票：從各張 QR（票券）依序扣掉退票人數，票券本身保持有效。
      // 已入場人數是下限，不能退到比已入場還少。
      const byToken = new Map<string, typeof regs>();
      for (const r of regs) {
        const key = r.qrToken ?? `id:${r.id}`;
        const arr = byToken.get(key) ?? [];
        arr.push(r);
        byToken.set(key, arr);
      }
      // 先在記憶體算好每張票要扣多少，確認可行才寫入（避免半途發現不夠退）。
      const planned: Array<{ legs: typeof regs; newCount: number }> = [];
      let remaining = requestedCount;
      for (const legs of byToken.values()) {
        if (remaining <= 0) break;
        const heads = Math.max(...legs.map((l) => l.ticketCount));
        const checkedFloor = Math.max(...legs.map((l) => l.checkedInCount ?? 0));
        const reducible = Math.max(0, heads - checkedFloor);
        const take = Math.min(remaining, reducible);
        if (take <= 0) continue;
        planned.push({ legs, newCount: heads - take });
        remaining -= take;
      }
      if (remaining > 0) {
        return { ok: false as const, status: 400, error: "退票張數超過可退數量（可能已有票入場），請調整張數" };
      }
      for (const { legs, newCount } of planned) {
        for (const leg of legs) {
          if (newCount === 0) {
            await tx
              .update(registrationsTable)
              .set({ paymentStatus: "refunded" })
              .where(eq(registrationsTable.id, leg.id));
          } else {
            await tx
              .update(registrationsTable)
              .set({
                ticketCount: newCount,
                childCount: Math.min(leg.childCount ?? 0, newCount),
              })
              .where(eq(registrationsTable.id, leg.id));
          }
        }
      }
      // 從承載金額的 leg 扣掉退款金額，讓營收統計反映部分退票。
      const refundAmt = opts.refundAmount ?? request.refundAmount ?? 0;
      const amountLeg = regs.find((r) => (r.amount ?? 0) > 0);
      if (amountLeg && refundAmt > 0) {
        await tx
          .update(registrationsTable)
          .set({ amount: Math.max(0, (amountLeg.amount ?? 0) - refundAmt) })
          .where(eq(registrationsTable.id, amountLeg.id));
      }
    } else {
      await tx
        .update(registrationsTable)
        .set({ paymentStatus: "refunded" })
        .where(
          and(
            eq(registrationsTable.paymentRef, request.paymentRef),
            sql`${registrationsTable.paymentStatus} <> 'refunded'`,
          ),
        );
      // Void the order's payment transaction record as well.
      await tx
        .update(paymentTransactionsTable)
        .set({ status: "refunded" })
        .where(eq(paymentTransactionsTable.paymentRef, request.paymentRef));
    }

    await tx
      .update(refundRequestsTable)
      .set({
        status: "approved",
        adminNote: opts.adminNote || request.adminNote,
        refundAmount: opts.refundAmount ?? request.refundAmount,
        processedBy: opts.userId,
        processedAt: new Date(),
      })
      .where(eq(refundRequestsTable.id, id));
    return { ok: true as const, paymentRef: request.paymentRef, isPartial };
  });

  if (!result.ok) return result;

  // 部分退票不作廢整張發票（金額不符），提示管理員手動處理折讓/重開。
  if (result.isPartial) {
    logger.info({ id, userId: opts.userId }, "[refund] partial refund approved");
    void sendRefundNotifyEmail(id)
      .then((r) => {
        if (!r.delivered) logger.warn({ id, message: r.message }, "[refund] auto notify email not delivered");
      })
      .catch((err) => logger.error({ err, id }, "[refund] auto notify email error"));
    return {
      ok: true,
      invoiceVoid: { attempted: false, success: false, message: "部分退票：發票未自動作廢，請視情況手動開立折讓或重開發票" },
    };
  }

  // Best-effort: void the issued e-invoice for this order (external ECPay
  // call — cannot be part of the DB transaction). Failure does not roll back
  // the refund; it is surfaced to the admin so they can retry manually.
  const invoiceVoid = { attempted: false, success: false, message: "此訂單沒有已開立的發票" };
  try {
    const [invoice] = await db
      .select()
      .from(invoicesTable)
      .where(and(eq(invoicesTable.paymentRef, result.paymentRef), eq(invoicesTable.status, "issued")))
      .orderBy(desc(invoicesTable.id))
      .limit(1);
    if (invoice?.invoiceNumber && invoice.invoiceDate) {
      invoiceVoid.attempted = true;
      const dateOnly = invoice.invoiceDate.split("+")[0]?.split(" ")[0]?.split("T")[0] ?? invoice.invoiceDate;
      const voidResult = await voidInvoice(invoice.invoiceNumber, dateOnly, "退票退款");
      invoiceVoid.success = voidResult.success;
      invoiceVoid.message = voidResult.success
        ? `發票 ${invoice.invoiceNumber} 已作廢`
        : `發票作廢失敗：${voidResult.message}`;
      if (voidResult.success) {
        await db
          .update(invoicesTable)
          .set({ status: "voided", voidedAt: new Date() })
          .where(eq(invoicesTable.id, invoice.id));
      }
    }
  } catch (err) {
    invoiceVoid.attempted = true;
    invoiceVoid.success = false;
    invoiceVoid.message = "發票作廢失敗，請至發票管理手動作廢";
    logger.error({ err, id }, "[refund] invoice void error");
  }

  logger.info({ id, userId: opts.userId, invoiceVoid }, "[refund] approved");

  // Auto-notify the buyer that the refund was approved. Fire-and-forget:
  // email failure must never roll back or fail the approval itself; the admin
  // UI still shows a manual "寄退票完成通知信" button as the retry path.
  void sendRefundNotifyEmail(id)
    .then((r) => {
      if (!r.delivered) {
        logger.warn({ id, message: r.message }, "[refund] auto notify email not delivered");
      }
    })
    .catch((err) => logger.error({ err, id }, "[refund] auto notify email error"));

  return { ok: true, invoiceVoid };
}

// ── Admin: edit a pending request's refund ticket count / amount ───────────
router.patch(
  "/admin/refund-requests/:id",
  requireRole("editor"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
    try {
      const [request] = await db.select().from(refundRequestsTable).where(eq(refundRequestsTable.id, id));
      if (!request) { res.status(404).json({ error: "找不到此退票申請" }); return; }
      if (request.status !== "pending") {
        res.status(400).json({ error: "只有待處理的申請可以修改" });
        return;
      }

      const regs = await db
        .select()
        .from(registrationsTable)
        .where(eq(registrationsTable.paymentRef, request.paymentRef));
      const totalHeads = orderTotalHeads(regs);

      const updates: { refundTicketCount?: number; refundAmount?: number } = {};
      if (req.body?.refundTicketCount !== undefined) {
        const n = Number(req.body.refundTicketCount);
        if (!Number.isInteger(n) || n < 1 || n > totalHeads) {
          res.status(400).json({ error: `退票張數需為 1 到 ${totalHeads} 之間的整數` });
          return;
        }
        updates.refundTicketCount = n;
        // 改張數時自動按比例重算金額（以訂單目前有效票券的餘額為準，可再另外覆蓋金額）。
        updates.refundAmount = proRataAmount(orderRemainingAmount(regs), n, totalHeads);
      }
      if (typeof req.body?.refundAmount === "number" && Number.isFinite(req.body.refundAmount)) {
        updates.refundAmount = Math.max(0, Math.floor(req.body.refundAmount));
      }
      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: "沒有可更新的欄位" });
        return;
      }

      // Conditional update guards against a concurrent approve/reject between
      // the status check above and this write (TOCTOU): only a still-pending
      // request is mutated, and zero rows updated means the state changed.
      const updated = await db
        .update(refundRequestsTable)
        .set(updates)
        .where(and(eq(refundRequestsTable.id, id), sql`${refundRequestsTable.status} = 'pending'`))
        .returning({ id: refundRequestsTable.id });
      if (updated.length === 0) {
        res.status(409).json({ error: "此申請已被處理，無法修改" });
        return;
      }
      logger.info({ id, updates }, "[refund] request updated by admin");
      res.json({ ok: true, ...updates, totalHeads });
    } catch (err) {
      logger.error({ err, id }, "[refund] admin update error");
      res.status(500).json({ error: "更新失敗，請稍後再試" });
    }
  },
);

// ── Admin: approve refund (releases inventory, voids order + invoice) ──────
router.post(
  "/admin/refund-requests/:id/approve",
  requireRole("editor"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
    const adminNote = typeof req.body?.adminNote === "string" ? req.body.adminNote.trim() : "";
    const refundAmountInput = typeof req.body?.refundAmount === "number" ? Math.max(0, Math.floor(req.body.refundAmount)) : undefined;
    const userId = (req as { user?: { id?: string } }).user?.id ?? null;

    try {
      const result = await approveRefundRequest(id, { adminNote, refundAmount: refundAmountInput, userId });
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({ ok: true, status: "approved", invoiceVoid: result.invoiceVoid });
    } catch (err) {
      logger.error({ err }, "[refund] approve error");
      res.status(500).json({ error: "處理失敗，請稍後再試" });
    }
  },
);

// ── Admin: send the refund-approved notification email ─────────────────────
router.post(
  "/admin/refund-requests/:id/send-notify-email",
  requireRole("editor"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
    try {
      const result = await sendRefundNotifyEmail(id);
      if (!result.delivered) {
        res.status(400).json({ error: result.message || "寄送失敗" });
        return;
      }
      logger.info({ id }, "[refund] notify email sent by admin");
      res.json({ ok: true, message: result.message });
    } catch (err) {
      logger.error({ err, id }, "[refund] send notify email error");
      res.status(500).json({ error: "寄送失敗，請稍後再試" });
    }
  },
);

// ── Admin: send the "money has been transferred" notification email ────────
router.post(
  "/admin/refund-requests/:id/send-refunded-email",
  requireRole("editor"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
    try {
      const result = await sendRefundedNotifyEmail(id);
      if (!result.delivered) {
        res.status(400).json({ error: result.message || "寄送失敗" });
        return;
      }
      logger.info({ id }, "[refund] refunded-notify email sent by admin");
      res.json({ ok: true, message: result.message });
    } catch (err) {
      logger.error({ err, id }, "[refund] send refunded-notify email error");
      res.status(500).json({ error: "寄送失敗，請稍後再試" });
    }
  },
);

// ── Admin: bulk operations ──────────────────────────────────────────────────
// action: approve | reject | send-bank-email | send-notify-email | send-refunded-email
// Processes each id independently and reports per-id results, so one bad row
// never blocks the rest of the batch.
router.post(
  "/admin/refund-requests/bulk",
  requireRole("editor"),
  async (req, res): Promise<void> => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const action = typeof body.action === "string" ? body.action : "";
    const rawIds: unknown[] = Array.isArray(body.ids) ? body.ids : [];
    const ids = [...new Set(rawIds.filter((v): v is number => typeof v === "number" && Number.isFinite(v)))];
    const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim() : "";
    const userId = (req as { user?: { id?: string } }).user?.id ?? null;

    const ACTIONS = new Set(["approve", "reject", "send-bank-email", "send-notify-email", "send-refunded-email"]);
    if (!ACTIONS.has(action)) { res.status(400).json({ error: "無效的批量操作" }); return; }
    if (ids.length === 0 || ids.length > 100) {
      res.status(400).json({ error: "請選擇 1~100 筆申請" });
      return;
    }
    if (action === "reject" && adminNote.length < 3) {
      res.status(400).json({ error: "批量拒絕需填寫原因（至少 3 字）" });
      return;
    }

    const results: { id: number; ok: boolean; message: string }[] = [];
    for (const id of ids) {
      try {
        if (action === "approve") {
          const r = await approveRefundRequest(id, { adminNote, userId });
          results.push(
            r.ok
              ? { id, ok: true, message: r.invoiceVoid.attempted ? r.invoiceVoid.message : "已核准退票" }
              : { id, ok: false, message: r.error },
          );
        } else if (action === "reject") {
          const [updated] = await db
            .update(refundRequestsTable)
            .set({ status: "rejected", adminNote, processedBy: userId, processedAt: new Date() })
            .where(and(eq(refundRequestsTable.id, id), eq(refundRequestsTable.status, "pending")))
            .returning({ id: refundRequestsTable.id });
          results.push(updated ? { id, ok: true, message: "已拒絕" } : { id, ok: false, message: "非待處理狀態，已略過" });
        } else if (action === "send-bank-email") {
          const r = await sendRefundBankInfoEmail(id);
          results.push({ id, ok: r.delivered, message: r.delivered ? "表單信已寄出" : r.message || "寄送失敗" });
        } else if (action === "send-refunded-email") {
          const r = await sendRefundedNotifyEmail(id);
          results.push({ id, ok: r.delivered, message: r.delivered ? "已退款通知已寄出" : r.message || "寄送失敗" });
        } else {
          const r = await sendRefundNotifyEmail(id);
          results.push({ id, ok: r.delivered, message: r.delivered ? "通知信已寄出" : r.message || "寄送失敗" });
        }
      } catch (err) {
        logger.error({ err, id, action }, "[refund] bulk item error");
        results.push({ id, ok: false, message: "處理失敗" });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    logger.info({ action, total: ids.length, succeeded, userId }, "[refund] bulk done");
    res.json({ ok: true, action, total: ids.length, succeeded, failed: ids.length - succeeded, results });
  },
);

// ── Admin: reject refund ───────────────────────────────────────────────────
router.post(
  "/admin/refund-requests/:id/reject",
  requireRole("editor"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
    const adminNote = typeof req.body?.adminNote === "string" ? req.body.adminNote.trim() : "";
    if (adminNote.length < 3) {
      res.status(400).json({ error: "請填寫拒絕原因（至少 3 字）" });
      return;
    }
    const userId = (req as { user?: { id?: string } }).user?.id ?? null;

    try {
      const [updated] = await db
        .update(refundRequestsTable)
        .set({
          status: "rejected",
          adminNote,
          processedBy: userId,
          processedAt: new Date(),
        })
        .where(and(eq(refundRequestsTable.id, id), eq(refundRequestsTable.status, "pending")))
        .returning({ id: refundRequestsTable.id });
      if (!updated) {
        res.status(400).json({ error: "找不到處於待處理狀態的退票申請" });
        return;
      }
      res.json({ ok: true, status: "rejected" });
    } catch (err) {
      logger.error({ err }, "[refund] reject error");
      res.status(500).json({ error: "處理失敗" });
    }
  },
);

// ── Admin: 改票 — change a registration's event_date with capacity check ──
router.put(
  "/admin/registrations/:id/event-date",
  requireRole("editor"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
    const newDate = typeof req.body?.eventDate === "string" ? req.body.eventDate.trim() : "";
    const closeRefundId = typeof req.body?.refundRequestId === "number" ? req.body.refundRequestId : null;
    const userId = (req as { user?: { id?: string } }).user?.id ?? null;

    if (!EVENT_DATES.has(newDate)) {
      res.status(400).json({ error: "新日期必須是活動日期之一 (2026-07-23 ~ 2026-07-26)" });
      return;
    }

    try {
      const result = await db.transaction(async (tx) => {
        const [reg] = await tx
          .select()
          .from(registrationsTable)
          .where(eq(registrationsTable.id, id));
        if (!reg) return { ok: false as const, status: 404, error: "找不到此報名記錄" };
        if (reg.paymentStatus === "refunded") {
          return { ok: false as const, status: 400, error: "已退款的票券無法改期" };
        }
        if (reg.checkedInAt) {
          return { ok: false as const, status: 400, error: "已入場的票券無法改期" };
        }
        if (reg.eventDate === newDate) {
          return { ok: false as const, status: 400, error: "新日期與原日期相同" };
        }

        // Admin reschedule deliberately bypasses the daily-capacity check:
        // this is a staff-negotiated date change (both sides already agreed),
        // so it must succeed even when the target day is sold out. Public
        // purchase flows still enforce DAILY_CAPACITY.
        await tx
          .update(registrationsTable)
          .set({ eventDate: newDate })
          .where(eq(registrationsTable.id, id));

        if (closeRefundId && reg.paymentRef) {
          // Guard: the refund request being closed MUST belong to the same
          // order as the registration we just rescheduled. Without this check
          // an admin could close an unrelated pending request from a different
          // order by passing a mismatched id pair.
          const regPaymentRef = reg.paymentRef;
          await tx
            .update(refundRequestsTable)
            .set({
              status: "rescheduled",
              adminNote: `已改期至 ${newDate}`,
              processedBy: userId,
              processedAt: new Date(),
            })
            .where(
              and(
                eq(refundRequestsTable.id, closeRefundId),
                eq(refundRequestsTable.paymentRef, regPaymentRef),
                eq(refundRequestsTable.status, "pending"),
              ),
            );
        }

        return { ok: true as const, oldDate: reg.eventDate, newDate };
      });

      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      logger.info({ id, oldDate: result.oldDate, newDate, userId }, "[refund] reschedule");
      res.json({ ok: true, oldDate: result.oldDate, newDate: result.newDate });
    } catch (err) {
      logger.error({ err }, "[refund] reschedule error");
      res.status(500).json({ error: "改期失敗，請稍後再試" });
    }
  },
);

// ── Admin helper: load order detail (regs + tx) for the refund detail panel
router.get(
  "/admin/refund-requests/:id/detail",
  requireRole("editor", "viewer", "checkin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
    const data = await loadRequestWithRegs(id);
    if (!data) { res.status(404).json({ error: "not found" }); return; }
    const [tx] = await db
      .select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.paymentRef, data.request.paymentRef));
    res.json({
      request: redactBankFields(data.request, req.hasRole("editor")),
      transaction: tx ?? null,
      totalHeads: orderTotalHeads(data.regs),
      registrations: data.regs.map((r) => ({
        id: r.id,
        parentName: r.parentName,
        ticketType: r.ticketType,
        ticketCount: r.ticketCount,
        eventDate: r.eventDate,
        amount: r.amount,
        paymentStatus: r.paymentStatus,
        checkedInAt: r.checkedInAt,
      })),
    });
  },
);

export default router;
