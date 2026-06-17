import express, { type Express } from "express";
import { sql } from "drizzle-orm";
import { db, registrationsTable } from "@workspace/db";
import registrationsRouter from "../src/routes/registrations";

// Every row a test creates is tagged with this prefix in parent_name so the
// cleanup step only ever deletes rows it owns and never touches real data.
export const TEST_MARKER = "__torTEST__";

export function makeTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use("/api", registrationsRouter);
  return app;
}

export function testName(suffix = ""): string {
  return `${TEST_MARKER}${suffix}${Math.random().toString(36).slice(2, 8)}`;
}

export function testEmail(): string {
  return `tor-${Math.random().toString(36).slice(2, 10)}@test.example`;
}

// Removes only rows this test suite inserted (matched by the marker prefix).
export async function cleanupTestRows(): Promise<void> {
  await db.delete(registrationsTable).where(sql`${registrationsTable.parentName} LIKE ${TEST_MARKER + "%"}`);
}

// Directly insert N paid tournament-participant rows to deterministically fill
// the 128-competitor inventory up to a target, regardless of pre-existing data.
export async function seedParticipants(count: number): Promise<void> {
  if (count <= 0) return;
  const rows = Array.from({ length: count }, () => ({
    parentName: testName("seed-"),
    phone: "0900000000",
    email: testEmail(),
    ticketCount: 1,
    eventDate: "2026-07-26",
    ticketType: "tournament",
    amount: 600,
    paymentStatus: "paid",
    qrToken: `${TEST_MARKER}${Math.random().toString(36).slice(2)}${Date.now()}${Math.random()}`,
  }));
  await db.insert(registrationsTable).values(rows);
}

export async function tournamentRegistered(): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(${registrationsTable.ticketCount}), 0)` })
    .from(registrationsTable)
    .where(sql`${registrationsTable.ticketType} = 'tournament' AND ${registrationsTable.paymentStatus} <> 'refunded'`);
  return Number(row?.total ?? 0);
}
