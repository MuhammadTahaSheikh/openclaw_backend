import {
  getCategoryKeyword,
  getCategoryLabel,
  getCategoryMatchTerms,
  getCategoryStrictRelevance,
} from "../config/categories.js";
import { saveBotRunResult } from "../db/leads.repository.js";
import { isDatabaseConfigured } from "../db/index.js";
import { getPlatform } from "../platforms/index.js";
import type { BotRunRequest, BotRunResult } from "../types/lead.js";
import { filterLeadsByDateRange, validateDateRange } from "../utils/date-range.js";
import { filterRelevantLeads } from "../utils/relevance.js";

function resolveKeyword(request: BotRunRequest): {
  keyword: string;
  category: string;
  matchTerms: string[];
  strictRelevance: boolean;
} {
  if (request.category) {
    return {
      keyword: getCategoryKeyword(request.category),
      category: getCategoryLabel(request.category),
      matchTerms: getCategoryMatchTerms(request.category),
      strictRelevance: getCategoryStrictRelevance(request.category),
    };
  }

  const keyword = request.keyword?.trim();
  if (!keyword) {
    throw new Error("Category or keyword is required");
  }

  return { keyword, category: keyword, matchTerms: [keyword], strictRelevance: true };
}

function resolveMaxPages(maxPages?: number): number {
  if (maxPages === undefined || maxPages === null) return 0;
  if (maxPages === 0) return 0;
  return Math.min(Math.max(maxPages, 1), 20);
}

export async function runLeadBot(request: BotRunRequest): Promise<BotRunResult> {
  const { keyword, category, matchTerms, strictRelevance } = resolveKeyword(request);
  const dateRange = {
    startDate: request.startDate?.trim() || undefined,
    endDate: request.endDate?.trim() || undefined,
  };

  validateDateRange(dateRange);

  const platform = getPlatform(request.platform);
  const maxPages = resolveMaxPages(request.maxPages);

  const { leads: scrapedLeads, totalOnPlatform, pagesScraped } = await platform.scrape({
    keyword,
    maxPages,
    onProgress: (message) => console.log(`[bot] ${message}`),
  });

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
      `[bot] Date filter (${dateRange.startDate ?? "any"} → ${dateRange.endDate ?? "any"}): ${leads.length} leads`,
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
    leads,
    scrapedAt: new Date().toISOString(),
  };

  if (isDatabaseConfigured()) {
    try {
      const { saved, skipped } = await saveBotRunResult(result);
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
