import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { ApiError } from "@/lib/api";

// Numbers arrive as label-printed values; every field is optional because
// labels vary (and photos crop). Keys match the Create Food wizard's fields.
const labelSchema = z.object({
  brandName: z.string().nullish(),
  foodName: z.string().nullish(),
  servingSize: z.string().nullish(),
  servingsPerContainer: z.number().positive().nullish(),
  barcode: z.string().regex(/^\d{8,14}$/).nullish(),
  calories: z.number().nonnegative().nullish(),
  fatG: z.number().nonnegative().nullish(),
  satFatG: z.number().nonnegative().nullish(),
  polyUnsatFatG: z.number().nonnegative().nullish(),
  monoUnsatFatG: z.number().nonnegative().nullish(),
  transFatG: z.number().nonnegative().nullish(),
  cholesterolMg: z.number().nonnegative().nullish(),
  sodiumMg: z.number().nonnegative().nullish(),
  potassiumMg: z.number().nonnegative().nullish(),
  carbsG: z.number().nonnegative().nullish(),
  fiberG: z.number().nonnegative().nullish(),
  sugarG: z.number().nonnegative().nullish(),
  addedSugarsG: z.number().nonnegative().nullish(),
  sugarAlcoholsG: z.number().nonnegative().nullish(),
  proteinG: z.number().nonnegative().nullish(),
  vitaminAPct: z.number().nonnegative().nullish(),
  vitaminCPct: z.number().nonnegative().nullish(),
  calciumPct: z.number().nonnegative().nullish(),
  ironPct: z.number().nonnegative().nullish(),
  vitaminDPct: z.number().nonnegative().nullish(),
});

export type ScannedLabel = z.infer<typeof labelSchema>;

const SYSTEM_PROMPT = `You read a photo of a packaged food's Nutrition Facts label and return its data as JSON.
Rules:
- Report values exactly as printed for ONE serving (the label's serving size). Do not scale or estimate values that are not printed.
- servingSize is the label's serving, e.g. "1 cup (240 ml)" or "28 g" — prefer "<number> <unit>" form.
- "<1g" prints as 0.5. "Includes Xg Added Sugars" -> addedSugarsG.
- Percentages (%DV) go in the *Pct fields as plain numbers (e.g. 10 for 10%).
- brandName/foodName only if clearly visible on the packaging; otherwise null.
- barcode only if the digits are fully legible; never guess.
- Omit or null any value you cannot read confidently. Do not invent numbers.
Respond with JSON only, using exactly these keys:
{"brandName","foodName","servingSize","servingsPerContainer","barcode","calories","fatG","satFatG","polyUnsatFatG","monoUnsatFatG","transFatG","cholesterolMg","sodiumMg","potassiumMg","carbsG","fiberG","sugarG","addedSugarsG","sugarAlcoholsG","proteinG","vitaminAPct","vitaminCPct","calciumPct","ironPct","vitaminDPct"}`;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new ApiError("ai_unavailable", "Label scanning is not configured", 503);
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

/** Extract Nutrition Facts from a label photo (base64 image). */
export async function scanNutritionLabel(
  imageBase64: string,
  mimeType: string,
): Promise<ScannedLabel> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: "Extract the nutrition label from this photo." },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      temperature: 0,
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
  const parsed = labelSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError("ai_error", "Could not read a nutrition label in that photo", 422);
  }
  if (parsed.data.calories == null) {
    throw new ApiError(
      "ai_error",
      "Could not read the calories — retake the photo with the full label visible",
      422,
    );
  }
  return parsed.data;
}
