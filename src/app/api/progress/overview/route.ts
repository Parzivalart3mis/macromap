import { and, asc, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import {
  bodyMetricLogs,
  diaryDays,
  diaryEntries,
  diaryMeals,
  goalDays,
  goalProfiles,
  profiles,
  weightLogs,
} from "@/lib/db/schema";
import { getDiaryPayload } from "@/lib/diary/service";
import { getReportData } from "@/lib/reports/data";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Split dashboard payload: calories/macros on top, weight/measurements below. */
export async function GET() {
  try {
    const userId = await requireUserId();
    const now = new Date();
    const today = isoDate(now);
    const twoWeeksAgo = isoDate(new Date(now.getTime() - 13 * 86_400_000));
    const twelveWeeksAgo = isoDate(new Date(now.getTime() - 83 * 86_400_000));
    const ninetyDaysAgo = isoDate(new Date(now.getTime() - 89 * 86_400_000));

    const [todayPayload, recent] = await Promise.all([
      getDiaryPayload(userId, today),
      getReportData(userId, twoWeeksAgo, today),
    ]);

    // Map each weekday to its goal calories from the active profile.
    const [activeProfile] = await db
      .select({ id: goalProfiles.id })
      .from(goalProfiles)
      .where(and(eq(goalProfiles.userId, userId), eq(goalProfiles.isActive, true)))
      .limit(1);
    const goalByDow = new Map<number, number>();
    if (activeProfile) {
      const days = await db
        .select()
        .from(goalDays)
        .where(eq(goalDays.goalProfileId, activeProfile.id));
      for (const day of days) goalByDow.set(day.dayOfWeek, day.calories);
    }

    const calorieHistory: Array<{ date: string; calories: number; goal: number | null }> = [];
    for (let i = 13; i >= 0; i--) {
      const date = isoDate(new Date(now.getTime() - i * 86_400_000));
      const day = recent.days.find((d) => d.date === date);
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      calorieHistory.push({
        date,
        calories: day?.totals.calories ?? 0,
        goal: goalByDow.get(dow) ?? null,
      });
    }

    // Distinct dates in the last 12 weeks that have at least one logged entry,
    // for the consistency heatmap.
    const loggedRows = await db
      .selectDistinct({ date: diaryDays.date })
      .from(diaryDays)
      .innerJoin(diaryMeals, eq(diaryMeals.diaryDayId, diaryDays.id))
      .innerJoin(diaryEntries, eq(diaryEntries.diaryMealId, diaryMeals.id))
      .where(and(eq(diaryDays.userId, userId), gte(diaryDays.date, twelveWeeksAgo)));
    const loggedDates = loggedRows.map((row) => row.date);

    const weights = await db
      .select()
      .from(weightLogs)
      .where(and(eq(weightLogs.userId, userId), gte(weightLogs.date, ninetyDaysAgo)))
      .orderBy(asc(weightLogs.date));

    const bodyMetrics = await db
      .select()
      .from(bodyMetricLogs)
      .where(and(eq(bodyMetricLogs.userId, userId), gte(bodyMetricLogs.date, ninetyDaysAgo)))
      .orderBy(asc(bodyMetricLogs.date));

    const [profile] = await db
      .select({ unitSystem: profiles.unitSystem })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    const weightUnit = profile?.unitSystem === "imperial" ? "lb" : "kg";

    return NextResponse.json({
      today: { totals: todayPayload.totals, goal: todayPayload.goal },
      calorieHistory,
      loggedDates,
      weightUnit,
      weights,
      bodyMetrics,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
