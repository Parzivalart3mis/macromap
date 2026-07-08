import { inArray } from "drizzle-orm";

import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { foods } from "@/lib/db/schema";
import { foodToNutrition, roundNutrition, scaleNutrition } from "@/lib/nutrition";
import type { SavedMealEntrySnapshot } from "@/types/nutrition";

/** Resolve picked foods into saved-meal snapshot lines (nutrition per quantity). */
export async function buildMealSnapshot(
  items: { foodId: string; quantity: number }[],
): Promise<SavedMealEntrySnapshot[]> {
  const foodIds = [...new Set(items.map((item) => item.foodId))];
  const foodRows = await db.select().from(foods).where(inArray(foods.id, foodIds));
  const foodsById = new Map(foodRows.map((food) => [food.id, food]));
  return items.map((item) => {
    const food = foodsById.get(item.foodId);
    if (!food) throw new ApiError("not_found", "One or more foods were not found", 404);
    const label = food.brandName ? `${food.name} (${food.brandName})` : food.name;
    return {
      label,
      foodId: food.id,
      quantity: item.quantity,
      servingMultiplier: 1,
      nutrition: roundNutrition(scaleNutrition(foodToNutrition(food), item.quantity)),
    };
  });
}
