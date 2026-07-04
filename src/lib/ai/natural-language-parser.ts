import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { ApiError } from "@/lib/api";
import { searchFoods } from "@/lib/foods/service";
import type { Food } from "@/lib/db/schema";
import type { NutritionSnapshot } from "@/types/nutrition";

const parsedItemSchema = z.object({
  name: z.string().min(1),
  brand: z.string().nullish(),
  quantity: z.number().positive().catch(1),
  unit: z.string().nullish(),
  estimatedNutrition: z
    .object({
      calories: z.number().nonnegative(),
      proteinG: z.number().nonnegative(),
      carbsG: z.number().nonnegative(),
      fatG: z.number().nonnegative(),
    })
    .nullish(),
});

const parsedResponseSchema = z.object({
  items: z.array(parsedItemSchema).min(1).max(15),
});

export type ParsedFoodItem = z.infer<typeof parsedItemSchema>;

export interface NaturalLogSuggestion {
  inputName: string;
  quantity: number;
  unit: string | null;
  matchedFood: Food | null;
  estimatedNutrition: NutritionSnapshot | null;
}

const SYSTEM_PROMPT = `You parse casual meal descriptions into structured food items.
Rules:
- Split the text into individual foods. "2 eggs and a Subway footlong" is two items.
- quantity is the count of servings the user ate (default 1). Put size words like "footlong" or "large" into the name.
- If the food is from a chain (Subway, McDonald's, Starbucks...) put the chain in brand.
- estimatedNutrition is your best estimate for the TOTAL of that line (all quantity units combined) and is required.
Respond with JSON only: {"items":[{"name":string,"brand":string|null,"quantity":number,"unit":string|null,"estimatedNutrition":{"calories":number,"proteinG":number,"carbsG":number,"fatG":number}}]}`;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new ApiError(
      "ai_unavailable",
      "Natural-language logging is not configured",
      503,
    );
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export async function parseNaturalLogText(text: string): Promise<ParsedFoodItem[]> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    contents: text,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      temperature: 0,
    },
  });
  const raw = response.text;
  if (!raw) throw new ApiError("ai_error", "The parser returned no output", 502);
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ApiError("ai_error", "The parser returned invalid JSON", 502);
  }
  const parsed = parsedResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError("ai_error", "Could not understand that meal description", 422);
  }
  return parsed.data.items;
}

/** Match each parsed item against the shared food database. */
export async function buildSuggestions(
  items: ParsedFoodItem[],
  userId: string | null = null,
): Promise<NaturalLogSuggestion[]> {
  return Promise.all(
    items.map(async (item) => {
      const query = item.brand ? `${item.brand} ${item.name}` : item.name;
      const matches = await searchFoods(query, userId, 1);
      return {
        inputName: item.brand ? `${item.name} (${item.brand})` : item.name,
        quantity: item.quantity,
        unit: item.unit ?? null,
        matchedFood: matches[0] ?? null,
        estimatedNutrition: item.estimatedNutrition ?? null,
      };
    }),
  );
}
