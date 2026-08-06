import { and, desc, eq, gt, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { diaryDays, diaryEntries, diaryMeals, foods } from "@/lib/db/schema";

/**
 * The user's most-logged foods ("Frequent" tab), ranked by how many times they
 * have been logged (all time). With ?meal=, only logs into that meal count, so
 * the tab surfaces the staples for the meal you're adding to. The last log's
 * exact serving choice rides along so re-logging reproduces it verbatim.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const mealParam = request.nextUrl.searchParams.get("meal");
    const meal = mealParam && mealParam.length <= 40 ? mealParam : null;

    const logCount = sql<number>`count(*)::int`;

    const rows = await db
      .select({
        food: foods,
        logCount,
        lastQuantity: sql<number>`(round(((array_agg(${diaryEntries.quantity} order by ${diaryEntries.createdAt} desc))[1])::numeric, 2))::float8`,
        lastMultiplier: sql<number>`((array_agg(${diaryEntries.servingMultiplier} order by ${diaryEntries.createdAt} desc))[1])::float8`,
        lastServing: sql<string | null>`(array_agg(${diaryEntries.nutritionSnapshotJson}->>'serving' order by ${diaryEntries.createdAt} desc))[1]`,
      })
      .from(diaryEntries)
      .innerJoin(diaryMeals, eq(diaryMeals.id, diaryEntries.diaryMealId))
      .innerJoin(diaryDays, eq(diaryDays.id, diaryMeals.diaryDayId))
      .innerJoin(foods, eq(foods.id, diaryEntries.foodId))
      .where(
        meal
          ? and(eq(diaryDays.userId, userId), eq(diaryMeals.mealName, meal))
          : eq(diaryDays.userId, userId),
      )
      .groupBy(foods.id)
      // At least twice before it counts as "frequent"; ties break by recency.
      .having(gt(logCount, 1))
      .orderBy(desc(logCount), desc(sql`max(${diaryEntries.createdAt})`))
      .limit(20);

    return NextResponse.json({
      frequent: rows.map((row) => ({
        food: row.food,
        logCount: row.logCount,
        lastQuantity: row.lastQuantity,
        lastMultiplier: row.lastMultiplier,
        lastServing: row.lastServing,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
