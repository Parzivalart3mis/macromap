import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { foods, savedMeals } from "@/lib/db/schema";
import { foodToNutrition, roundNutrition, scaleNutrition } from "@/lib/nutrition";
import { enforceRateLimit } from "@/lib/rate-limit";
import { buildSavedMealSchema } from "@/lib/validations/diary";
import type { SavedMealEntrySnapshot } from "@/types/nutrition";

/** Creates a saved meal from picked foods (the Create-a-Meal builder). */
export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const input = await parseBody(request, buildSavedMealSchema);

    const foodIds = [...new Set(input.items.map((item) => item.foodId))];
    const foodRows = await db.select().from(foods).where(inArray(foods.id, foodIds));
    const foodsById = new Map(foodRows.map((food) => [food.id, food]));

    const snapshot: SavedMealEntrySnapshot[] = input.items.map((item) => {
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

    const [saved] = await db
      .insert(savedMeals)
      .values({
        userId,
        name: input.name,
        directions: input.directions?.trim() || null,
        entriesSnapshotJson: snapshot,
      })
      .returning();
    return NextResponse.json({ savedMeal: saved }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
