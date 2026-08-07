import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { ApiError } from "@/lib/api";

const itemSchema = z.object({
  name: z.string().min(1).max(80),
  quantity: z.number().positive().catch(1),
  unit: z.string().max(20).nullish(),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
});

const responseSchema = z.object({ items: z.array(itemSchema).max(20) });

export type ScannedMealItem = z.infer<typeof itemSchema>;

const SYSTEM_PROMPT = `You look at a photo of a meal or plate of food and identify each distinct food, estimating a typical portion and its nutrition.
Rules:
- One entry per distinct food you can see; combine identical items into one with a larger quantity.
- Estimate quantity and a common household unit (e.g. "1 cup", "2 slices", "1 piece", "100 g").
- calories/proteinG/carbsG/fatG are for the WHOLE portion you listed (not per 100 g). Grams for macros.
- Be realistic and use standard portion nutrition; give your best estimate when unsure.
- If the image contains no identifiable food, return an empty items array.
Respond with JSON only: {"items":[{"name","quantity","unit","calories","proteinG","carbsG","fatG"}]}`;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new ApiError("ai_unavailable", "Meal scanning is not configured", 503);
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

/** Identify foods + estimate nutrition from a meal photo (base64 image). */
export async function scanMeal(
  imageBase64: string,
  mimeType: string,
): Promise<ScannedMealItem[]> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: "Identify the foods on the plate and estimate their nutrition." },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });
  const raw = response.text;
  if (!raw) throw new ApiError("ai_error", "The scanner returned no output", 502);
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ApiError("ai_error", "The scanner returned invalid JSON", 502);
  }
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError("ai_error", "Could not read foods from that photo", 422);
  }
  return parsed.data.items;
}
