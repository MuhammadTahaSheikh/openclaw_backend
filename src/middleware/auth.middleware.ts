import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { findUserById } from "../db/users.repository.js";
import type { JwtPayload } from "../types/user.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export type AuthenticatedRequest = Request & {
  user?: { id: number; email: string; name: string };
};

export function signToken(payload: JwtPayload): string {
  const expiresIn = process.env.JWT_EXPIRES_IN ?? "7d";
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = verifyToken(token);
    const user = await findUserById(payload.userId);

    if (!user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
