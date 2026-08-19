import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { diaryDays, diaryEntries, diaryMeals, foods } from "@/lib/db/schema";
import { getDiaryPayload, getOrCreateDiaryDay, getOrCreateMeal } from "@/lib/diary/service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { repeatMealSchema } from "@/lib/validations/diary";

/**
 * "Repeat last meal": copy the most recent prior day's entries for this meal
 * into the target day's same bucket. Duplicates each entry's stored snapshot
 * verbatim (no recompute), stamping the client-supplied current time. No-ops
 * cleanly when there is no earlier logged version of the meal.
 */
export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const input = await parseBody(request, repeatMealSchema);

    // Most recent day before `date` where this meal has at least one entry.
    const [srcMeal] = await db
      .select({ mealId: diaryMeals.id, date: diaryDays.date })
      .from(diaryMeals)
      .innerJoin(diaryDays, eq(diaryDays.id, diaryMeals.diaryDayId))
      .innerJoin(diaryEntries, eq(diaryEntries.diaryMealId, diaryMeals.id))
      .where(
        and(
          eq(diaryDays.userId, userId),
          eq(diaryMeals.mealName, input.mealName),
          lt(diaryDays.date, input.date),
        ),
      )
      .groupBy(diaryMeals.id, diaryDays.date)
      .orderBy(desc(diaryDays.date))
      .limit(1);

    if (!srcMeal) {
      return NextResponse.json({ copied: 0, sourceDate: null });
    }

    const sourceEntries = await db
      .select()
      .from(diaryEntries)
      .where(eq(diaryEntries.diaryMealId, srcMeal.mealId))
      .orderBy(asc(diaryEntries.createdAt));

    const day = await getOrCreateDiaryDay(userId, input.date);
    const meal = await getOrCreateMeal(day.id, input.mealName);

    for (const e of sourceEntries) {
      await db.insert(diaryEntries).values({
        diaryMealId: meal.id,
        foodId: e.foodId,
        customStoreOrderId: e.customStoreOrderId,
        quantity: e.quantity,
        servingMultiplier: e.servingMultiplier,
        loggedVia: e.loggedVia,
        eatenTime: input.eatenTime ?? null,
        nutritionSnapshotJson: e.nutritionSnapshotJson,
      });
      if (e.foodId) {
        await db
          .update(foods)
          .set({ logCount: sql`${foods.logCount} + 1` })
          .where(eq(foods.id, e.foodId));
      }
    }

    const payload = await getDiaryPayload(userId, input.date);
    return NextResponse.json(
      { copied: sourceEntries.length, sourceDate: srcMeal.date, diary: payload },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
