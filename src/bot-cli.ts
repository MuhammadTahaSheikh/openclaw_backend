import "dotenv/config";
import { listCategories } from "./config/categories.js";
import { listPlatforms } from "./platforms/index.js";
import { runLeadBot } from "./services/bot.service.js";

function printUsage() {
  console.log(`
OpenClaw Lead Bot

Usage:
  npm run bot -- --platform <id> --category <id> [--pages 3]
  npm run bot -- --platform <id> --keyword "<search term>" [--pages 3]

Options:
  --platform   Platform id (required)
  --category   Category id (required unless --keyword is used)
  --keyword    Custom search term (optional alternative to --category)
  --start      Start date filter YYYY-MM-DD (optional)
  --end        End date filter YYYY-MM-DD (optional)
  --pages      Max pages to scrape (default: 3, max: 10)

Available platforms:
${listPlatforms()
  .map((platform) => `  - ${platform.id}: ${platform.name}`)
  .join("\n")}

Available categories:
${listCategories()
  .map((category) => `  - ${category.id}: ${category.label}`)
  .join("\n")}
`);
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = "true";
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    printUsage();
    return;
  }

  const platform = args.platform;
  const category = args.category;
  const keyword = args.keyword;
  const maxPages = args.pages ? Number(args.pages) : undefined;
  const startDate = args.start;
  const endDate = args.end;

  if (!platform || (!category && !keyword)) {
    printUsage();
    process.exit(1);
  }

  const label = category ?? keyword;
  const dateLabel =
    startDate || endDate ? ` (${startDate ?? "any"} → ${endDate ?? "any"})` : "";
  console.log(`Running lead bot on ${platform} for "${label}"${dateLabel}...\n`);

  const result = await runLeadBot({
    platform,
    category,
    keyword,
    maxPages,
    startDate,
    endDate,
  });

  console.log(
    `\nDone! Found ${result.totalFound} ${result.category} leads (${result.totalRelevant} relevant, ${result.totalScanned} scanned).`,
  );

  if (result.savedToDatabase > 0 || result.skippedDuplicates > 0) {
    console.log(
      `Saved ${result.savedToDatabase} new leads${result.skippedDuplicates > 0 ? `, skipped ${result.skippedDuplicates} duplicates` : ""}.\n`,
    );
  } else {
    console.log("");
  }

  for (const lead of result.leads) {
    console.log(`- ${lead.title}`);
    console.log(`  Type: ${lead.employmentType ?? "N/A"} | Salary: ${lead.salary ?? "N/A"}`);
    console.log(`  Posted: ${lead.postedAt ?? "N/A"}`);
    console.log(`  URL: ${lead.url}`);
    if (lead.skills.length > 0) {
      console.log(`  Skills: ${lead.skills.join(", ")}`);
    }
    console.log("");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
