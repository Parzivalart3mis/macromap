import { desc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { ApiError, handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { diaryDays, diaryEntries, diaryMeals } from "@/lib/db/schema";
import { computeStreak } from "@/lib/diary/streak";

/**
 * Logging streak. `today` comes from the client because diary days are keyed
 * by the user's local date, which the server cannot infer.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const today = request.nextUrl.searchParams.get("today");
    if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      throw new ApiError("invalid_request", "today must be YYYY-MM-DD", 400);
    }
    const rows = await db
      .selectDistinct({ date: diaryDays.date })
      .from(diaryDays)
      .innerJoin(diaryMeals, eq(diaryMeals.diaryDayId, diaryDays.id))
      .innerJoin(diaryEntries, eq(diaryEntries.diaryMealId, diaryMeals.id))
      .where(eq(diaryDays.userId, userId))
      .orderBy(desc(diaryDays.date))
      .limit(1000);

    const dates = rows.map((row) => row.date);
    // Recent logged dates power the week-strip checkmarks on the diary. The
    // strip renders ±35 days around today, so cover at least that far back.
    const windowStart = new Date(`${today}T12:00:00Z`);
    windowStart.setUTCDate(windowStart.getUTCDate() - 40);
    const cutoff = windowStart.toISOString().slice(0, 10);

    return NextResponse.json({
      streak: computeStreak(dates, today),
      recentDates: dates.filter((date) => date >= cutoff),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
