import type { Lead } from "../types/lead.js";

export type PlatformInfo = {
  id: string;
  name: string;
  description: string;
};

export type ScrapeOptions = {
  keyword: string;
  /** 0 = scrape all available pages on the platform */
  maxPages?: number;
  onProgress?: (message: string) => void;
};

export type ScrapeResult = {
  leads: Lead[];
  totalOnPlatform: number | null;
  pagesScraped: number;
};

export type PlatformScraper = PlatformInfo & {
  scrape: (options: ScrapeOptions) => Promise<ScrapeResult>;
};
