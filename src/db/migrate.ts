import type { RowDataPacket } from "mysql2";
import type { Pool } from "mysql2/promise";

async function columnExists(db: Pool, table: string, column: string): Promise<boolean> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

export async function migrateMembersTable(db: Pool): Promise<void> {
  const columns: { name: string; sql: string }[] = [
    { name: "user_id", sql: "ADD COLUMN user_id INT NULL" },
    { name: "invite_token", sql: "ADD COLUMN invite_token VARCHAR(64) NULL UNIQUE" },
    { name: "invite_expires_at", sql: "ADD COLUMN invite_expires_at DATETIME NULL" },
    { name: "invite_status", sql: "ADD COLUMN invite_status ENUM('pending', 'accepted') NOT NULL DEFAULT 'pending'" },
  ];

  for (const col of columns) {
    if (!(await columnExists(db, "members", col.name))) {
      await db.execute(`ALTER TABLE members ${col.sql}`);
    }
  }

  try {
    await db.execute("ALTER TABLE members ADD UNIQUE KEY unique_member_email (email)");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("Duplicate") && !message.includes("duplicate")) {
      throw error;
    }
  }

  try {
    await db.execute(
      "ALTER TABLE members ADD CONSTRAINT fk_member_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("Duplicate") && !message.includes("already exists")) {
      throw error;
    }
  }
}
