import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { diaryDays, diaryEntries, diaryMeals, foods } from "@/lib/db/schema";
import type { FoodDTO, RecentItemDTO } from "@/types/api";

/**
 * The user's most recently logged items ("Recent" tab), distinct, newest first.
 * Includes catalog foods, saved store builds, and raw quick-adds — each carrying
 * enough to re-log it verbatim. Frequency ranking lives in the Frequent tab, so
 * this is pure recency. We over-fetch recent rows and de-duplicate in JS by
 * food / order / quick-add-label so one repeated item doesn't crowd the list.
 */
export async function GET() {
  try {
    const userId = await requireUserId();

    const rows = await db
      .select({
        foodId: diaryEntries.foodId,
        customStoreOrderId: diaryEntries.customStoreOrderId,
        snapshot: diaryEntries.nutritionSnapshotJson,
        quantity: diaryEntries.quantity,
        servingMultiplier: diaryEntries.servingMultiplier,
        food: foods,
      })
      .from(diaryEntries)
      .innerJoin(diaryMeals, eq(diaryMeals.id, diaryEntries.diaryMealId))
      .innerJoin(diaryDays, eq(diaryDays.id, diaryMeals.diaryDayId))
      .leftJoin(foods, eq(foods.id, diaryEntries.foodId))
      .where(eq(diaryDays.userId, userId))
      .orderBy(desc(diaryEntries.createdAt))
      .limit(250);

    const seen = new Set<string>();
    const recent: RecentItemDTO[] = [];
    for (const row of rows) {
      const snap = row.snapshot;
      const lastQuantity = Math.round(row.quantity * 100) / 100;
      const lastMultiplier = row.servingMultiplier;
      const lastServing = snap.serving ?? null;
      const macros = {
        calories: snap.calories,
        proteinG: snap.proteinG,
        carbsG: snap.carbsG,
        fatG: snap.fatG,
      };

      let key: string;
      let item: RecentItemDTO;
      if (row.foodId && row.food) {
        key = `food:${row.foodId}`;
        item = {
          kind: "food",
          food: row.food as unknown as FoodDTO,
          lastQuantity,
          lastMultiplier,
          lastServing,
        };
      } else if (row.customStoreOrderId) {
        key = `order:${row.customStoreOrderId}`;
        item = {
          kind: "order",
          orderId: row.customStoreOrderId,
          name: snap.label,
          brand: snap.brand ?? null,
          nutrition: macros,
          lastQuantity,
          lastMultiplier,
          lastServing,
        };
      } else {
        const label = snap.label || "Quick add";
        key = `quick:${label}`;
        item = { kind: "quick", label, nutrition: macros };
      }

      if (seen.has(key)) continue;
      seen.add(key);
      recent.push(item);
      if (recent.length >= 20) break;
    }

    return NextResponse.json({ recent });
  } catch (error) {
    return handleApiError(error);
  }
}
