import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool, isDatabaseConfigured } from "../db/index.js";
import type { BotRunResult, Lead } from "../types/lead.js";

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
): Promise<{ saved: number; skipped: number }> {
  if (!isDatabaseConfigured()) return { saved: 0, skipped: 0 };

  const db = getPool();

  const [runInsert] = await db.execute<ResultSetHeader>(
    `INSERT INTO bot_runs
      (platform, category, keyword, start_date, end_date, total_scanned, total_relevant, total_found, scraped_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  }

  return { saved, skipped };
}

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

  return rows.map((row) => ({
    id: row.job_id,
    platform: row.platform,
    title: row.title,
    employmentType: row.employment_type,
    salary: row.salary,
    postedAt: row.posted_at ? new Date(row.posted_at).toISOString().slice(0, 19).replace("T", " ") : null,
    description: row.description,
    skills: row.skills ? (JSON.parse(row.skills) as string[]) : [],
    url: row.url,
    keyword: row.keyword,
  }));
}
