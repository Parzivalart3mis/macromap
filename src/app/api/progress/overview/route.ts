import { and, asc, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import {
  bodyMetricLogs,
  diaryDays,
  diaryEntries,
  diaryMeals,
  profiles,
  weightLogs,
} from "@/lib/db/schema";
import { getDiaryPayload, resolveGoalsForDates } from "@/lib/diary/service";
import { getReportData } from "@/lib/reports/data";
import type { BiologicalSexDTO } from "@/types/api";

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

    // Targets come from the same resolver the diary uses, so the dashed line
    // always matches what that day actually showed: the day's own pinned
    // profile and phase, with activities and exceptions layered on.
    const historyDates = Array.from({ length: 14 }, (_, i) =>
      isoDate(new Date(now.getTime() - (13 - i) * 86_400_000)),
    );
    const goalsByDate = await resolveGoalsForDates(userId, historyDates);

    const calorieHistory = historyDates.map((date) => ({
      date,
      calories: recent.days.find((d) => d.date === date)?.totals.calories ?? 0,
      goal: goalsByDate.get(date)?.calories ?? null,
    }));

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
      .select({
        unitSystem: profiles.unitSystem,
        heightCm: profiles.heightCm,
        sex: profiles.sex,
        dateOfBirth: profiles.dateOfBirth,
      })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    const weightUnit = profile?.unitSystem === "imperial" ? "lb" : "kg";

    return NextResponse.json({
      today: { totals: todayPayload.totals, goal: todayPayload.goal },
      calorieHistory,
      loggedDates,
      weightUnit,
      // Needed to derive body fat and waist-to-height from the logged
      // circumferences; null until the user fills them in on their profile.
      heightCm: profile?.heightCm ?? null,
      sex: (profile?.sex as BiologicalSexDTO | null) ?? null,
      dateOfBirth: profile?.dateOfBirth ?? null,
      weights,
      bodyMetrics,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
