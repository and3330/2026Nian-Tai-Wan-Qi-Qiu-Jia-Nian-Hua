import crypto from "crypto";
import { promisify } from "util";
import { type Request, type Response } from "express";
import { db, sessionsTable, adminUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "1";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "aa3210";

export type AdminRole = "owner" | "editor" | "checkin" | "viewer";
export const ALL_ROLES: AdminRole[] = ["owner", "editor", "checkin", "viewer"];

export interface SessionUser {
  id: string;
  username: string;
  role: AdminRole;
  displayName?: string | null;
}

export interface SessionData {
  user: SessionUser;
}

export interface AuthResult {
  ok: boolean;
  user?: SessionUser;
  error?: string;
}

const scryptAsync = promisify(crypto.scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith("scrypt$")) return false;
  const [, salt, hex] = stored.split("$");
  if (!salt || !hex) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

// Authenticates against:
// 1) the env-based super-admin (always granted role=owner) — preserves the
//    existing single-admin behaviour and ensures the owner can't be locked out;
// 2) the admin_users table for additional roles (editor/checkin/viewer/owner).
export async function authenticateAdmin(username: string, password: string): Promise<AuthResult> {
  if (!username || !password) {
    return { ok: false, error: "請輸入帳號和密碼" };
  }

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return {
      ok: true,
      user: { id: "admin", username, role: "owner", displayName: "系統管理員" },
    };
  }

  const [row] = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.username, username));
  if (!row) return { ok: false, error: "帳號或密碼錯誤" };

  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) return { ok: false, error: "帳號或密碼錯誤" };

  return {
    ok: true,
    user: {
      id: row.id,
      username: row.username,
      role: row.role as AdminRole,
      displayName: row.displayName,
    },
  };
}

export async function createSession(data: SessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sid, sid));

  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }

  return row.sess as unknown as SessionData;
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export async function clearSession(
  res: Response,
  sid?: string,
): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function getSessionId(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.[SESSION_COOKIE];
}
