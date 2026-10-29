/**
 * The shape of a nutrition label as the create forms handle it: which fields
 * exist, how a printed serving ("1 cup", "1/2 cup", "100g") becomes a value and
 * a unit, and what a scan can prefill. Shared by the member wizard and the
 * admin's catalogue form so the two cannot drift apart.
 */

export interface NutritionField {
  key: string;
  label: string;
  /** The API insists on it; the form marks it. */
  required?: boolean;
}

export const NUTRITION_FIELDS: readonly NutritionField[] = [
  { key: "calories", label: "Calories", required: true },
  { key: "fatG", label: "Total Fat (g)" },
  { key: "satFatG", label: "Saturated Fat (g)" },
  { key: "polyUnsatFatG", label: "Polyunsaturated Fat (g)" },
  { key: "monoUnsatFatG", label: "Monounsaturated (g)" },
  { key: "transFatG", label: "Trans Fat (g)" },
  { key: "cholesterolMg", label: "Cholesterol (mg)" },
  { key: "sodiumMg", label: "Sodium (mg)" },
  { key: "potassiumMg", label: "Potassium (mg)" },
  { key: "carbsG", label: "Total Carbohydrates (g)" },
  { key: "fiberG", label: "Dietary Fiber (g)" },
  { key: "sugarG", label: "Sugars (g)" },
  { key: "addedSugarsG", label: "Added Sugars (g)" },
  { key: "sugarAlcoholsG", label: "Sugar Alcohols (g)" },
  { key: "proteinG", label: "Protein (g)" },
  { key: "vitaminAPct", label: "Vitamin A (% DV)" },
  { key: "vitaminCPct", label: "Vitamin C (% DV)" },
  { key: "calciumPct", label: "Calcium (% DV)" },
  { key: "ironPct", label: "Iron (% DV)" },
  { key: "vitaminDPct", label: "Vitamin D (% DV)" },
] as const;

/** The four the API insists on; a blank one is sent as zero rather than omitted. */
export const API_DEFAULT_ZERO = new Set(["calories", "proteinG", "carbsG", "fatG"]);

/** Parse "1 cup" / "0.5 cup" / "1/2 cup" / "100g" into { value, unit }. */
export function parseServing(input: string): { value: number; unit: string } {
  const s = input.trim();
  const match = s.match(/^([\d.]+\/[\d.]+|[\d.]+)\s*(.*)$/);
  if (!match) return { value: 1, unit: s || "serving" };
  let value = 1;
  if (match[1].includes("/")) {
    const [a, b] = match[1].split("/").map(Number);
    value = b ? a / b : 1;
  } else {
    value = Number(match[1]) || 1;
  }
  return { value: value > 0 ? value : 1, unit: match[2].trim() || "serving" };
}

/** Keep only digits and a single decimal point. */
export function decimalOnly(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
}

/** Fields the scanner can prefill (label-printed values as strings). */
export interface ScannedLabel {
  brandName?: string | null;
  foodName?: string | null;
  servingSize?: string | null;
  servingsPerContainer?: number | null;
  barcode?: string | null;
  [nutrient: string]: string | number | null | undefined;
}

/**
 * Label-consistency checks, run on the values in the form rather than on what
 * the model claimed. Each one is a printed-panel invariant, so a hit means the
 * reading is wrong somewhere — three of the labels entered by hand this month
 * had a %DV column misprinted one row out of register.
 */
export function labelWarnings(values: Record<string, string>): string[] {
  const n = (key: string) => {
    const raw = values[key];
    return raw == null || raw === "" ? null : Number(raw);
  };
  const out: string[] = [];
  const [fat, sat, trans] = [n("fatG"), n("satFatG"), n("transFatG")];
  const [carbs, fiber, sugar, added] = [n("carbsG"), n("fiberG"), n("sugarG"), n("addedSugarsG")];

  if (fat != null && (sat ?? 0) + (trans ?? 0) > fat + 0.05) {
    out.push("Saturated and trans fat add up to more than total fat");
  }
  if (carbs != null && (fiber ?? 0) + (sugar ?? 0) > carbs + 0.05) {
    out.push("Fiber and sugars add up to more than total carbohydrate");
  }
  if (sugar != null && added != null && added > sugar + 0.05) {
    out.push("Added sugars exceed total sugars");
  }
  const calories = n("calories");
  const protein = n("proteinG");
  if (calories != null && calories > 0 && protein != null && carbs != null && fat != null) {
    const derived = protein * 4 + carbs * 4 + fat * 9;
    // Generous: fiber accounting and label rounding both move this a little.
    if (Math.abs(derived - calories) > Math.max(25, calories * 0.25)) {
      out.push(
        `Macros come to about ${Math.round(derived)} kcal against the ${calories} printed`,
      );
    }
  }
  return out;
}
