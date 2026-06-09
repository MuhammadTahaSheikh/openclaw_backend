import { onlineJobsPhScraper } from "./onlinejobs-ph.js";
import type { PlatformScraper } from "./types.js";

const platforms: PlatformScraper[] = [onlineJobsPhScraper];

export function listPlatforms() {
  return platforms.map(({ id, name, description }) => ({ id, name, description }));
}

export function getPlatform(id: string): PlatformScraper {
  const platform = platforms.find((item) => item.id === id);
  if (!platform) {
    throw new Error(`Unknown platform: ${id}`);
  }
  return platform;
}
