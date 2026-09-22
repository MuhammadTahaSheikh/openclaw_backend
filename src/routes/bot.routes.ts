import { Router } from "express";
import { findMemberByUserId } from "../db/members.repository.js";
import { getBotRunById, getBotRunHistory } from "../db/leads.repository.js";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { runLeadBot } from "../services/bot.service.js";
import type { BotRunBy, BotRunRequest } from "../types/lead.js";
import { canAccessCategory, canAccessPlatform } from "../utils/access.js";
import { isAdminRole } from "../utils/admin.js";

export const botRouter = Router();

botRouter.use(authMiddleware);

botRouter.get("/runs", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const runs = await getBotRunHistory({
      limit,
      date,
      category,
      userId: isAdminRole(req.user.role) ? undefined : req.user.id,
    });
    res.json({ runs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch run history";
    res.status(500).json({ error: message });
  }
});

botRouter.get("/runs/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const runId = Number(req.params.id);
    if (!Number.isFinite(runId) || runId <= 0) {
      res.status(400).json({ error: "Invalid run id" });
      return;
    }

    const run = await getBotRunById(runId);
    if (!run) {
      res.status(404).json({ error: "Bot run not found" });
      return;
    }

    if (!isAdminRole(req.user.role) && run.runBy?.userId !== req.user.id) {
      res.status(403).json({ error: "You do not have access to this bot run" });
      return;
    }

    res.json(run);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch bot run";
    res.status(500).json({ error: message });
  }
});

botRouter.post("/run", async (req: AuthenticatedRequest, res) => {
  try {
    const body = req.body as BotRunRequest;

    if (!body.platform) {
      res.status(400).json({ error: "platform is required" });
      return;
    }

    if (!body.category && !body.keyword?.trim()) {
      res.status(400).json({ error: "category is required" });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!canAccessPlatform(req.user, body.platform)) {
      res.status(403).json({ error: "You do not have access to this platform" });
      return;
    }

    if (req.user.role === "employee") {
      if (!body.category || !canAccessCategory(req.user, body.category)) {
        res.status(403).json({ error: "You do not have access to this category" });
        return;
      }
    }

    const member = await findMemberByUserId(req.user.id);
    const runBy: BotRunBy = {
      userId: req.user.id,
      memberId: member?.id ?? null,
      name: member?.name ?? req.user.name,
      email: member?.email ?? req.user.email,
    };

    const result = await runLeadBot(body, runBy);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bot run failed";
    res.status(500).json({ error: message });
  }
});
