import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { diaryDays, diaryEntries, diaryMeals, foods } from "@/lib/db/schema";

/**
 * The user's most recently logged foods ("Recent" tab) — distinct foods, newest
 * log first. Habit/frequency ranking lives in the separate "Frequent" tab, so
 * this one is pure recency. The last log's exact serving choice rides along so
 * re-logging reproduces it verbatim.
 */
export async function GET() {
  try {
    const userId = await requireUserId();

    const rows = await db
      .select({
        food: foods,
        lastQuantity: sql<number>`(round(((array_agg(${diaryEntries.quantity} order by ${diaryEntries.createdAt} desc))[1])::numeric, 2))::float8`,
        lastMultiplier: sql<number>`((array_agg(${diaryEntries.servingMultiplier} order by ${diaryEntries.createdAt} desc))[1])::float8`,
        lastServing: sql<string | null>`(array_agg(${diaryEntries.nutritionSnapshotJson}->>'serving' order by ${diaryEntries.createdAt} desc))[1]`,
      })
      .from(diaryEntries)
      .innerJoin(diaryMeals, eq(diaryMeals.id, diaryEntries.diaryMealId))
      .innerJoin(diaryDays, eq(diaryDays.id, diaryMeals.diaryDayId))
      .innerJoin(foods, eq(foods.id, diaryEntries.foodId))
      .where(eq(diaryDays.userId, userId))
      .groupBy(foods.id)
      .orderBy(desc(sql`max(${diaryEntries.createdAt})`))
      .limit(20);

    return NextResponse.json({
      recent: rows.map((row) => ({
        food: row.food,
        lastQuantity: row.lastQuantity,
        lastMultiplier: row.lastMultiplier,
        lastServing: row.lastServing,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
