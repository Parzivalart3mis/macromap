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
import { batchDiaryEntriesSchema } from "@/lib/validations/diary";

/** Multi-Add: insert several diary entries in one request, returning the day. */
export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const { entries } = await parseBody(request, batchDiaryEntriesSchema);

    // Reuse day/meal rows across entries that share a (date, meal).
    const dayCache = new Map<string, string>();
    const mealCache = new Map<string, string>();
    let lastDate = entries[0].date;

    for (const input of entries) {
      const source = await resolveEntrySource(
        userId,
        input.foodId,
        input.customStoreOrderId,
        input.quickAdd,
      );
      let dayId = dayCache.get(input.date);
      if (!dayId) {
        dayId = (await getOrCreateDiaryDay(userId, input.date)).id;
        dayCache.set(input.date, dayId);
      }
      const mealKey = `${dayId}:${input.mealName}`;
      let mealId = mealCache.get(mealKey);
      if (!mealId) {
        mealId = (await getOrCreateMeal(dayId, input.mealName)).id;
        mealCache.set(mealKey, mealId);
      }
      const snapshot = buildEntrySnapshot(
        source,
        input.quantity,
        input.servingMultiplier,
        input.servingText,
      );
      await db.insert(diaryEntries).values({
        diaryMealId: mealId,
        foodId: input.foodId ?? null,
        customStoreOrderId: input.customStoreOrderId ?? null,
        quantity: input.quantity,
        servingMultiplier: input.servingMultiplier,
        loggedVia: input.loggedVia,
        eatenTime: input.eatenTime ?? null,
        nutritionSnapshotJson: snapshot,
      });
      if (input.foodId) {
        await db
          .update(foods)
          .set({ logCount: sql`${foods.logCount} + 1` })
          .where(eq(foods.id, input.foodId));
      }
      lastDate = input.date;
    }

    const payload = await getDiaryPayload(userId, lastDate);
    return NextResponse.json({ diary: payload, count: entries.length }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
