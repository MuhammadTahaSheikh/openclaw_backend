# OpenClaw Backend

Express + TypeScript API and lead scraping bot for OpenClaw.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your Hostinger MySQL credentials
npm run dev
```

## Hostinger MySQL

1. Create the database in hPanel (Databases → Management)
2. Copy `.env.example` to `.env` and fill in:

```env
DB_HOST=your-mysql-host.hstgr.io
DB_NAME=u916710688_openclaw
DB_USER=u916710688_openclaw_ai
DB_PASSWORD=your_password
```

3. In hPanel → **Remote MySQL**, allow your IP if connecting from your local machine
4. Find the MySQL hostname in hPanel (Databases → your database details)

Tables are created automatically on server start (`bot_runs`, `leads`).

## Lead Bot (CLI)

```bash
npm run bot -- --platform onlinejobs-ph --category bookkeeping --start 2026-06-10 --end 2026-06-10
```

## API

- `GET /api/platforms` — list supported platforms
- `GET /api/categories` — list job categories
- `GET /api/leads` — fetch stored leads from MySQL
- `POST /api/bot/run` — scrape leads and save to MySQL

```json
{
  "platform": "onlinejobs-ph",
  "category": "bookkeeping",
  "startDate": "2026-06-01",
  "endDate": "2026-06-10",
  "maxPages": 3
}
```

Response includes `savedToDatabase` with the number of leads written to MySQL.

## Scripts

- `npm run dev` — start dev server on port 3000
- `npm run bot` — run lead bot from CLI
- `npm run build` — compile TypeScript
- `npm start` — run compiled server
