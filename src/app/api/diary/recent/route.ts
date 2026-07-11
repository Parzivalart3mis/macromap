import { desc, eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { diaryDays, diaryEntries, diaryMeals, foods } from "@/lib/db/schema";

/**
 * Distinct foods the user logged recently ("History" tab). With ?meal=, foods
 * the user habitually logs in that meal (last 60 days) rank first — coffee
 * surfaces at Breakfast — with recency breaking ties; without it, newest first.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const mealParam = request.nextUrl.searchParams.get("meal");
    const meal = mealParam && mealParam.length <= 40 ? mealParam : null;

    const mealCount = meal
      ? sql<number>`(count(*) filter (where ${diaryMeals.mealName} = ${meal}
          and ${diaryEntries.createdAt} > now() - interval '60 days'))::int`
      : sql<number>`0`;

    const rows = await db
      .select({
        food: foods,
        // Effective amount in native servings: quantity is "servings of the
        // chosen unit", so fold in the unit's multiplier (e.g. 2 × "100 ml" of
        // a 1-cup food is ~0.85 native servings, not 2).
        lastQuantity: sql<number>`(round(((array_agg(${diaryEntries.quantity} * ${diaryEntries.servingMultiplier} order by ${diaryEntries.createdAt} desc))[1])::numeric, 2))::float8`,
        lastLoggedAt: sql<string>`max(${diaryEntries.createdAt})`,
        mealCount,
      })
      .from(diaryEntries)
      .innerJoin(diaryMeals, eq(diaryMeals.id, diaryEntries.diaryMealId))
      .innerJoin(diaryDays, eq(diaryDays.id, diaryMeals.diaryDayId))
      .innerJoin(foods, eq(foods.id, diaryEntries.foodId))
      .where(eq(diaryDays.userId, userId))
      .groupBy(foods.id)
      .orderBy(desc(mealCount), desc(sql`max(${diaryEntries.createdAt})`))
      .limit(20);

    return NextResponse.json({
      recent: rows.map((row) => ({ food: row.food, lastQuantity: row.lastQuantity })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
