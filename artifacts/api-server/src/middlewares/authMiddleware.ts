import { type Request, type Response, type NextFunction } from "express";
import { getSessionId, getSession } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      isAuthenticated(): boolean;
      adminUser?: { id: string; username: string };
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.adminUser != null;
  };

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const session = await getSession(sid);
  if (!session?.user?.id) {
    next();
    return;
  }

  req.adminUser = session.user;
  next();
}
