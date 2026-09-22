import { Router } from "express";
import { listPlatforms } from "../platforms/index.js";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { filterByAllowlist } from "../utils/access.js";

export const platformsRouter = Router();

platformsRouter.get("/", authMiddleware, (req: AuthenticatedRequest, res) => {
  const platforms = listPlatforms();
  const filtered = filterByAllowlist(req.user!, platforms, "platform");
  res.json({ platforms: filtered });
});
