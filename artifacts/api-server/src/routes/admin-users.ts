import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, adminUsersTable } from "@workspace/db";
import { requireRole } from "../middlewares/authMiddleware";
import { hashPassword, ALL_ROLES, type AdminRole } from "../lib/auth";

const router: IRouter = Router();

const ownerOnly = requireRole("owner");

function isValidRole(r: unknown): r is AdminRole {
  return typeof r === "string" && (ALL_ROLES as string[]).includes(r);
}

function safeUser(row: typeof adminUsersTable.$inferSelect) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    displayName: row.displayName,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

router.get("/admin/users", ownerOnly, async (_req, res) => {
  const rows = await db.select().from(adminUsersTable).orderBy(adminUsersTable.createdAt);
  res.json({ users: rows.map(safeUser) });
});

router.post("/admin/users", ownerOnly, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role;
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : null;

  if (!username || username.length < 2) {
    res.status(400).json({ error: "帳號至少 2 個字元" });
    return;
  }
  if (!password || password.length < 6) {
    res.status(400).json({ error: "密碼至少 6 個字元" });
    return;
  }
  if (!isValidRole(role)) {
    res.status(400).json({ error: `角色必須為 ${ALL_ROLES.join(", ")} 之一` });
    return;
  }

  const [existing] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.username, username));
  if (existing) {
    res.status(409).json({ error: "帳號已存在" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [row] = await db
    .insert(adminUsersTable)
    .values({
      username,
      passwordHash,
      role,
      displayName,
      createdBy: req.adminUser?.username ?? null,
    })
    .returning();
  res.status(201).json({ user: safeUser(row) });
});

router.put("/admin/users/:id", ownerOnly, async (req, res) => {
  const id = req.params.id;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const updates: Partial<typeof adminUsersTable.$inferInsert> = {};

  if (typeof body.role === "string") {
    if (!isValidRole(body.role)) {
      res.status(400).json({ error: "角色不合法" });
      return;
    }
    updates.role = body.role;
  }
  if (typeof body.displayName === "string" || body.displayName === null) {
    updates.displayName = (body.displayName as string | null) || null;
  }
  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 6) {
      res.status(400).json({ error: "密碼至少 6 個字元" });
      return;
    }
    updates.passwordHash = await hashPassword(body.password);
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "沒有可更新的欄位" });
    return;
  }

  const [row] = await db
    .update(adminUsersTable)
    .set(updates)
    .where(eq(adminUsersTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "使用者不存在" });
    return;
  }
  res.json({ user: safeUser(row) });
});

router.delete("/admin/users/:id", ownerOnly, async (req, res) => {
  const id = req.params.id;
  const [row] = await db.delete(adminUsersTable).where(eq(adminUsersTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "使用者不存在" });
    return;
  }
  res.json({ success: true });
});

export default router;
