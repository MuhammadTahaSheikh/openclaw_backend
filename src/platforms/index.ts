import { createStubPlatform } from "./stub-platform.js";
import { onlineJobsPhScraper } from "./onlinejobs-ph.js";
import { upworkScraper } from "./upwork.js";
import type { PlatformScraper } from "./types.js";

const ENABLED_PLATFORMS = new Set(["onlinejobs-ph", "upwork"]);

export const linkedInScraper = createStubPlatform(
  "linkedin",
  "LinkedIn",
  "Professional network — job posts and lead search (coming soon)",
);

export const fiverrScraper = createStubPlatform(
  "fiverr",
  "Fiverr",
  "Freelance gigs and buyer requests (coming soon)",
);

export const remoteJobScraper = createStubPlatform(
  "remotejob",
  "Remote Job",
  "Remote job boards and work-from-home listings (coming soon)",
);

const platforms: PlatformScraper[] = [
  onlineJobsPhScraper,
  linkedInScraper,
  upworkScraper,
  fiverrScraper,
  remoteJobScraper,
];

export function listPlatforms() {
  return platforms.map(({ id, name, description }) => ({
    id,
    name,
    description,
    enabled: ENABLED_PLATFORMS.has(id),
  }));
}

export function getPlatform(id: string): PlatformScraper {
  const platform = platforms.find((item) => item.id === id);
  if (!platform) {
    throw new Error(`Unknown platform: ${id}`);
  }
  return platform;
}
