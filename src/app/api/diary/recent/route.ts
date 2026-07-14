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
        // The last log's exact serving choice — quantity in the chosen unit,
        // that unit's multiplier, and its display text ("1 large (136 g)") —
        // so re-logging from History reproduces it verbatim instead of
        // folding back to native servings.
        lastQuantity: sql<number>`(round(((array_agg(${diaryEntries.quantity} order by ${diaryEntries.createdAt} desc))[1])::numeric, 2))::float8`,
        lastMultiplier: sql<number>`((array_agg(${diaryEntries.servingMultiplier} order by ${diaryEntries.createdAt} desc))[1])::float8`,
        lastServing: sql<string | null>`(array_agg(${diaryEntries.nutritionSnapshotJson}->>'serving' order by ${diaryEntries.createdAt} desc))[1]`,
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
