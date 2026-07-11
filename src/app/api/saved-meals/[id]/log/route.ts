import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { diaryEntries, foods, savedMeals } from "@/lib/db/schema";
import { getDiaryPayload, getOrCreateDiaryDay, getOrCreateMeal } from "@/lib/diary/service";
import { roundNutrition, scaleNutrition } from "@/lib/nutrition";
import { enforceRateLimit } from "@/lib/rate-limit";
import { scaleServingText } from "@/lib/units";

const logSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  mealName: z.string().min(1).max(40),
  // Scales the whole meal; defaults to one full serving of the template.
  servings: z.number().positive().max(50).optional(),
  eatenTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM").optional(),
});

/** Logs every line of a saved-meal template into the given day and meal. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const { id } = await params;
    const input = await parseBody(request, logSchema);

    const [savedMeal] = await db
      .select()
      .from(savedMeals)
      .where(and(eq(savedMeals.id, id), eq(savedMeals.userId, userId)))
      .limit(1);
    if (!savedMeal) throw new ApiError("not_found", "Saved meal not found", 404);

    const day = await getOrCreateDiaryDay(userId, input.date);
    const meal = await getOrCreateMeal(day.id, input.mealName);
    const servings = input.servings ?? 1;

    await db.insert(diaryEntries).values(
      savedMeal.entriesSnapshotJson.map((line) => ({
        diaryMealId: meal.id,
        foodId: line.foodId ?? null,
        customStoreOrderId: line.customStoreOrderId ?? null,
        quantity: line.quantity * servings,
        servingMultiplier: line.servingMultiplier,
        eatenTime: input.eatenTime ?? null,
        loggedVia: "saved_meal" as const,
        nutritionSnapshotJson: {
          ...roundNutrition(scaleNutrition(line.nutrition, servings)),
          label: line.label,
          serving: scaleServingText(
            line.serving ?? (line.customStoreOrderId ? "1 order" : undefined),
            servings,
          ),
          brand: line.brand,
        },
      })),
    );

    // Popularity signal for search ranking.
    const foodIds = savedMeal.entriesSnapshotJson
      .map((line) => line.foodId)
      .filter((id): id is string => Boolean(id));
    if (foodIds.length > 0) {
      await db
        .update(foods)
        .set({ logCount: sql`${foods.logCount} + 1` })
        .where(inArray(foods.id, foodIds));
    }

    const payload = await getDiaryPayload(userId, input.date);
    return NextResponse.json({ diary: payload }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
