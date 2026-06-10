import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Pool } from "mysql2/promise";
import { getPool, isDatabaseConfigured } from "../db/index.js";
import type { BotRunBy, BotRunDetail, BotRunHistoryItem, BotRunResult, Lead } from "../types/lead.js";

type LeadRow = RowDataPacket & {
  job_id: string;
  platform: string;
  category: string;
  keyword: string;
  title: string;
  employment_type: string | null;
  salary: string | null;
  posted_at: Date | null;
  description: string | null;
  skills: string | null;
  url: string;
};

type BotRunRow = RowDataPacket & {
  id: number;
  platform: string;
  category: string;
  keyword: string;
  start_date: Date | null;
  end_date: Date | null;
  total_scanned: number;
  total_relevant: number;
  total_found: number;
  scraped_at: Date;
  run_by_user_id: number | null;
  run_by_member_id: number | null;
  run_by_name: string | null;
  run_by_email: string | null;
};

function mapLeadRow(row: LeadRow): Lead {
  return {
    id: row.job_id,
    platform: row.platform,
    title: row.title,
    employmentType: row.employment_type,
    salary: row.salary,
    postedAt: row.posted_at
      ? new Date(row.posted_at).toISOString().slice(0, 19).replace("T", " ")
      : null,
    description: row.description,
    skills: row.skills ? (JSON.parse(row.skills) as string[]) : [],
    url: row.url,
    keyword: row.keyword,
  };
}

async function getLeadDbId(db: Pool, platform: string, jobId: string): Promise<number | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id FROM leads WHERE platform = ? AND job_id = ? LIMIT 1",
    [platform, jobId],
  );
  return rows[0]?.id ? Number(rows[0].id) : null;
}

async function linkLeadToBotRun(db: Pool, botRunId: number, leadDbId: number): Promise<void> {
  await db.execute(
    "INSERT IGNORE INTO bot_run_leads (bot_run_id, lead_db_id) VALUES (?, ?)",
    [botRunId, leadDbId],
  );
}

function mapBotRunRow(row: BotRunRow): BotRunHistoryItem {
  return {
    id: row.id,
    platform: row.platform,
    category: row.category,
    keyword: row.keyword,
    startDate: row.start_date ? new Date(row.start_date).toISOString().slice(0, 10) : null,
    endDate: row.end_date ? new Date(row.end_date).toISOString().slice(0, 10) : null,
    totalFound: row.total_found,
    totalScanned: row.total_scanned,
    totalRelevant: row.total_relevant,
    runBy:
      row.run_by_name || row.run_by_email
        ? {
            userId: row.run_by_user_id ?? 0,
            memberId: row.run_by_member_id,
            name: row.run_by_name ?? "Unknown",
            email: row.run_by_email ?? "",
          }
        : null,
    runAt: new Date(row.scraped_at).toISOString(),
  };
}

function parsePostedAt(postedAt: string | null): string | null {
  if (!postedAt) return null;

  const match = postedAt.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}:\d{2}))?/);
  if (!match) return null;

  return match[2] ? `${match[1]} ${match[2]}` : `${match[1]} 00:00:00`;
}

function toMysqlDatetime(iso: string): string {
  return iso.slice(0, 19).replace("T", " ");
}

export async function saveBotRunResult(
  result: BotRunResult,
  runBy: BotRunBy | null,
): Promise<{ saved: number; skipped: number }> {
  if (!isDatabaseConfigured()) return { saved: 0, skipped: 0 };

  const db = getPool();

  const [runInsert] = await db.execute<ResultSetHeader>(
    `INSERT INTO bot_runs
      (platform, category, keyword, start_date, end_date, total_scanned, total_relevant, total_found, scraped_at,
       run_by_user_id, run_by_member_id, run_by_name, run_by_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      result.platform,
      result.category,
      result.keyword,
      result.startDate,
      result.endDate,
      result.totalScanned,
      result.totalRelevant,
      result.totalFound,
      toMysqlDatetime(result.scrapedAt),
      runBy?.userId ?? null,
      runBy?.memberId ?? null,
      runBy?.name ?? null,
      runBy?.email ?? null,
    ],
  );

  const botRunId = runInsert.insertId;
  let saved = 0;
  let skipped = 0;

  for (const lead of result.leads) {
    const [insertResult] = await db.execute<ResultSetHeader>(
      `INSERT IGNORE INTO leads
        (job_id, platform, category, keyword, title, employment_type, salary, posted_at, description, skills, url, bot_run_id, scraped_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lead.id,
        lead.platform,
        result.category,
        lead.keyword,
        lead.title.slice(0, 500),
        lead.employmentType,
        lead.salary,
        parsePostedAt(lead.postedAt),
        lead.description,
        JSON.stringify(lead.skills),
        lead.url.slice(0, 500),
        botRunId,
        toMysqlDatetime(result.scrapedAt),
      ],
    );

    if (insertResult.affectedRows === 1) {
      saved += 1;
    } else {
      skipped += 1;
    }

    const leadDbId = await getLeadDbId(db, lead.platform, lead.id);
    if (leadDbId) {
      await linkLeadToBotRun(db, botRunId, leadDbId);
    }
  }

  return { saved, skipped };
}

export async function getBotRunHistory(limit = 50): Promise<BotRunHistoryItem[]> {
  if (!isDatabaseConfigured()) return [];

  const db = getPool();
  const safeLimit = Math.min(Math.max(limit, 1), 200);

  const [rows] = await db.execute<BotRunRow[]>(
    `SELECT id, platform, category, keyword, start_date, end_date,
            total_scanned, total_relevant, total_found, scraped_at,
            run_by_user_id, run_by_member_id, run_by_name, run_by_email
     FROM bot_runs
     ORDER BY scraped_at DESC, id DESC
     LIMIT ${safeLimit}`,
  );

  return rows.map(mapBotRunRow);
}

export async function getBotRunById(runId: number): Promise<BotRunDetail | null> {
  if (!isDatabaseConfigured()) return null;

  const db = getPool();

  const [runRows] = await db.execute<BotRunRow[]>(
    `SELECT id, platform, category, keyword, start_date, end_date,
            total_scanned, total_relevant, total_found, scraped_at,
            run_by_user_id, run_by_member_id, run_by_name, run_by_email
     FROM bot_runs WHERE id = ? LIMIT 1`,
    [runId],
  );

  const runRow = runRows[0];
  if (!runRow) return null;

  const [leadRows] = await db.execute<LeadRow[]>(
    `SELECT l.job_id, l.platform, l.category, l.keyword, l.title, l.employment_type,
            l.salary, l.posted_at, l.description, l.skills, l.url
     FROM leads l
     INNER JOIN bot_run_leads brl ON brl.lead_db_id = l.id
     WHERE brl.bot_run_id = ?
     ORDER BY l.posted_at DESC, l.id DESC`,
    [runId],
  );

  let leads = leadRows.map(mapLeadRow);

  if (leads.length === 0) {
    const [fallbackRows] = await db.execute<LeadRow[]>(
      `SELECT job_id, platform, category, keyword, title, employment_type, salary,
              posted_at, description, skills, url
       FROM leads
       WHERE bot_run_id = ?
       ORDER BY posted_at DESC, id DESC`,
      [runId],
    );
    leads = fallbackRows.map(mapLeadRow);
  }

  return {
    ...mapBotRunRow(runRow),
    leads,
  };
}

export type LeadQuery = {
  platform?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
};

export async function getStoredLeads(query: LeadQuery = {}): Promise<Lead[]> {
  if (!isDatabaseConfigured()) return [];

  const db = getPool();
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (query.platform) {
    conditions.push("platform = ?");
    params.push(query.platform);
  }

  if (query.category) {
    conditions.push("category = ?");
    params.push(query.category);
  }

  if (query.startDate) {
    conditions.push("DATE(posted_at) >= ?");
    params.push(query.startDate);
  }

  if (query.endDate) {
    conditions.push("DATE(posted_at) <= ?");
    params.push(query.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);

  const [rows] = await db.execute<LeadRow[]>(
    `SELECT job_id, platform, category, keyword, title, employment_type, salary, posted_at, description, skills, url
     FROM leads
     ${whereClause}
     ORDER BY posted_at DESC, id DESC
     LIMIT ${limit}`,
    params,
  );

  return rows.map(mapLeadRow);
}
