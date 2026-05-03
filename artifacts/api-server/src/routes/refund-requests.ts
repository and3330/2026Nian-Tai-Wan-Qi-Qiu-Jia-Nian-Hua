import { Router, type IRouter } from "express";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  db,
  registrationsTable,
  paymentTransactionsTable,
  refundRequestsTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/authMiddleware";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const EVENT_DATES = new Set(["2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26"]);
const DAILY_CAPACITY = 500;

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

    if (regs.some((r) => r.paymentStatus === "refunded")) {
      res.status(400).json({ error: "此訂單已退款，無法再次申請" });
      return;
    }
    if (regs.some((r) => r.checkedInAt)) {
      res.status(400).json({ error: "已入場的票券無法退票，請聯絡客服" });
      return;
    }

    const [existing] = await db
      .select({ id: refundRequestsTable.id, status: refundRequestsTable.status })
      .from(refundRequestsTable)
      .where(
        and(
          eq(refundRequestsTable.paymentRef, ref),
          sql`${refundRequestsTable.status} IN ('pending', 'approved')`,
        ),
      )
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "此訂單已有處理中的退票申請，請耐心等候或來電查詢" });
      return;
    }

    const [created] = await db
      .insert(refundRequestsTable)
      .values({
        paymentRef: ref,
        buyerName: matched.parentName,
        buyerContact: contactRaw,
        reason,
        status: "pending",
        refundAmount: tx.amount,
      })
      .returning({ id: refundRequestsTable.id });

    logger.info({ refundId: created.id, paymentRef: ref }, "[refund] new request submitted");
    res.status(201).json({ id: created.id, status: "pending", message: "已收到您的退票申請，工作人員會於 3 個工作天內處理並回覆。" });
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
      res.json(rows);
    } catch (err) {
      logger.error({ err }, "[refund] admin list error");
      res.status(500).json({ error: "Failed to load refund requests" });
    }
  },
);

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

// ── Admin: approve refund (releases inventory) ─────────────────────────────
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
      const result = await db.transaction(async (tx) => {
        const [request] = await tx
          .select()
          .from(refundRequestsTable)
          .where(eq(refundRequestsTable.id, id))
          .for("update");
        if (!request) return { ok: false as const, status: 404, error: "not found" };
        if (request.status !== "pending") {
          return { ok: false as const, status: 400, error: `此申請已處於「${request.status}」狀態，無法重複處理` };
        }
        await tx
          .update(registrationsTable)
          .set({ paymentStatus: "refunded" })
          .where(
            and(
              eq(registrationsTable.paymentRef, request.paymentRef),
              sql`${registrationsTable.paymentStatus} <> 'refunded'`,
            ),
          );
        await tx
          .update(refundRequestsTable)
          .set({
            status: "approved",
            adminNote: adminNote || request.adminNote,
            refundAmount: refundAmountInput ?? request.refundAmount,
            processedBy: userId,
            processedAt: new Date(),
          })
          .where(eq(refundRequestsTable.id, id));
        return { ok: true as const };
      });

      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      logger.info({ id, userId }, "[refund] approved");
      res.json({ ok: true, status: "approved" });
    } catch (err) {
      logger.error({ err }, "[refund] approve error");
      res.status(500).json({ error: "處理失敗，請稍後再試" });
    }
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

        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`reg:${newDate}`}))`);
        const [row] = await tx
          .select({ total: sql<number>`COALESCE(SUM(${registrationsTable.ticketCount}), 0)` })
          .from(registrationsTable)
          .where(sql`${registrationsTable.eventDate} = ${newDate} AND ${registrationsTable.paymentStatus} <> 'refunded'`);
        const used = Number(row?.total ?? 0);
        const ticketCount = reg.ticketCount ?? 1;
        if (used + ticketCount > DAILY_CAPACITY) {
          return { ok: false as const, status: 409, error: `${newDate} 名額不足（剩餘 ${DAILY_CAPACITY - used}，需要 ${ticketCount}）` };
        }

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
      request: data.request,
      transaction: tx ?? null,
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
