export type Lead = {
  id: string;
  platform: string;
  title: string;
  employmentType: string | null;
  salary: string | null;
  postedAt: string | null;
  description: string | null;
  skills: string[];
  url: string;
  keyword: string;
};

export type BotRunRequest = {
  platform: string;
  category?: string;
  keyword?: string;
  maxPages?: number;
  startDate?: string;
  endDate?: string;
};

export type BotRunResult = {
  platform: string;
  category: string;
  keyword: string;
  startDate: string | null;
  endDate: string | null;
  totalOnPlatform: number | null;
  pagesScraped: number;
  totalScanned: number;
  totalRelevant: number;
  totalFound: number;
  savedToDatabase: number;
  skippedDuplicates: number;
  leads: Lead[];
  scrapedAt: string;
};
