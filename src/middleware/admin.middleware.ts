import type { NextFunction, Response } from "express";
import { canManageMembers, isAdminRole } from "../utils/admin.js";
import type { AuthenticatedRequest } from "./auth.middleware.js";

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user || !isAdminRole(req.user.role)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export function requireMemberManager(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user || !canManageMembers(req.user.role)) {
    res.status(403).json({ error: "You do not have access to manage members" });
    return;
  }
  next();
}
