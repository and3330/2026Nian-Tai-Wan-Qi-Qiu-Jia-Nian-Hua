import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import { sql, eq } from "drizzle-orm";
import {
  db,
  registrationsTable,
  paymentTransactionsTable,
  refundRequestsTable,
} from "@workspace/db";
import refundRouter from "../src/routes/refund-requests";
import { TEST_MARKER, testName } from "./helpers";

// Admin routes are gated by requireRole; the test app stubs an editor session
// so we can exercise the business logic without a real login.
function makeAdminTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.isAuthenticated = () => true;
    req.hasRole = () => true;
    next();
  });
  app.use("/api", refundRouter);
  return app;
}

let app: Express;

async function cleanup(): Promise<void> {
  await db.delete(refundRequestsTable).where(sql`${refundRequestsTable.buyerName} LIKE ${TEST_MARKER + "%"}`);
  await db.delete(registrationsTable).where(sql`${registrationsTable.parentName} LIKE ${TEST_MARKER + "%"}`);
  await db.delete(paymentTransactionsTable).where(sql`${paymentTransactionsTable.paymentRef} LIKE ${"TESTREF-" + TEST_MARKER + "%"}`);
}

async function seedOrderWithRefundRequest(suffix: string): Promise<{ refundId: number; paymentRef: string }> {
  const paymentRef = `TESTREF-${TEST_MARKER}${suffix}${Math.random().toString(36).slice(2, 8)}`;
  await db.insert(registrationsTable).values({
    parentName: testName(suffix),
    phone: "0900111222",
    email: null,
    ticketCount: 1,
    eventDate: "2026-07-23",
    ticketType: "single",
    amount: 300,
    paymentStatus: "paid",
    paymentRef,
    qrToken: `${TEST_MARKER}${Math.random().toString(36).slice(2)}${Date.now()}`,
  });
  await db.insert(paymentTransactionsTable).values({
    paymentRef,
    provider: "newebpay",
    amount: 300,
    status: "paid",
    itemName: "test",
  });
  const [created] = await db
    .insert(refundRequestsTable)
    .values({
      paymentRef,
      buyerName: testName(suffix),
      buyerContact: "0900111222",
      reason: "test reason 12345",
      status: "pending",
      refundAmount: 300,
    })
    .returning({ id: refundRequestsTable.id });
  return { refundId: created.id, paymentRef };
}

beforeAll(() => {
  app = makeAdminTestApp();
});
afterEach(cleanup);
afterAll(cleanup);

describe("POST /api/admin/refund-requests/:id/approve", () => {
  it("marks request approved, registrations + payment transaction refunded", async () => {
    const { refundId, paymentRef } = await seedOrderWithRefundRequest("a-");
    const res = await request(app).post(`/api/admin/refund-requests/${refundId}/approve`).send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // No issued invoice for this order → void not attempted but reported.
    expect(res.body.invoiceVoid.attempted).toBe(false);

    const [req2] = await db.select().from(refundRequestsTable).where(eq(refundRequestsTable.id, refundId));
    expect(req2.status).toBe("approved");
    const regs = await db.select().from(registrationsTable).where(eq(registrationsTable.paymentRef, paymentRef));
    expect(regs.every((r) => r.paymentStatus === "refunded")).toBe(true);
    const [tx] = await db.select().from(paymentTransactionsTable).where(eq(paymentTransactionsTable.paymentRef, paymentRef));
    expect(tx.status).toBe("refunded");
  });

  it("refuses to approve twice", async () => {
    const { refundId } = await seedOrderWithRefundRequest("b-");
    await request(app).post(`/api/admin/refund-requests/${refundId}/approve`).send({});
    const res = await request(app).post(`/api/admin/refund-requests/${refundId}/approve`).send({});
    expect(res.status).toBe(400);
  });
});

describe("POST /api/refund-requests — duplicate guard", () => {
  it("concurrent submissions for the same order create only one request", async () => {
    const paymentRef = `TESTREF-${TEST_MARKER}dup${Math.random().toString(36).slice(2, 8)}`;
    await db.insert(registrationsTable).values({
      parentName: testName("dup-"),
      phone: "0900333444",
      email: null,
      ticketCount: 1,
      eventDate: "2026-07-23",
      ticketType: "single",
      amount: 300,
      paymentStatus: "paid",
      paymentRef,
      qrToken: `${TEST_MARKER}${Math.random().toString(36).slice(2)}${Date.now()}`,
    });
    await db.insert(paymentTransactionsTable).values({
      paymentRef,
      provider: "newebpay",
      amount: 300,
      status: "paid",
      itemName: "test",
    });

    const submit = () =>
      request(app)
        .post("/api/refund-requests")
        .send({ paymentRef, contact: "0900333444", reason: "concurrent duplicate test" });
    const [r1, r2] = await Promise.all([submit(), submit()]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const rows = await db
      .select()
      .from(refundRequestsTable)
      .where(eq(refundRequestsTable.paymentRef, paymentRef));
    expect(rows).toHaveLength(1);
    // Tag the row so cleanup removes it (buyerName comes from the registration,
    // which already carries the marker).
    expect(rows[0].buyerName.startsWith(TEST_MARKER)).toBe(true);
  });
});

describe("POST /api/admin/refund-requests/bulk", () => {
  it("bulk approve processes each id and reports per-id results", async () => {
    const a = await seedOrderWithRefundRequest("c-");
    const b = await seedOrderWithRefundRequest("d-");
    const res = await request(app)
      .post("/api/admin/refund-requests/bulk")
      .send({ action: "approve", ids: [a.refundId, b.refundId, 99999999] });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.succeeded).toBe(2);
    expect(res.body.failed).toBe(1);

    const rows = await db
      .select()
      .from(refundRequestsTable)
      .where(sql`${refundRequestsTable.id} IN (${a.refundId}, ${b.refundId})`);
    expect(rows.every((r) => r.status === "approved")).toBe(true);
  });

  it("bulk reject requires a note and only touches pending rows", async () => {
    const a = await seedOrderWithRefundRequest("e-");
    const noNote = await request(app)
      .post("/api/admin/refund-requests/bulk")
      .send({ action: "reject", ids: [a.refundId] });
    expect(noNote.status).toBe(400);

    const res = await request(app)
      .post("/api/admin/refund-requests/bulk")
      .send({ action: "reject", ids: [a.refundId], adminNote: "測試拒絕原因" });
    expect(res.status).toBe(200);
    expect(res.body.succeeded).toBe(1);
    const [row] = await db.select().from(refundRequestsTable).where(eq(refundRequestsTable.id, a.refundId));
    expect(row.status).toBe("rejected");
  });

  it("rejects invalid actions and empty id lists", async () => {
    const bad = await request(app).post("/api/admin/refund-requests/bulk").send({ action: "nuke", ids: [1] });
    expect(bad.status).toBe(400);
    const empty = await request(app).post("/api/admin/refund-requests/bulk").send({ action: "approve", ids: [] });
    expect(empty.status).toBe(400);
  });
});
