import { Router } from "express";
import {
  createTrackerRow,
  deleteTrackerRow,
  listAllTrackerRows,
  updateTrackerRow,
} from "../db/tracker.repository.js";
import { listUsers } from "../db/users.repository.js";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { TRACKER_HEADERS, type TrackerRowInput } from "../types/tracker.js";
import { isAdminRole } from "../utils/admin.js";

export const trackerRouter = Router();

trackerRouter.use(authMiddleware);

trackerRouter.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const isAdmin = isAdminRole(user.role);
    const filterUserId =
      req.query.userId !== undefined && req.query.userId !== ""
        ? Number(req.query.userId)
        : undefined;

    if (filterUserId !== undefined && !Number.isFinite(filterUserId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const [rows, users] = await Promise.all([
      listAllTrackerRows(filterUserId),
      listUsers(),
    ]);

    return res.json({
      headers: TRACKER_HEADERS,
      rows,
      isAdmin,
      users: users.map((item) => ({ id: item.id, name: item.name, email: item.email })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load tracker";
    res.status(500).json({ error: message });
  }
});

trackerRouter.post("/rows", async (req: AuthenticatedRequest, res) => {
  try {
    const row = await createTrackerRow(req.user!.id, req.body as TrackerRowInput);
    res.status(201).json(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create row";
    res.status(500).json({ error: message });
  }
});

trackerRouter.put("/rows/:id", async (req: AuthenticatedRequest, res) => {
  const rowId = Number(req.params.id);
  if (!Number.isFinite(rowId)) {
    return res.status(400).json({ error: "Invalid row id" });
  }

  try {
    const row = await updateTrackerRow(rowId, req.body as TrackerRowInput);
    if (!row) {
      return res.status(404).json({ error: "Row not found" });
    }
    return res.json(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update row";
    res.status(500).json({ error: message });
  }
});

trackerRouter.delete("/rows/:id", async (req: AuthenticatedRequest, res) => {
  const rowId = Number(req.params.id);
  if (!Number.isFinite(rowId)) {
    return res.status(400).json({ error: "Invalid row id" });
  }

  try {
    const deleted = await deleteTrackerRow(rowId);
    if (!deleted) {
      return res.status(404).json({ error: "Row not found" });
    }
    return res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete row";
    res.status(500).json({ error: message });
  }
});
