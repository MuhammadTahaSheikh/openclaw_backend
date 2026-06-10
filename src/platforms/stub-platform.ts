import type { PlatformScraper, ScrapeOptions, ScrapeResult } from "./types.js";

export function createStubPlatform(
  id: string,
  name: string,
  description: string,
): PlatformScraper {
  return {
    id,
    name,
    description,
    async scrape(_options: ScrapeOptions): Promise<ScrapeResult> {
      throw new Error(
        `${name} scraping is coming soon. Only OnlineJobs.ph is fully supported right now.`,
      );
    },
  };
}
