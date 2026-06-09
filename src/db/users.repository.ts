import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool, isDatabaseConfigured } from "./index.js";
import type { User } from "../types/user.js";

type UserRow = RowDataPacket & {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  created_at: Date;
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at.toISOString(),
  };
}

export async function findUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
  if (!isDatabaseConfigured()) return null;

  const db = getPool();
  const [rows] = await db.execute<UserRow[]>(
    "SELECT id, email, name, password_hash, created_at FROM users WHERE email = ? LIMIT 1",
    [email.toLowerCase().trim()],
  );

  const row = rows[0];
  if (!row) return null;

  return { ...toUser(row), passwordHash: row.password_hash };
}

export async function findUserById(id: number): Promise<User | null> {
  if (!isDatabaseConfigured()) return null;

  const db = getPool();
  const [rows] = await db.execute<UserRow[]>(
    "SELECT id, email, name, password_hash, created_at FROM users WHERE id = ? LIMIT 1",
    [id],
  );

  const row = rows[0];
  return row ? toUser(row) : null;
}

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
}): Promise<User> {
  const db = getPool();
  const passwordHash = await bcrypt.hash(input.password, 10);

  const [result] = await db.execute<ResultSetHeader>(
    "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
    [input.email.toLowerCase().trim(), passwordHash, input.name.trim()],
  );

  const user = await findUserById(result.insertId);
  if (!user) throw new Error("Failed to create user");

  return user;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function countUsers(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS count FROM users");
  return Number(rows[0]?.count ?? 0);
}
