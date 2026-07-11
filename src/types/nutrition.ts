export interface NutritionSnapshot {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  satFatG?: number;
  sodiumMg?: number;
  cholesterolMg?: number;
  potassiumMg?: number;
  transFatG?: number;
  polyUnsatFatG?: number;
  monoUnsatFatG?: number;
  addedSugarsG?: number;
  sugarAlcoholsG?: number;
  /** Micronutrients tracked as % Daily Value, per the FDA label. */
  vitaminAPct?: number;
  vitaminCPct?: number;
  calciumPct?: number;
  ironPct?: number;
  vitaminDPct?: number;
}

export const NUTRITION_KEYS = [
  "calories",
  "proteinG",
  "carbsG",
  "fatG",
  "fiberG",
  "sugarG",
  "satFatG",
  "sodiumMg",
  "cholesterolMg",
  "potassiumMg",
  "transFatG",
  "polyUnsatFatG",
  "monoUnsatFatG",
  "addedSugarsG",
  "sugarAlcoholsG",
  "vitaminAPct",
  "vitaminCPct",
  "calciumPct",
  "ironPct",
  "vitaminDPct",
] as const satisfies readonly (keyof NutritionSnapshot)[];

export type NutritionKey = (typeof NUTRITION_KEYS)[number];

/**
 * An extra serving size a food can be logged in, expressed as a multiple of the
 * food's base serving. Example: base "1 packet"; alternate { unit: "scoop",
 * multiplier: 0.5 } means one scoop is half a packet's nutrition.
 */
export interface AlternateServing {
  unit: string;
  multiplier: number;
  /**
   * Optional explicit label for the serving picker. When set, it is shown
   * verbatim instead of the auto-generated "1 <unit> (<n> <base>)" form — used
   * for fixed sizes like beverage bottles ("16.9 fl oz") where the base
   * equivalent ("1.41 cans") would be noise.
   */
  label?: string;
}

/** One line of a reusable saved-meal template. */
export interface SavedMealEntrySnapshot {
  label: string;
  foodId?: string;
  customStoreOrderId?: string;
  quantity: number;
  servingMultiplier: number;
  /** Human serving text as picked ("1 large (136 g)"); absent on legacy lines. */
  serving?: string;
  brand?: string;
  nutrition: NutritionSnapshot;
}
