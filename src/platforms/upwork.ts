import type { Lead } from "../types/lead.js";
import type { PlatformScraper, ScrapeOptions, ScrapeResult } from "./types.js";

const APIFY_ACTOR = "nahom.network~upwork-job-finder";
const APIFY_BASE = "https://api.apify.com/v2";
const MAX_PAGES_CAP = 10;
const REQUEST_TIMEOUT_MS = 300_000;

type UpworkJob = {
  uid?: string;
  ciphertext?: string;
  title?: string;
  description?: string;
  type?: number;
  durationLabel?: string;
  tierText?: string;
  amount?: { amount?: number };
  hourlyBudget?: { min?: number; max?: number };
  publishedOn?: string;
  attrs?: { prefLabel?: string }[];
};

function getApifyToken(): string {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "Upwork scraping requires APIFY_TOKEN in backend/.env. Get a token at https://console.apify.com/account/integrations",
    );
  }
  return token;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function formatSalary(job: UpworkJob): string | null {
  if (job.type === 2 && job.hourlyBudget) {
    const { min, max } = job.hourlyBudget;
    if (min && max) return `$${min}-$${max}/hr`;
    if (min) return `$${min}/hr`;
    if (max) return `$${max}/hr`;
  }

  if (job.amount?.amount) {
    return `$${job.amount.amount}`;
  }

  return null;
}

function formatEmploymentType(job: UpworkJob): string | null {
  const typeLabel =
    job.type === 1 ? "Fixed-price" : job.type === 2 ? "Hourly" : null;
  const tier = job.tierText?.match(/Entry|Intermediate|Expert/i)?.[0];
  const parts = [typeLabel, job.durationLabel, tier].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatPostedAt(iso: string | undefined): string | null {
  if (!iso) return null;
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : iso;
}

function mapJob(job: UpworkJob, keyword: string): Lead | null {
  const rawId = job.uid ?? job.ciphertext?.replace(/^~/, "");
  if (!rawId || !job.title) return null;

  const ciphertext = job.ciphertext?.replace(/^~/, "") ?? rawId;

  return {
    id: rawId,
    platform: "upwork",
    title: stripHtml(job.title),
    employmentType: formatEmploymentType(job),
    salary: formatSalary(job),
    postedAt: formatPostedAt(job.publishedOn),
    description: job.description ? stripHtml(job.description) : null,
    skills: (job.attrs ?? [])
      .map((attr) => attr.prefLabel?.trim())
      .filter((skill): skill is string => Boolean(skill)),
    url: `https://www.upwork.com/jobs/~${ciphertext}`,
    keyword,
  };
}

async function fetchJobsFromApify(
  keyword: string,
  pageStart: number,
  pageEnd: number,
): Promise<UpworkJob[]> {
  const token = getApifyToken();
  const url = `${APIFY_BASE}/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`;

  const body: Record<string, unknown> = { query: keyword };
  if (pageStart === pageEnd) {
    body.page = pageStart;
  } else {
    body.pageStart = pageStart;
    body.pageEnd = pageEnd;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Apify Upwork scrape failed (${response.status}): ${text.slice(0, 300)}`,
    );
  }

  const items = (await response.json()) as unknown;
  if (!Array.isArray(items)) {
    throw new Error("Apify returned unexpected response format");
  }

  return items as UpworkJob[];
}

async function fetchAllPages(keyword: string, pageLimit: number): Promise<UpworkJob[]> {
  if (pageLimit <= 1) {
    return fetchJobsFromApify(keyword, 1, 1);
  }

  try {
    return await fetchJobsFromApify(keyword, 1, pageLimit);
  } catch {
    const jobs: UpworkJob[] = [];

    for (let page = 1; page <= pageLimit; page += 1) {
      const pageJobs = await fetchJobsFromApify(keyword, page, page);
      if (pageJobs.length === 0) break;
      jobs.push(...pageJobs);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return jobs;
  }
}

async function scrape(options: ScrapeOptions): Promise<ScrapeResult> {
  const { keyword, maxPages = 0, onProgress } = options;
  const trimmedKeyword = keyword.trim();
  if (!trimmedKeyword) {
    throw new Error("Keyword is required");
  }

  const pageLimit =
    maxPages === 0 ? MAX_PAGES_CAP : Math.min(Math.max(maxPages, 1), MAX_PAGES_CAP);

  onProgress?.(`Searching Upwork for "${trimmedKeyword}"...`);

  const jobs = await fetchAllPages(trimmedKeyword, pageLimit);

  const leads: Lead[] = [];
  const seenIds = new Set<string>();

  for (const job of jobs) {
    const lead = mapJob(job, trimmedKeyword);
    if (!lead || seenIds.has(lead.id)) continue;
    seenIds.add(lead.id);
    leads.push(lead);
  }

  onProgress?.(
    `Found ${leads.length} jobs across ${pageLimit} page(s) (Upwork max ${MAX_PAGES_CAP} pages)`,
  );

  return {
    leads,
    totalOnPlatform: leads.length > 0 ? leads.length : null,
    pagesScraped: pageLimit,
  };
}

export const upworkScraper: PlatformScraper = {
  id: "upwork",
  name: "Upwork",
  description:
    "Global freelance marketplace — search by skill or job title (requires Apify token)",
  scrape,
};
