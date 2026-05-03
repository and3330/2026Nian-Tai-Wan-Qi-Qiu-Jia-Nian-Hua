import { type Request, type Response, type NextFunction } from "express";
import { getSessionId, getSession, type AdminRole, type SessionUser } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      isAuthenticated(): boolean;
      hasRole(...roles: AdminRole[]): boolean;
      adminUser?: SessionUser;
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
  req.hasRole = function (this: Request, ...roles: AdminRole[]) {
    if (!this.adminUser) return false;
    // Owner always has access to everything.
    if (this.adminUser.role === "owner") return true;
    return roles.includes(this.adminUser.role);
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

// Express middleware factory: gate a route to a specific role set. Owner is
// always allowed (handled by req.hasRole). At least one role MUST be passed —
// calling requireRole() with no args would have ambiguous semantics, so it
// throws to prevent misconfiguration. To allow any authenticated admin, just
// rely on req.isAuthenticated() in the route directly.
export function requireRole(...roles: AdminRole[]) {
  if (roles.length === 0) {
    throw new Error("requireRole requires at least one role");
  }
  return function (req: Request, res: Response, next: NextFunction) {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!req.hasRole(...roles)) {
      res.status(403).json({ error: "權限不足", code: "FORBIDDEN" });
      return;
    }
    next();
  };
}
