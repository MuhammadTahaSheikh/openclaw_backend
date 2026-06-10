import {
  getCategoryKeyword,
  getCategoryLabel,
  getCategoryMatchTerms,
  getCategorySearchKeywords,
  getCategoryStrictRelevance,
} from "../config/categories.js";
import type { Lead } from "../types/lead.js";
import { saveBotRunResult } from "../db/leads.repository.js";
import { isDatabaseConfigured } from "../db/index.js";
import { getPlatform } from "../platforms/index.js";
import type { BotRunBy, BotRunRequest, BotRunResult } from "../types/lead.js";
import { filterLeadsByDateRange, validateDateRange } from "../utils/date-range.js";
import { filterRelevantLeads } from "../utils/relevance.js";

function resolveKeyword(request: BotRunRequest): {
  keyword: string;
  category: string;
  searchKeywords: string[];
  matchTerms: string[];
  strictRelevance: boolean;
} {
  if (request.category) {
    return {
      keyword: getCategoryKeyword(request.category),
      category: getCategoryLabel(request.category),
      searchKeywords: getCategorySearchKeywords(request.category),
      matchTerms: getCategoryMatchTerms(request.category),
      strictRelevance: getCategoryStrictRelevance(request.category),
    };
  }

  const keyword = request.keyword?.trim();
  if (!keyword) {
    throw new Error("Category or keyword is required");
  }

  return {
    keyword,
    category: keyword,
    searchKeywords: [keyword],
    matchTerms: [keyword],
    strictRelevance: true,
  };
}

function resolveMaxPages(maxPages?: number): number {
  if (maxPages === undefined || maxPages === null) return 0;
  if (maxPages === 0) return 0;
  return Math.min(Math.max(maxPages, 1), 20);
}

export async function runLeadBot(
  request: BotRunRequest,
  runBy: BotRunBy | null = null,
): Promise<BotRunResult> {
  const { keyword, category, searchKeywords, matchTerms, strictRelevance } =
    resolveKeyword(request);
  const dateRange = {
    startDate: request.startDate?.trim() || undefined,
    endDate: request.endDate?.trim() || undefined,
  };

  validateDateRange(dateRange);

  const platform = getPlatform(request.platform);
  const maxPages = resolveMaxPages(request.maxPages);
  const runAt = new Date().toISOString();

  const scrapedLeads: Lead[] = [];
  const seenLeadIds = new Set<string>();
  let totalOnPlatform: number | null = null;
  let pagesScraped = 0;

  for (const searchKeyword of searchKeywords) {
    if (searchKeywords.length > 1) {
      console.log(`[bot] Searching "${searchKeyword}" for "${category}"...`);
    }

    const scrapeResult = await platform.scrape({
      keyword: searchKeyword,
      maxPages,
      onProgress: (message) => console.log(`[bot] ${message}`),
    });

    pagesScraped += scrapeResult.pagesScraped;
    if (scrapeResult.totalOnPlatform !== null) {
      totalOnPlatform = (totalOnPlatform ?? 0) + scrapeResult.totalOnPlatform;
    }

    for (const lead of scrapeResult.leads) {
      if (seenLeadIds.has(lead.id)) continue;
      seenLeadIds.add(lead.id);
      scrapedLeads.push({ ...lead, keyword });
    }
  }

  if (searchKeywords.length > 1) {
    console.log(
      `[bot] Merged ${scrapedLeads.length} unique jobs from ${searchKeywords.length} searches`,
    );
  }

  let relevantLeads = scrapedLeads;
  if (strictRelevance) {
    relevantLeads = filterRelevantLeads(scrapedLeads, matchTerms);
    console.log(
      `[bot] Strict relevance filter: ${relevantLeads.length} matching "${category}" from ${scrapedLeads.length} scraped`,
    );
  } else {
    console.log(
      `[bot] Using all ${scrapedLeads.length} platform results for "${category}" (platform keyword search)`,
    );
  }

  const leads = filterLeadsByDateRange(relevantLeads, dateRange);

  if (dateRange.startDate || dateRange.endDate) {
    console.log(
      `[bot] Date filter (${dateRange.startDate ?? "any"} → ${dateRange.endDate ?? "any"}): ${leads.length} of ${relevantLeads.length} leads match posted date`,
    );
  }

  const result: BotRunResult = {
    platform: platform.id,
    category,
    keyword,
    startDate: dateRange.startDate ?? null,
    endDate: dateRange.endDate ?? null,
    totalOnPlatform: totalOnPlatform,
    pagesScraped,
    totalScanned: scrapedLeads.length,
    totalRelevant: relevantLeads.length,
    totalFound: leads.length,
    savedToDatabase: 0,
    skippedDuplicates: 0,
    runBy,
    runAt,
    leads,
    scrapedAt: runAt,
  };

  if (runBy) {
    console.log(`[bot] Run by ${runBy.name} (${runBy.email}) at ${runAt}`);
  }

  if (isDatabaseConfigured()) {
    try {
      const { saved, skipped } = await saveBotRunResult(result, runBy);
      result.savedToDatabase = saved;
      result.skippedDuplicates = skipped;
      console.log(
        `[db] Saved ${saved} new leads to Hostinger MySQL${skipped > 0 ? `, skipped ${skipped} duplicates` : ""}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Database save failed";
      console.error(`[db] ${message}`);
      throw new Error(`Leads scraped but database save failed: ${message}`);
    }
  } else {
    console.warn("[db] Skipping save — database not configured");
  }

  return result;
}
