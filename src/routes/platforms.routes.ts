import { Router } from "express";
import { listPlatforms } from "../platforms/index.js";

export const platformsRouter = Router();

platformsRouter.get("/", (_req, res) => {
  res.json({ platforms: listPlatforms() });
});
