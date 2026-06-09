import { Router } from "express";
import { acceptInvite, findInviteByToken } from "../db/members.repository.js";
import { isDatabaseConfigured } from "../db/index.js";
import { countUsers, createUser, findUserByEmail, verifyPassword } from "../db/users.repository.js";
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

    const user = await createUser({
      email: invite.email,
      password,
      name: invite.name,
    });

    await acceptInvite(token, user.id);

    const jwtToken = signToken({ userId: user.id, email: user.email });

    res.json({
      token: jwtToken,
      user,
      message: "Password set successfully. You can now sign in.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to set password";
    res.status(500).json({ error: message });
  }
});

authRouter.get("/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
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
    });

    const token = signToken({ userId: user.id, email: user.email });

    res.status(201).json({ token, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    res.status(500).json({ error: message });
  }
});
