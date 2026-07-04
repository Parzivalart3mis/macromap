import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { diaryEntries, foods, savedMeals } from "@/lib/db/schema";
import { getDiaryPayload, getOrCreateDiaryDay, getOrCreateMeal } from "@/lib/diary/service";
import { enforceRateLimit } from "@/lib/rate-limit";

const logSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  mealName: z.string().min(1).max(40),
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

    await db.insert(diaryEntries).values(
      savedMeal.entriesSnapshotJson.map((line) => ({
        diaryMealId: meal.id,
        foodId: line.foodId ?? null,
        customStoreOrderId: line.customStoreOrderId ?? null,
        quantity: line.quantity,
        servingMultiplier: line.servingMultiplier,
        loggedVia: "saved_meal" as const,
        nutritionSnapshotJson: { ...line.nutrition, label: line.label },
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
