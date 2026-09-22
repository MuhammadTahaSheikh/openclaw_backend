import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool, isDatabaseConfigured } from "./index.js";
import type { User, UserRole } from "../types/user.js";
import { normalizeStringList, parseJsonStringArray } from "../utils/access.js";

type UserRow = RowDataPacket & {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  allowed_platforms: unknown;
  allowed_categories: unknown;
  password_hash: string;
  created_at: Date;
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role ?? "member",
    allowedPlatforms: parseJsonStringArray(row.allowed_platforms),
    allowedCategories: parseJsonStringArray(row.allowed_categories),
    createdAt: row.created_at.toISOString(),
  };
}

const USER_SELECT = `
  SELECT id, email, name, role, allowed_platforms, allowed_categories, password_hash, created_at
  FROM users
`;

export async function findUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
  if (!isDatabaseConfigured()) return null;

  const db = getPool();
  const [rows] = await db.execute<UserRow[]>(
    `${USER_SELECT} WHERE email = ? LIMIT 1`,
    [email.toLowerCase().trim()],
  );

  const row = rows[0];
  if (!row) return null;

  return { ...toUser(row), passwordHash: row.password_hash };
}

export async function findUserById(id: number): Promise<User | null> {
  if (!isDatabaseConfigured()) return null;

  const db = getPool();
  const [rows] = await db.execute<UserRow[]>(`${USER_SELECT} WHERE id = ? LIMIT 1`, [id]);

  const row = rows[0];
  return row ? toUser(row) : null;
}

export async function listUsers(): Promise<User[]> {
  const db = getPool();
  const [rows] = await db.execute<UserRow[]>(`${USER_SELECT} ORDER BY name ASC`);
  return rows.map(toUser);
}

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  allowedPlatforms?: string[] | null;
  allowedCategories?: string[] | null;
}): Promise<User> {
  const db = getPool();
  const passwordHash = await bcrypt.hash(input.password, 10);
  const role = input.role ?? "member";
  const allowedPlatforms =
    role === "employee" ? JSON.stringify(normalizeStringList(input.allowedPlatforms ?? [])) : null;
  const allowedCategories =
    role === "employee" ? JSON.stringify(normalizeStringList(input.allowedCategories ?? [])) : null;

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO users (email, password_hash, name, role, allowed_platforms, allowed_categories)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.email.toLowerCase().trim(),
      passwordHash,
      input.name.trim(),
      role,
      allowedPlatforms,
      allowedCategories,
    ],
  );

  const user = await findUserById(result.insertId);
  if (!user) throw new Error("Failed to create user");

  return user;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function setUserRole(userId: number, role: UserRole): Promise<void> {
  const db = getPool();
  await db.execute("UPDATE users SET role = ? WHERE id = ?", [role, userId]);
}

export async function setUserAccess(
  userId: number,
  input: {
    role: UserRole;
    allowedPlatforms?: string[] | null;
    allowedCategories?: string[] | null;
  },
): Promise<void> {
  const db = getPool();
  const allowedPlatforms =
    input.role === "employee" ? JSON.stringify(normalizeStringList(input.allowedPlatforms ?? [])) : null;
  const allowedCategories =
    input.role === "employee" ? JSON.stringify(normalizeStringList(input.allowedCategories ?? [])) : null;

  await db.execute(
    `UPDATE users
     SET role = ?, allowed_platforms = ?, allowed_categories = ?
     WHERE id = ?`,
    [input.role, allowedPlatforms, allowedCategories, userId],
  );
}

export async function syncAdminRoleFromMember(userId: number, memberRole: string | null): Promise<void> {
  if (memberRole?.trim().toLowerCase() === "admin") {
    await setUserRole(userId, "admin");
  }
}

export async function countUsers(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS count FROM users");
  return Number(rows[0]?.count ?? 0);
}
