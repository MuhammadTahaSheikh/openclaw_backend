import { Router } from "express";
import { runLeadBot } from "../services/bot.service.js";
import type { BotRunRequest } from "../types/lead.js";

export const botRouter = Router();

botRouter.post("/run", async (req, res) => {
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

    const result = await runLeadBot(body);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bot run failed";
    res.status(500).json({ error: message });
  }
});
