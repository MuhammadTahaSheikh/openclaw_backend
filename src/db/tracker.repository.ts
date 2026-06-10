import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool, isDatabaseConfigured } from "./index.js";
import type { TrackerRow, TrackerRowInput, TrackerUserOption } from "../types/tracker.js";

type TrackerRowRecord = RowDataPacket & {
  id: number;
  user_id: number;
  row_date: string | Date | null;
  name: string | null;
  job_title: string | null;
  email: string | null;
  linkedin: string | null;
  phone: string | null;
  source: string | null;
  remarks: string | null;
  connects: string | null;
  project_price: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  owner_name?: string;
  owner_email?: string;
};

function formatRowDate(value: string | Date | null | undefined): string | null {
  if (value == null) return null;

  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const trimmed = String(value).trim();
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return isoMatch ? isoMatch[1] : null;
}

function toTrackerRow(row: TrackerRowRecord, includeOwner = false): TrackerRow {
  const base: TrackerRow = {
    id: row.id,
    date: formatRowDate(row.row_date),
    name: row.name,
    jobTitle: row.job_title,
    email: row.email,
    linkedin: row.linkedin,
    phone: row.phone,
    source: row.source,
    remarks: row.remarks,
    connects: row.connects,
    projectPrice: row.project_price,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };

  if (includeOwner) {
    base.userId = row.user_id;
    base.ownerName = row.owner_name ?? undefined;
    base.ownerEmail = row.owner_email ?? undefined;
  }

  return base;
}

function normalizeInput(input: TrackerRowInput): (string | null)[] {
  return [
    formatRowDate(input.date ?? null),
    input.name?.trim() || null,
    input.jobTitle?.trim() || null,
    input.email?.trim() || null,
    input.linkedin?.trim() || null,
    input.phone?.trim() || null,
    input.source?.trim() || null,
    input.remarks?.trim() || null,
    input.connects?.trim() || null,
    input.projectPrice?.trim() || null,
  ];
}

const ROW_SELECT = `r.id, r.user_id, r.row_date, r.name, r.job_title, r.email, r.linkedin, r.phone,
  r.source, r.remarks, r.connects, r.project_price, r.sort_order, r.created_at, r.updated_at`;

export async function listTrackerUsersWithRows(): Promise<TrackerUserOption[]> {
  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT DISTINCT u.id, u.name, u.email
     FROM users u
     INNER JOIN user_tracker_rows r ON r.user_id = u.id
     ORDER BY u.name ASC`,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
  }));
}

export async function listTrackerRows(userId: number): Promise<TrackerRow[]> {
  if (!isDatabaseConfigured()) return [];

  const db = getPool();
  const [rows] = await db.execute<TrackerRowRecord[]>(
    `SELECT ${ROW_SELECT}
     FROM user_tracker_rows r
     WHERE r.user_id = ?
     ORDER BY r.sort_order ASC, r.id ASC`,
    [userId],
  );

  return rows.map((row) => toTrackerRow(row));
}

export async function listAllTrackerRows(filterUserId?: number): Promise<TrackerRow[]> {
  const db = getPool();
  const params: number[] = [];
  let whereClause = "";

  if (filterUserId !== undefined) {
    whereClause = "WHERE r.user_id = ?";
    params.push(filterUserId);
  }

  const [rows] = await db.execute<TrackerRowRecord[]>(
    `SELECT ${ROW_SELECT}, u.name AS owner_name, u.email AS owner_email
     FROM user_tracker_rows r
     INNER JOIN users u ON u.id = r.user_id
     ${whereClause}
     ORDER BY u.name ASC, r.sort_order ASC, r.id ASC`,
    params,
  );

  return rows.map((row) => toTrackerRow(row, true));
}

export async function createTrackerRow(userId: number, input: TrackerRowInput): Promise<TrackerRow> {
  const db = getPool();
  const values = normalizeInput(input);

  const [maxRows] = await db.execute<RowDataPacket[]>(
    "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM user_tracker_rows WHERE user_id = ?",
    [userId],
  );
  const sortOrder = Number(maxRows[0]?.max_order ?? 0) + 1;

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO user_tracker_rows
      (user_id, row_date, name, job_title, email, linkedin, phone, source, remarks, connects, project_price, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, ...values, sortOrder],
  );

  const row = await getTrackerRowById(result.insertId, userId);
  if (!row) throw new Error("Failed to create tracker row");
  return row;
}

export async function getTrackerRowById(
  rowId: number,
  userId?: number,
): Promise<TrackerRow | null> {
  const db = getPool();
  const params: number[] = [rowId];
  let userClause = "";

  if (userId !== undefined) {
    userClause = "AND r.user_id = ?";
    params.push(userId);
  }

  const [rows] = await db.execute<TrackerRowRecord[]>(
    `SELECT ${ROW_SELECT}, u.name AS owner_name, u.email AS owner_email
     FROM user_tracker_rows r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.id = ? ${userClause}
     LIMIT 1`,
    params,
  );

  const row = rows[0];
  return row ? toTrackerRow(row, userId === undefined) : null;
}

export async function updateTrackerRow(
  rowId: number,
  input: TrackerRowInput,
  userId?: number,
): Promise<TrackerRow | null> {
  const db = getPool();
  const values = normalizeInput(input);
  const params: (string | null | number)[] = [...values, rowId];

  let userClause = "";
  if (userId !== undefined) {
    userClause = "AND user_id = ?";
    params.push(userId);
  }

  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE user_tracker_rows
     SET row_date = ?, name = ?, job_title = ?, email = ?, linkedin = ?, phone = ?,
         source = ?, remarks = ?, connects = ?, project_price = ?
     WHERE id = ? ${userClause}`,
    params,
  );

  if (result.affectedRows === 0) return null;
  return getTrackerRowById(rowId, userId);
}

export async function deleteTrackerRow(rowId: number, userId?: number): Promise<boolean> {
  const db = getPool();
  const params: number[] = [rowId];

  let userClause = "";
  if (userId !== undefined) {
    userClause = "AND user_id = ?";
    params.push(userId);
  }

  const [result] = await db.execute<ResultSetHeader>(
    `DELETE FROM user_tracker_rows WHERE id = ? ${userClause}`,
    params,
  );
  return result.affectedRows > 0;
}
