import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2";
import { getPool } from "./index.js";

export async function seedAdminUser(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) return;

  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS count FROM users");

  if (Number(rows[0]?.count ?? 0) > 0) return;

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await db.execute(
    "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
    [adminEmail.toLowerCase().trim(), passwordHash, process.env.ADMIN_NAME?.trim() || "Admin"],
  );

  console.log(`[db] Seeded admin user: ${adminEmail}`);
}
