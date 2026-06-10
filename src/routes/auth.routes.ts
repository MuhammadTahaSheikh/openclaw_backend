import { Router } from "express";
import { acceptInvite, findInviteByToken, findMemberByEmail } from "../db/members.repository.js";
import { isDatabaseConfigured } from "../db/index.js";
import {
  countUsers,
  createUser,
  findUserByEmail,
  findUserById,
  syncAdminRoleFromMember,
  verifyPassword,
} from "../db/users.repository.js";
import { authMiddleware, signToken, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import type { LoginRequest } from "../types/user.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  try {
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }

    const { email, password } = req.body as LoginRequest;

    if (!email?.trim() || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    res.status(500).json({ error: message });
  }
});

authRouter.get("/invite/:token", async (req, res) => {
  try {
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }

    const invite = await findInviteByToken(req.params.token);
    if (!invite) {
      res.status(404).json({ error: "Invalid or expired invite link" });
      return;
    }

    res.json({ invite });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify invite";
    res.status(500).json({ error: message });
  }
});

authRouter.post("/set-password", async (req, res) => {
  try {
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }

    const { token, password } = req.body as { token?: string; password?: string };

    if (!token?.trim() || !password || password.length < 6) {
      res.status(400).json({ error: "Token and password (min 6 chars) are required" });
      return;
    }

    const invite = await findInviteByToken(token);
    if (!invite) {
      res.status(404).json({ error: "Invalid or expired invite link" });
      return;
    }

    const existingUser = await findUserByEmail(invite.email);
    if (existingUser) {
      res.status(409).json({ error: "An account already exists for this email" });
      return;
    }

    const memberRecord = await findMemberByEmail(invite.email);
    const user = await createUser({
      email: invite.email,
      password,
      name: invite.name,
      role: memberRecord?.role?.trim().toLowerCase() === "admin" ? "admin" : "member",
    });

    await acceptInvite(token, user.id);
    await syncAdminRoleFromMember(user.id, memberRecord?.role ?? null);

    const savedUser = (await findUserById(user.id)) ?? user;
    const jwtToken = signToken({ userId: savedUser.id, email: savedUser.email });

    res.json({
      token: jwtToken,
      user: savedUser,
      message: "Password set successfully. You can now sign in.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to set password";
    res.status(500).json({ error: message });
  }
});

authRouter.get("/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const user = await findUserById(req.user!.id);
  if (!user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  res.json({ user });
});

authRouter.post("/register", async (req, res) => {
  try {
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }

    const userCount = await countUsers();
    if (userCount > 0) {
      res.status(403).json({ error: "Registration is disabled" });
      return;
    }

    const { email, password, name } = req.body as LoginRequest & { name?: string };

    if (!email?.trim() || !password || password.length < 6) {
      res.status(400).json({ error: "Email and password (min 6 chars) are required" });
      return;
    }

    const user = await createUser({
      email,
      password,
      name: name?.trim() || email.split("@")[0],
      role: "admin",
    });

    const token = signToken({ userId: user.id, email: user.email });

    res.status(201).json({ token, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    res.status(500).json({ error: message });
  }
});
