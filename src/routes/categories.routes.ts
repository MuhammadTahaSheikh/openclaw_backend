import { Router } from "express";
import { listCategories } from "../config/categories.js";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { filterByAllowlist } from "../utils/access.js";

export const categoriesRouter = Router();

categoriesRouter.get("/", authMiddleware, (req: AuthenticatedRequest, res) => {
  const categories = listCategories();
  const filtered = filterByAllowlist(req.user!, categories, "category");
  res.json({ categories: filtered });
});
