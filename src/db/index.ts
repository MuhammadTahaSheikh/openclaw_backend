import mysql from "mysql2/promise";
import { migrateMembersTable } from "./migrate.js";
import { seedAdminUser } from "./seed.js";

let pool: mysql.Pool | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(
    process.env.DB_HOST &&
      process.env.DB_USER &&
      process.env.DB_PASSWORD &&
      process.env.DB_NAME,
  );
}

export function getPool(): mysql.Pool {
  if (!isDatabaseConfigured()) {
    throw new Error("Database is not configured. Set DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME in .env");
  }

  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    });
  }

  return pool;
}

export async function initDatabase(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.warn("[db] Database not configured — leads will not be saved. Copy .env.example to .env");
    return;
  }

  const db = getPool();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS bot_runs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      platform VARCHAR(50) NOT NULL,
      category VARCHAR(100) NOT NULL,
      keyword VARCHAR(100) NOT NULL,
      start_date DATE NULL,
      end_date DATE NULL,
      total_scanned INT NOT NULL DEFAULT 0,
      total_relevant INT NOT NULL DEFAULT 0,
      total_found INT NOT NULL DEFAULT 0,
      scraped_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS leads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job_id VARCHAR(50) NOT NULL,
      platform VARCHAR(50) NOT NULL,
      category VARCHAR(100) NOT NULL,
      keyword VARCHAR(100) NOT NULL,
      title VARCHAR(500) NOT NULL,
      employment_type VARCHAR(50) NULL,
      salary VARCHAR(100) NULL,
      posted_at DATETIME NULL,
      description TEXT NULL,
      skills JSON NULL,
      url VARCHAR(500) NOT NULL,
      bot_run_id INT NULL,
      scraped_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_lead (platform, job_id),
      INDEX idx_category (category),
      INDEX idx_posted_at (posted_at),
      CONSTRAINT fk_bot_run FOREIGN KEY (bot_run_id) REFERENCES bot_runs(id) ON DELETE SET NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NULL,
      role VARCHAR(100) NULL,
      notes TEXT NULL,
      created_by INT NULL,
      user_id INT NULL,
      invite_token VARCHAR(64) NULL UNIQUE,
      invite_expires_at DATETIME NULL,
      invite_status ENUM('pending', 'accepted') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_member_email (email),
      INDEX idx_member_email (email),
      CONSTRAINT fk_member_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_member_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await migrateMembersTable(db);

  await seedAdminUser();

  console.log("[db] Connected and tables ready");
}

export async function testDatabaseConnection(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;

  const db = getPool();
  await db.query("SELECT 1");
  return true;
}
