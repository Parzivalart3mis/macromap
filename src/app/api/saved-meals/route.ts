import { and, asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, parseBody, requireDbUser, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { diaryDays, diaryEntries, diaryMeals, savedMeals } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSavedMealSchema } from "@/lib/validations/diary";
import type { SavedMealEntrySnapshot } from "@/types/nutrition";

export async function GET() {
  try {
    const userId = await requireUserId();
    const meals = await db
      .select()
      .from(savedMeals)
      .where(eq(savedMeals.userId, userId))
      .orderBy(desc(savedMeals.createdAt));
    return NextResponse.json({ savedMeals: meals });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Saves an existing diary meal (all of its entries) as a reusable template. */
export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const input = await parseBody(request, createSavedMealSchema);

    const [day] = await db
      .select()
      .from(diaryDays)
      .where(and(eq(diaryDays.userId, userId), eq(diaryDays.date, input.date)))
      .limit(1);
    if (!day) throw new ApiError("not_found", "Nothing logged on that date", 404);

    const [meal] = await db
      .select()
      .from(diaryMeals)
      .where(and(eq(diaryMeals.diaryDayId, day.id), eq(diaryMeals.mealName, input.mealName)))
      .limit(1);
    if (!meal) throw new ApiError("not_found", "Meal not found on that date", 404);

    const entries = await db
      .select()
      .from(diaryEntries)
      .where(eq(diaryEntries.diaryMealId, meal.id))
      .orderBy(asc(diaryEntries.createdAt));
    if (entries.length === 0) {
      throw new ApiError("invalid_request", "That meal has no entries to save", 400);
    }

    const snapshot: SavedMealEntrySnapshot[] = entries.map((entry) => {
      const { label, ...nutrition } = entry.nutritionSnapshotJson;
      return {
        label,
        foodId: entry.foodId ?? undefined,
        customStoreOrderId: entry.customStoreOrderId ?? undefined,
        quantity: entry.quantity,
        servingMultiplier: entry.servingMultiplier,
        nutrition,
      };
    });

    const [saved] = await db
      .insert(savedMeals)
      .values({ userId, name: input.name, entriesSnapshotJson: snapshot })
      .returning();
    return NextResponse.json({ savedMeal: saved }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
