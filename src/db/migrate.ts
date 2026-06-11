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

export async function migrateBotRunsTable(db: Pool): Promise<void> {
  const columns: { name: string; sql: string }[] = [
    { name: "run_by_user_id", sql: "ADD COLUMN run_by_user_id INT NULL" },
    { name: "run_by_member_id", sql: "ADD COLUMN run_by_member_id INT NULL" },
    { name: "run_by_name", sql: "ADD COLUMN run_by_name VARCHAR(255) NULL" },
    { name: "run_by_email", sql: "ADD COLUMN run_by_email VARCHAR(255) NULL" },
  ];

  for (const col of columns) {
    if (!(await columnExists(db, "bot_runs", col.name))) {
      await db.execute(`ALTER TABLE bot_runs ${col.sql}`);
    }
  }

  try {
    await db.execute(
      "ALTER TABLE bot_runs ADD CONSTRAINT fk_bot_run_user FOREIGN KEY (run_by_user_id) REFERENCES users(id) ON DELETE SET NULL",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("Duplicate") && !message.includes("already exists")) {
      throw error;
    }
  }

  try {
    await db.execute(
      "ALTER TABLE bot_runs ADD CONSTRAINT fk_bot_run_member FOREIGN KEY (run_by_member_id) REFERENCES members(id) ON DELETE SET NULL",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("Duplicate") && !message.includes("already exists")) {
      throw error;
    }
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS bot_run_leads (
      bot_run_id INT NOT NULL,
      lead_db_id INT NOT NULL,
      PRIMARY KEY (bot_run_id, lead_db_id),
      CONSTRAINT fk_brl_run FOREIGN KEY (bot_run_id) REFERENCES bot_runs(id) ON DELETE CASCADE,
      CONSTRAINT fk_brl_lead FOREIGN KEY (lead_db_id) REFERENCES leads(id) ON DELETE CASCADE
    )
  `);
}

export async function migrateUsersTable(db: Pool): Promise<void> {
  if (!(await columnExists(db, "users", "role"))) {
    await db.execute(
      "ALTER TABLE users ADD COLUMN role ENUM('admin', 'member') NOT NULL DEFAULT 'member'",
    );
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail) {
    await db.execute("UPDATE users SET role = 'admin' WHERE LOWER(email) = ?", [adminEmail]);
  }

  // Members with role "Admin" get app admin access (see all lead trackers).
  await db.execute(`
    UPDATE users u
    INNER JOIN members m ON m.user_id = u.id
    SET u.role = 'admin'
    WHERE LOWER(TRIM(m.role)) = 'admin'
  `);

  const [adminRows] = await db.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'admin'",
  );
  const adminCount = Number(adminRows[0]?.count ?? 0);
  if (adminCount === 0) {
    await db.execute(
      "UPDATE users SET role = 'admin' WHERE id = (SELECT MIN(id) FROM (SELECT id FROM users) AS u)",
    );
  }
}

export async function migrateTrackerTable(db: Pool): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_tracker_rows (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      row_date DATE NULL,
      name VARCHAR(255) NULL,
      job_title VARCHAR(500) NULL,
      employment_type VARCHAR(50) NULL,
      email VARCHAR(255) NULL,
      linkedin VARCHAR(500) NULL,
      phone VARCHAR(50) NULL,
      source VARCHAR(255) NULL,
      remarks TEXT NULL,
      connects VARCHAR(100) NULL,
      project_price VARCHAR(100) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tracker_user (user_id),
      CONSTRAINT fk_tracker_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  if (!(await columnExists(db, "user_tracker_rows", "employment_type"))) {
    await db.execute(
      "ALTER TABLE user_tracker_rows ADD COLUMN employment_type VARCHAR(50) NULL AFTER job_title",
    );
  }
}
