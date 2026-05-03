import { Router, type IRouter, type Request, type Response } from "express";
import {
  authenticateAdmin,
  createSession,
  clearSession,
  getSessionId,
  SESSION_COOKIE,
  SESSION_TTL,
} from "../lib/auth";

const router: IRouter = Router();

router.get("/auth/user", (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.adminUser });
  } else {
    res.json({ user: null });
  }
});

router.post("/auth/login", async (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  const result = await authenticateAdmin(username, password);
  if (!result.ok || !result.user) {
    const status = result.error === "請輸入帳號和密碼" ? 400 : 401;
    res.status(status).json({ error: result.error || "登入失敗" });
    return;
  }

  const sid = await createSession({ user: result.user });

  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });

  res.json({ user: result.user });
});

router.post("/auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
});

export default router;
