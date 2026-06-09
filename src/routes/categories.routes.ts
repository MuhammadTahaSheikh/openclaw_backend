import { Router } from "express";
import { listCategories } from "../config/categories.js";

export const categoriesRouter = Router();

categoriesRouter.get("/", (_req, res) => {
  res.json({ categories: listCategories() });
});
