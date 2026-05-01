import { Router } from "express";
import { logSignupToAirtable } from "../lib/airtable.js";
import { logger } from "../lib/logger.js";

export const signupRouter = Router();

signupRouter.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      topConcern,
      allConcerns,
      skinType,
      fitzpatrick,
      routineSize,
      entryPoint,
      sessionId,
    } = req.body || {};

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
    }

    // Fire-and-forget — don't block the response on Airtable
    logSignupToAirtable({
      name: String(name ?? "").slice(0, 200),
      email: String(email).toLowerCase().trim().slice(0, 200),
      topConcern: String(topConcern ?? "general").slice(0, 200),
      allConcerns: String(allConcerns ?? "").slice(0, 1000),
      skinType: skinType ?? null,
      fitzpatrick: fitzpatrick ?? null,
      routineSize: routineSize ?? null,
      entryPoint: entryPoint === "intro" ? "intro" : "result",
      sessionId: String(sessionId ?? "").slice(0, 100),
    }).catch((e) => logger.warn(`signup_log_error: ${e?.message ?? e}`));

    res.json({ ok: true });
  } catch (err: any) {
    logger.warn(`signup_error: ${err?.message ?? err}`);
    res.status(500).json({ ok: false });
  }
});