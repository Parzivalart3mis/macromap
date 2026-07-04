import type { Food } from "@/lib/db/schema";
import { NUTRITION_KEYS, type NutritionSnapshot } from "@/types/nutrition";

export function emptyNutrition(): NutritionSnapshot {
  return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
}

/** Nutrition of one serving of a food row. */
export function foodToNutrition(food: Food): NutritionSnapshot {
  const snapshot: NutritionSnapshot = {
    calories: food.calories,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
  };
  if (food.fiberG != null) snapshot.fiberG = food.fiberG;
  if (food.sugarG != null) snapshot.sugarG = food.sugarG;
  if (food.satFatG != null) snapshot.satFatG = food.satFatG;
  if (food.sodiumMg != null) snapshot.sodiumMg = food.sodiumMg;
  if (food.cholesterolMg != null) snapshot.cholesterolMg = food.cholesterolMg;
  if (food.potassiumMg != null) snapshot.potassiumMg = food.potassiumMg;
  if (food.transFatG != null) snapshot.transFatG = food.transFatG;
  if (food.polyUnsatFatG != null) snapshot.polyUnsatFatG = food.polyUnsatFatG;
  if (food.monoUnsatFatG != null) snapshot.monoUnsatFatG = food.monoUnsatFatG;
  if (food.addedSugarsG != null) snapshot.addedSugarsG = food.addedSugarsG;
  if (food.sugarAlcoholsG != null) snapshot.sugarAlcoholsG = food.sugarAlcoholsG;
  if (food.vitaminAPct != null) snapshot.vitaminAPct = food.vitaminAPct;
  if (food.vitaminCPct != null) snapshot.vitaminCPct = food.vitaminCPct;
  if (food.calciumPct != null) snapshot.calciumPct = food.calciumPct;
  if (food.ironPct != null) snapshot.ironPct = food.ironPct;
  if (food.vitaminDPct != null) snapshot.vitaminDPct = food.vitaminDPct;
  return snapshot;
}

export function scaleNutrition(
  snapshot: NutritionSnapshot,
  factor: number,
): NutritionSnapshot {
  const scaled = emptyNutrition();
  for (const key of NUTRITION_KEYS) {
    const value = snapshot[key];
    if (value != null) scaled[key] = value * factor;
  }
  return scaled;
}

/**
 * Sums snapshots. Optional micronutrients are treated as 0 when missing so a
 * single food without fiber data does not erase fiber from the day total.
 */
export function sumNutrition(snapshots: NutritionSnapshot[]): NutritionSnapshot {
  const total = emptyNutrition();
  for (const snapshot of snapshots) {
    for (const key of NUTRITION_KEYS) {
      const value = snapshot[key];
      if (value == null) continue;
      total[key] = (total[key] ?? 0) + value;
    }
  }
  return total;
}

export function roundNutrition(
  snapshot: NutritionSnapshot,
  decimals = 1,
): NutritionSnapshot {
  const factor = 10 ** decimals;
  const rounded = emptyNutrition();
  for (const key of NUTRITION_KEYS) {
    const value = snapshot[key];
    if (value != null) rounded[key] = Math.round(value * factor) / factor;
  }
  return rounded;
}
