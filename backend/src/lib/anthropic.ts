import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { logger } from "./logger.js";

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export function isLive(): boolean {
  return process.env.MODE === "live" && !!client;
}

type ImagePayload = {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
};

/**
 * Call 1 — classifier (vision enabled). Strict schema.
 */
export async function callClassifier<T>(
  systemPrompt: string,
  userText: string,
  image: ImagePayload | null,
  schema: z.ZodSchema<T>
): Promise<T> {
  if (!client) throw new Error("Anthropic client not configured");

  const model = process.env.ANTHROPIC_MODEL_CLASSIFIER || "claude-sonnet-4-5";

  const content: (Anthropic.Messages.TextBlockParam | Anthropic.Messages.ImageBlockParam)[] = [];
  if (image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mediaType,
        data: image.base64,
      },
    });
  }
  content.push({
    type: "text",
    text: userText || "(no user text provided)",
  });

  return callWithRetry(
    async (extraSystemNote?: string) => {
      const res = await client.messages.create({
        model,
        max_tokens: 2000,
        temperature: 0.1,
        system: extraSystemNote ? `${systemPrompt}\n\n${extraSystemNote}` : systemPrompt,
        messages: [{ role: "user", content }],
      });
      const text = extractText(res);
      return parseJson<T>(text, schema);
    }
  );
}

/**
 * Call 2 — generator (text only). Temperature a touch higher for natural copy.
 */
export async function callGenerator<T>(
  systemPrompt: string,
  userPayload: unknown,
  schema: z.ZodSchema<T>
): Promise<T> {
  if (!client) throw new Error("Anthropic client not configured");

  const model = process.env.ANTHROPIC_MODEL_GENERATOR || "claude-haiku-4-5-20251001";

  return callWithRetry(
    async (extraSystemNote?: string) => {
      const res = await client.messages.create({
        model,
        max_tokens: 2000,
        temperature: 0.4,
        system: extraSystemNote ? `${systemPrompt}\n\n${extraSystemNote}` : systemPrompt,
        messages: [
          {
            role: "user",
            content: `Classifier JSON:\n${JSON.stringify(userPayload)}\n\nRespond in the required mode.`,
          },
        ],
      });
      const text = extractText(res);
      return parseJson<T>(text, schema);
    }
  );
}

async function callWithRetry<T>(
  fn: (extraSystemNote?: string) => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    logger.warn("first call failed, retrying", { error: e?.message });
    return await fn(
      "Your previous response did not match the required JSON schema. Return ONLY valid JSON matching the schema in this prompt. No prose. No markdown fences."
    );
  }
}

function extractText(res: Anthropic.Messages.Message): string {
  const block = res.content.find((c) => c.type === "text");
  if (!block || block.type !== "text") throw new Error("No text block in response");
  return block.text;
}

function parseJson<T>(text: string, schema: z.ZodSchema<T>): T {
  // Strip markdown fences if the model wrapped output in them
  let cleaned = text
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/\s*```\s*/g, "")
    .trim();

  // If there's any preamble or postamble, extract just the outer JSON object.
  // Find first '{' and matching last '}' — works for any prose surrounding it.
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Model returned non-JSON: ${cleaned.slice(0, 300)}`);
  }
  return schema.parse(parsed);
}
