import "dotenv/config";
import cors from "cors";
import express from "express";
import { initDatabase } from "./db/index.js";
import { authRouter } from "./routes/auth.routes.js";
import { botRouter } from "./routes/bot.routes.js";
import { categoriesRouter } from "./routes/categories.routes.js";
import { leadsRouter } from "./routes/leads.routes.js";
import { membersRouter } from "./routes/members.routes.js";
import { platformsRouter } from "./routes/platforms.routes.js";
import { trackerRouter } from "./routes/tracker.routes.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  res.json({ status: "ok", service: "openclaw-backend" });
});

app.get("/", (_req, res) => {
  res.json({
    message: "OpenClaw backend is running",
    endpoints: {
      platforms: "GET /api/platforms",
      categories: "GET /api/categories",
      leads: "GET /api/leads",
      runBot: "POST /api/bot/run (auth required)",
      botRuns: "GET /api/bot/runs (auth required)",
      login: "POST /api/auth/login",
      members: "GET/POST /api/members",
    },
  });
});

app.use("/api/auth", authRouter);
app.use("/api/platforms", platformsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/members", membersRouter);
app.use("/api/bot", botRouter);
app.use("/api/tracker", trackerRouter);

async function start() {
  await initDatabase();

  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
