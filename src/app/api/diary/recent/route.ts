import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { diaryDays, diaryEntries, diaryMeals, foods } from "@/lib/db/schema";

/** Distinct foods the user logged recently, newest first ("History" tab). */
export async function GET() {
  try {
    const userId = await requireUserId();
    const rows = await db
      .select({
        food: foods,
        // Effective amount in native servings: quantity is "servings of the
        // chosen unit", so fold in the unit's multiplier (e.g. 2 × "100 ml" of
        // a 1-cup food is ~0.85 native servings, not 2).
        lastQuantity: sql<number>`(round(((array_agg(${diaryEntries.quantity} * ${diaryEntries.servingMultiplier} order by ${diaryEntries.createdAt} desc))[1])::numeric, 2))::float8`,
        lastLoggedAt: sql<string>`max(${diaryEntries.createdAt})`,
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
      recent: rows.map((row) => ({ food: row.food, lastQuantity: row.lastQuantity })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

