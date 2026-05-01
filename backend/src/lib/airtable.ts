import { logger } from "./logger.js";

interface SignupPayload {
  name: string;
  email: string;
  topConcern: string;
  allConcerns: string; // formatted "acne_inflammatory (85%), dehydration (7%)"
  skinType: string | null;
  fitzpatrick: string | null;
  routineSize: string | null;
  entryPoint: "intro" | "result";
  sessionId: string;
}

/**
 * Posts a signup to Airtable. Fire-and-forget — never blocks the main response.
 * Logs errors but does not throw.
 */
export async function logSignupToAirtable(p: SignupPayload): Promise<void> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME;

  if (!apiKey || !baseId || !tableName) {
    logger.warn("airtable_not_configured");
    return;
  }

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;

  const body = {
    fields: {
      Name: p.name,
      Email: p.email,
      "Top Concern": p.topConcern,
      "All Concerns": p.allConcerns,
      "Skin Type": p.skinType ?? "",
      Fitzpatrick: p.fitzpatrick ?? "",
      "Routine Size": p.routineSize ?? "",
      "Entry Point": p.entryPoint,
      "Session ID": p.sessionId,
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn(`airtable_signup_failed: status=${res.status} body=${text.slice(0, 300)}`);
      return;
    }
    logger.info("airtable_signup_logged");
  } catch (err: any) {
    logger.warn(`airtable_signup_error: ${err?.message ?? err}`);
  }
}