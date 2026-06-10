import { Router } from "express";
import {
  createMemberWithInvite,
  deleteMember,
  findMemberByEmail,
  listMembers,
  refreshMemberInvite,
  updateMember,
} from "../db/members.repository.js";
import { isDatabaseConfigured } from "../db/index.js";
import { findUserByEmail } from "../db/users.repository.js";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { sendMemberInvite } from "../services/email.service.js";
import type { CreateMemberRequest, UpdateMemberRequest } from "../types/member.js";
import { getInviteUrl } from "../utils/invite-token.js";

export const membersRouter = Router();

membersRouter.use(authMiddleware);

membersRouter.get("/", async (_req, res) => {
  try {
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }

    const members = await listMembers();
    res.json({ total: members.length, members });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch members";
    res.status(500).json({ error: message });
  }
});

membersRouter.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }

    const body = req.body as CreateMemberRequest;

    if (!body.name?.trim() || !body.email?.trim()) {
      res.status(400).json({ error: "Name and email are required" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = body.email.toLowerCase().trim();
    if (!emailRegex.test(normalizedEmail)) {
      res.status(400).json({ error: "Invalid email address" });
      return;
    }

    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      res.status(409).json({ error: "This email already has a login account" });
      return;
    }

    const existingMember = await findMemberByEmail(normalizedEmail);
    if (existingMember) {
      res.status(409).json({ error: "A member with this email already exists" });
      return;
    }

    const { member, inviteToken } = await createMemberWithInvite(body, req.user!.id);
    const inviteUrl = getInviteUrl(inviteToken);

    await sendMemberInvite({
      to: member.email,
      name: member.name,
      inviteUrl,
    });

    res.status(201).json({
      member,
      inviteSent: true,
      message: `Invite email sent to ${member.email}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create member";
    const status = message.includes("Duplicate") ? 409 : 500;
    res.status(status).json({ error: message });
  }
});

membersRouter.put("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }

    const memberId = Number(req.params.id);
    if (!Number.isFinite(memberId)) {
      res.status(400).json({ error: "Invalid member id" });
      return;
    }

    const body = req.body as UpdateMemberRequest;

    if (body.name !== undefined && !body.name.trim()) {
      res.status(400).json({ error: "Name cannot be empty" });
      return;
    }

    if (body.email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const normalizedEmail = body.email.toLowerCase().trim();
      if (!emailRegex.test(normalizedEmail)) {
        res.status(400).json({ error: "Invalid email address" });
        return;
      }

      const existingUser = await findUserByEmail(normalizedEmail);
      const member = await findMemberByEmail(normalizedEmail);
      if (existingUser || (member && member.id !== memberId)) {
        res.status(409).json({ error: "This email is already in use" });
        return;
      }
    }

    const updated = await updateMember(memberId, body);
    if (!updated) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    res.json({ member: updated, message: "Member updated" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update member";
    const status = message.includes("Cannot change") || message.includes("already exists") ? 409 : 500;
    res.status(status).json({ error: message });
  }
});

membersRouter.delete("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }

    const memberId = Number(req.params.id);
    if (!Number.isFinite(memberId)) {
      res.status(400).json({ error: "Invalid member id" });
      return;
    }

    const deleted = await deleteMember(memberId);
    if (!deleted) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    res.json({ ok: true, message: "Member deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete member";
    res.status(500).json({ error: message });
  }
});

membersRouter.post("/:id/resend-invite", async (req: AuthenticatedRequest, res) => {
  try {
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }

    const memberId = Number(req.params.id);
    if (!Number.isFinite(memberId)) {
      res.status(400).json({ error: "Invalid member id" });
      return;
    }

    const { member, inviteToken } = await refreshMemberInvite(memberId);

    const existingUser = await findUserByEmail(member.email);
    if (existingUser) {
      res.status(409).json({ error: "This email already has a login account" });
      return;
    }

    const inviteUrl = getInviteUrl(inviteToken);

    await sendMemberInvite({
      to: member.email,
      name: member.name,
      inviteUrl,
    });

    res.json({
      member,
      inviteSent: true,
      message: `Invite email resent to ${member.email}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resend invite";
    const status = message.includes("not found") ? 404 : message.includes("already") ? 409 : 500;
    res.status(status).json({ error: message });
  }
});
