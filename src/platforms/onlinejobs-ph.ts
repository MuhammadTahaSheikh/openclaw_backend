import * as cheerio from "cheerio";
import type { Lead } from "../types/lead.js";
import type { PlatformScraper, ScrapeOptions, ScrapeResult } from "./types.js";

const BASE_URL = "https://www.onlinejobs.ph";
const JOBS_PER_PAGE = 30;
const MAX_PAGES_CAP = 20;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function buildSearchUrl(keyword: string, offset = 0): string {
  const params = new URLSearchParams({ jobkeyword: keyword });
  if (offset > 0) {
    return `${BASE_URL}/jobseekers/jobsearch/${offset}?${params.toString()}`;
  }
  return `${BASE_URL}/jobseekers/jobsearch?${params.toString()}`;
}

function parseTotalJobs(html: string): number | null {
  const match = html.match(/Displaying\s+\d+\s+out\s+of\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function extractJobId(url: string): string {
  const trailingId = url.match(/-(\d+)(?:\/|$|\?)?$/);
  if (trailingId) return trailingId[1];

  const numericPath = url.match(/\/(\d+)(?:\/|$|\?)/);
  return numericPath?.[1] ?? url;
}

function parseListingPage(html: string, keyword: string): Lead[] {
  const $ = cheerio.load(html);
  const leads: Lead[] = [];

  $(".jobpost-cat-box").each((_index, element) => {
    const card = $(element);
    const anchor = card.closest("a[href*='/jobseekers/job/']");
    const href =
      anchor.attr("href") ??
      card.find("a[href*='/jobseekers/job/']").first().attr("href");

    if (!href) return;

    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    const title = card.find("h4").first().clone().children("span").remove().end().text().trim();
    if (!title) return;

    const employmentType =
      card.find("h4 .badge").first().text().trim() || null;
    const postedAt =
      card.find("em").first().text().replace(/^Posted on\s+/i, "").trim() || null;
    const salary = card.find("dl.row dd.col").first().text().trim() || null;
    const description = card
      .find(".desc")
      .first()
      .text()
      .replace(/\s*See More\s*$/i, "")
      .trim() || null;

    const skills = card
      .find(".job-tag .badge")
      .map((_i, skill) => $(skill).text().trim())
      .get()
      .filter(Boolean);

    const id = extractJobId(url);
    if (leads.some((lead) => lead.id === id)) return;

    leads.push({
      id,
      platform: "onlinejobs-ph",
      title,
      employmentType,
      salary,
      postedAt,
      description,
      skills,
      url,
      keyword,
    });
  });

  return leads;
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function scrape(options: ScrapeOptions): Promise<ScrapeResult> {
  const { keyword, maxPages = 0, onProgress } = options;
  const trimmedKeyword = keyword.trim();
  if (!trimmedKeyword) {
    throw new Error("Keyword is required");
  }

  const allLeads: Lead[] = [];
  const seenIds = new Set<string>();

  onProgress?.(`Searching OnlineJobs.ph for "${trimmedKeyword}"...`);

  const firstPageHtml = await fetchPage(buildSearchUrl(trimmedKeyword));
  const totalJobs = parseTotalJobs(firstPageHtml);
  const firstPageLeads = parseListingPage(firstPageHtml, trimmedKeyword);

  for (const lead of firstPageLeads) {
    if (!seenIds.has(lead.id)) {
      seenIds.add(lead.id);
      allLeads.push(lead);
    }
  }

  onProgress?.(
    `Page 1: found ${firstPageLeads.length} jobs${totalJobs ? ` (${totalJobs} total on platform)` : ""}`,
  );

  const platformPages = totalJobs !== null ? Math.ceil(totalJobs / JOBS_PER_PAGE) : MAX_PAGES_CAP;
  const pageLimit =
    maxPages === 0
      ? Math.min(platformPages, MAX_PAGES_CAP)
      : Math.min(maxPages, platformPages, MAX_PAGES_CAP);

  for (let page = 2; page <= pageLimit; page += 1) {
    const offset = (page - 1) * JOBS_PER_PAGE;
    onProgress?.(`Fetching page ${page}/${pageLimit}...`);

    const html = await fetchPage(buildSearchUrl(trimmedKeyword, offset));
    const pageLeads = parseListingPage(html, trimmedKeyword);

    if (pageLeads.length === 0) break;

    for (const lead of pageLeads) {
      if (!seenIds.has(lead.id)) {
        seenIds.add(lead.id);
        allLeads.push(lead);
      }
    }

    onProgress?.(`Page ${page}: found ${pageLeads.length} jobs (${allLeads.length} total collected)`);

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return {
    leads: allLeads,
    totalOnPlatform: totalJobs,
    pagesScraped: pageLimit,
  };
}

export const onlineJobsPhScraper: PlatformScraper = {
  id: "onlinejobs-ph",
  name: "OnlineJobs.ph",
  description: "Filipino remote job board — search by job title or skill keyword",
  scrape,
};
