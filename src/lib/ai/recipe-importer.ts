import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { ApiError } from "@/lib/api";

const recipeSchema = z.object({
  name: z.string().min(1).max(120),
  servings: z.number().positive().max(100).catch(1),
  ingredients: z.array(z.string().max(200)).max(60).default([]),
  perServing: z.object({
    calories: z.number().nonnegative(),
    proteinG: z.number().nonnegative(),
    carbsG: z.number().nonnegative(),
    fatG: z.number().nonnegative(),
    fiberG: z.number().nonnegative().nullish(),
    sugarG: z.number().nonnegative().nullish(),
    satFatG: z.number().nonnegative().nullish(),
    sodiumMg: z.number().nonnegative().nullish(),
  }),
});

export type ImportedRecipe = z.infer<typeof recipeSchema>;

/** Reject non-http(s) and obvious internal hosts (best-effort SSRF guard). */
function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ApiError("invalid_request", "Enter a valid URL", 400);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ApiError("invalid_request", "Only http(s) links are supported", 400);
  }
  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (blocked) {
    throw new ApiError("invalid_request", "That URL is not allowed", 400);
  }
  return url;
}

async function fetchPageText(url: URL): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "MacroMap-RecipeImporter/1.0" },
    });
    if (!res.ok) {
      throw new ApiError("ai_error", `Could not fetch the page (${res.status})`, 422);
    }
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 3_000_000) {
      throw new ApiError("ai_error", "That page is too large to import", 413);
    }
    const html = new TextDecoder().decode(buffer);
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 20_000);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("ai_error", "Could not reach that URL", 422);
  } finally {
    clearTimeout(timeout);
  }
}

const SYSTEM_PROMPT = `You extract a single recipe from web page text into structured JSON.
Rules:
- name: the recipe's title.
- servings: how many servings the recipe yields (default 1 if unclear).
- ingredients: the ingredient lines as written.
- perServing: estimate calories/proteinG/carbsG/fatG (grams for macros) PER SERVING from the ingredients divided by servings. Include fiberG/sugarG/satFatG/sodiumMg if reasonable, else null.
- Estimate realistically from standard ingredient nutrition. Never invent content not present in the text.
Respond with JSON only: {"name","servings","ingredients":[...],"perServing":{"calories","proteinG","carbsG","fatG","fiberG","sugarG","satFatG","sodiumMg"}}`;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new ApiError("ai_unavailable", "Recipe import is not configured", 503);
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

/** Fetch a recipe web page and parse it into per-serving recipe data. */
export async function importRecipeFromUrl(rawUrl: string): Promise<ImportedRecipe> {
  const url = assertPublicHttpUrl(rawUrl);
  const text = await fetchPageText(url);
  if (text.length < 50) {
    throw new ApiError("ai_error", "That page had no readable recipe text", 422);
  }
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: `Recipe page text:\n\n${text}` }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      temperature: 0,
    },
  });
  const raw = response.text;
  if (!raw) throw new ApiError("ai_error", "The importer returned no output", 502);
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ApiError("ai_error", "The importer returned invalid JSON", 502);
  }
  const parsed = recipeSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError("ai_error", "Could not read a recipe from that page", 422);
  }
  return parsed.data;
}
