import { inArray } from "drizzle-orm";

import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { foods } from "@/lib/db/schema";
import { foodToNutrition, roundNutrition, scaleNutrition } from "@/lib/nutrition";
import type { SavedMealEntrySnapshot } from "@/types/nutrition";

/** Resolve picked foods into saved-meal snapshot lines (nutrition per line). */
export async function buildMealSnapshot(
  items: { foodId: string; quantity: number; servingMultiplier?: number; servingText?: string }[],
): Promise<SavedMealEntrySnapshot[]> {
  const foodIds = [...new Set(items.map((item) => item.foodId))];
  const foodRows = await db.select().from(foods).where(inArray(foods.id, foodIds));
  const foodsById = new Map(foodRows.map((food) => [food.id, food]));
  return items.map((item) => {
    const food = foodsById.get(item.foodId);
    if (!food) throw new ApiError("not_found", "One or more foods were not found", 404);
    const label = food.brandName ? `${food.name} (${food.brandName})` : food.name;
    // quantity = servings of the chosen unit; multiplier converts to native
    // servings, so nutrition scales by their product.
    const servingMultiplier = item.servingMultiplier ?? 1;
    return {
      label,
      foodId: food.id,
      quantity: item.quantity,
      servingMultiplier,
      serving: item.servingText?.trim() || undefined,
      brand: food.brandName ?? undefined,
      nutrition: roundNutrition(
        scaleNutrition(foodToNutrition(food), item.quantity * servingMultiplier),
      ),
    };
  });
}
