import { Router, type IRouter, type Request, type Response } from "express";
import {
  validateAdminCredentials,
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

  if (!username || !password) {
    res.status(400).json({ error: "請輸入帳號和密碼" });
    return;
  }

  if (!validateAdminCredentials(username, password)) {
    res.status(401).json({ error: "帳號或密碼錯誤" });
    return;
  }

  const sid = await createSession({
    user: { id: "admin", username },
  });

  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });

  res.json({ user: { id: "admin", username } });
});

router.post("/auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
});

export default router;
