import { and, eq, inArray } from "drizzle-orm";

import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { foods, storeIngredients } from "@/lib/db/schema";
import { foodToNutrition, roundNutrition, scaleNutrition, sumNutrition } from "@/lib/nutrition";
import type { CreateCustomOrderInput } from "@/lib/validations/stores";
import type { NutritionSnapshot } from "@/types/nutrition";

/**
 * Computes a custom order's nutrition from its items server-side, verifying
 * every ingredient belongs to the store so the snapshot can't be forged.
 * Shared by the create and update routes.
 */
export async function computeOrderSnapshot(
  storeId: string,
  items: CreateCustomOrderInput["items"],
): Promise<NutritionSnapshot> {
  const foodIds = [...new Set(items.map((item) => item.ingredientFoodId))];
  const validIngredients = await db
    .select({ foodId: storeIngredients.foodId, food: foods })
    .from(storeIngredients)
    .innerJoin(foods, eq(foods.id, storeIngredients.foodId))
    .where(
      and(eq(storeIngredients.storeId, storeId), inArray(storeIngredients.foodId, foodIds)),
    );
  const foodsById = new Map(validIngredients.map((row) => [row.foodId, row.food]));

  const snapshots = items.map((item) => {
    const food = foodsById.get(item.ingredientFoodId);
    if (!food) {
      throw new ApiError(
        "invalid_request",
        "One or more ingredients do not belong to this store",
        400,
      );
    }
    return scaleNutrition(foodToNutrition(food), item.quantity);
  });
  return roundNutrition(sumNutrition(snapshots));
}
