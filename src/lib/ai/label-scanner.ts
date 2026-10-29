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

const SYSTEM_PROMPT = `You read photos of ONE packaged food and return its data as JSON.
You may be given several photos of the same package — typically the front (brand
and product name), the back or side (the Nutrition Facts panel), and sometimes a
close-up of the barcode. Treat them as faces of a single product and combine what
you read across all of them into one answer.
Rules:
- Report values exactly as printed for ONE serving (the label's serving size). Do not scale or estimate values that are not printed.
- servingSize is the label's serving, e.g. "1 cup (240 ml)" or "28 g" — prefer "<number> <unit>" form.
- "<1g" prints as 0.5. "Includes Xg Added Sugars" -> addedSugarsG.
- Percentages (%DV) go in the *Pct fields as plain numbers (e.g. 10 for 10%).
- brandName/foodName come from the front of the pack; take them from whichever photo shows them. Null if no photo shows them.
- barcode only if the digits are fully legible in some photo; never guess.
- A %DV column that disagrees with the printed amount beside it is a misprint: trust the amount.
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

export interface LabelImage {
  /** base64, no data-URL prefix. */
  data: string;
  mimeType: string;
}

/**
 * Reads one packaged food from one or more photos of it.
 *
 * Several photos matter because a package cannot show everything at once: the
 * brand and product name are on the front and the Nutrition Facts panel is on
 * the back, so a single photo can only ever return one of the two. All images
 * go into a single request, so this is one model call however many are passed.
 */
export async function scanNutritionLabel(
  images: LabelImage[],
): Promise<ScannedLabel> {
  if (images.length === 0) {
    throw new ApiError("invalid_request", "Add at least one photo", 400);
  }
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          ...images.map((image) => ({
            inlineData: { mimeType: image.mimeType, data: image.data },
          })),
          {
            text:
              images.length === 1
                ? "Extract this packaged food from the photo."
                : `Extract this packaged food. The ${images.length} photos are different faces of the same package.`,
          },
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
      images.length === 1
        ? "Could not read the calories — add a photo of the Nutrition Facts panel"
        : "Could not read the calories in any of those photos — make sure one shows the full Nutrition Facts panel",
      422,
    );
  }
  return parsed.data;
}
