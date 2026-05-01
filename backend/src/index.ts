import "dotenv/config";
import express from "express";
import cors from "cors";
import { adviseRouter } from "./routes/advise.js";
import { signupRouter } from "./routes/signup.js";
import { productsRouter, bundlesRouter, feedbackRouter, healthRouter } from "./routes/misc.js";
import { logger } from "./lib/logger.js";

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://localhost:4173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl, health checks
      // allow *.myshopify.com wildcard
      if (allowedOrigins.some((a) => origin === a || matchesWildcard(origin, a))) {
        return cb(null, true);
      }
      return cb(new Error("Origin not allowed"), false);
    },
    credentials: false,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api/health", healthRouter);
app.use("/api/products", productsRouter);
app.use("/api/bundles", bundlesRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/advise", adviseRouter);
app.use("/api/signup", signupRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("unhandled_error", { message: err?.message });
  res.status(500).json({ error: "internal_error" });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  logger.info("backend_ready", {
    port,
    mode: process.env.MODE === "live" ? "live" : "demo",
    hasKey: !!process.env.ANTHROPIC_API_KEY,
  });
  // Friendly human-readable note on stdout
  // eslint-disable-next-line no-console
  console.log(`\n  Qunat Advisor backend  http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`  Mode: ${process.env.MODE === "live" ? "LIVE (Anthropic)" : "DEMO (heuristics)"}\n`);
});

function matchesWildcard(origin: string, pattern: string): boolean {
  if (!pattern.includes("*")) return false;
  const re = new RegExp(
    "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"
  );
  return re.test(origin);
}
