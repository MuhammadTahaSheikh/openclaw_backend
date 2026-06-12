import { Router } from "express";
import { getStoredLeads } from "../db/leads.repository.js";
import { isDatabaseConfigured } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

export const leadsRouter = Router();

leadsRouter.use(authMiddleware);

leadsRouter.get("/", async (req, res) => {
  try {
    if (!isDatabaseConfigured()) {
      res.status(503).json({ error: "Database is not configured" });
      return;
    }

    const leads = await getStoredLeads({
      platform: typeof req.query.platform === "string" ? req.query.platform : undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      startDate: typeof req.query.startDate === "string" ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === "string" ? req.query.endDate : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });

    res.json({ total: leads.length, leads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch leads";
    res.status(500).json({ error: message });
  }
});
