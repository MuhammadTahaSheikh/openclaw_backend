import cors from "cors";
import express from "express";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "openclaw-backend" });
});

app.get("/", (_req, res) => {
  res.json({ message: "OpenClaw backend is running" });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
