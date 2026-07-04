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

/** One line of a reusable saved-meal template. */
export interface SavedMealEntrySnapshot {
  label: string;
  foodId?: string;
  customStoreOrderId?: string;
  quantity: number;
  servingMultiplier: number;
  nutrition: NutritionSnapshot;
}
