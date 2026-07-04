import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { diaryEntries, foods } from "@/lib/db/schema";
import {
  buildEntrySnapshot,
  getDiaryPayload,
  getOrCreateDiaryDay,
  getOrCreateMeal,
  resolveEntrySource,
} from "@/lib/diary/service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createDiaryEntrySchema } from "@/lib/validations/diary";

export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const input = await parseBody(request, createDiaryEntrySchema);

    const source = await resolveEntrySource(userId, input.foodId, input.customStoreOrderId);
    const day = await getOrCreateDiaryDay(userId, input.date);
    const meal = await getOrCreateMeal(day.id, input.mealName);
    const snapshot = buildEntrySnapshot(source, input.quantity, input.servingMultiplier);

    const [entry] = await db
      .insert(diaryEntries)
      .values({
        diaryMealId: meal.id,
        foodId: input.foodId ?? null,
        customStoreOrderId: input.customStoreOrderId ?? null,
        quantity: input.quantity,
        servingMultiplier: input.servingMultiplier,
        loggedVia: input.loggedVia,
        nutritionSnapshotJson: snapshot,
      })
      .returning();

    if (input.foodId) {
      // Popularity signal for search ranking.
      await db
        .update(foods)
        .set({ logCount: sql`${foods.logCount} + 1` })
        .where(eq(foods.id, input.foodId));
    }

    const payload = await getDiaryPayload(userId, input.date);
    return NextResponse.json({ entry, diary: payload }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
