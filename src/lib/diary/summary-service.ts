import { and, desc, eq, gte, lt } from "drizzle-orm";

import { summarizeDay } from "@/lib/ai/daily-insights";
import { addDaysISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { diaryDays, diaryEntries, diaryMeals } from "@/lib/db/schema";
import {
  shortLabel,
  summaryFingerprint,
  type RecentFood,
  type SummaryContext,
} from "@/lib/diary/day-summary";
import { getDiaryPayload, getOrCreateDiaryDay } from "@/lib/diary/service";
import type { DaySummary } from "@/types/summary";

/** How far back "foods you already log" reaches. */
const FOOD_WINDOW_DAYS = 28;

/** Recent daily totals and the user's regular foods, for comparison and suggestions. */
export async function loadSummaryContext(userId: string, date: string): Promise<SummaryContext> {
  const rows = await db
    .select({ date: diaryDays.date, snapshot: diaryEntries.nutritionSnapshotJson })
    .from(diaryDays)
    .innerJoin(diaryMeals, eq(diaryMeals.diaryDayId, diaryDays.id))
    .innerJoin(diaryEntries, eq(diaryEntries.diaryMealId, diaryMeals.id))
    .where(
      and(
        eq(diaryDays.userId, userId),
        gte(diaryDays.date, addDaysISO(date, -FOOD_WINDOW_DAYS)),
        lt(diaryDays.date, date),
      ),
    )
    .orderBy(desc(diaryDays.date));

  const dayTotals = new Map<string, { date: string; calories: number; proteinG: number }>();
  const foods = new Map<string, RecentFood>();
  for (const { date: day, snapshot } of rows) {
    const totals = dayTotals.get(day) ?? { date: day, calories: 0, proteinG: 0 };
    totals.calories += snapshot.calories;
    totals.proteinG += snapshot.proteinG;
    dayTotals.set(day, totals);

    // Newest-first, so the first sighting of a food sets its serving and numbers.
    const label = shortLabel(snapshot.label);
    const food = foods.get(label);
    if (food) {
      food.count += 1;
    } else {
      foods.set(label, {
        label,
        serving: snapshot.serving,
        calories: Math.round(snapshot.calories),
        proteinG: Math.round(snapshot.proteinG),
        fiberG: Math.round(snapshot.fiberG ?? 0),
        count: 1,
      });
    }
  }

  return {
    recentDays: [...dayTotals.values()].slice(0, 7).map((day) => ({
      date: day.date,
      calories: Math.round(day.calories),
      proteinG: Math.round(day.proteinG),
    })),
    recentFoods: [...foods.values()].sort((a, b) => b.count - a.count).slice(0, 25),
  };
}

/** Build a day's summary without saving it. */
export async function previewDaySummary(userId: string, date: string): Promise<DaySummary> {
  const [payload, context] = await Promise.all([
    getDiaryPayload(userId, date),
    loadSummaryContext(userId, date),
  ]);
  return summarizeDay(payload, context);
}

/**
 * Generate and save the day's summary, and mark the day complete (keeping the
 * original completion time). Unless forced, a day with nothing logged is
 * skipped and a summary that still matches the diary is returned as-is, so
 * repeated calls from the cron and the app only pay for AI when the day changed.
 */
export async function ensureDaySummary(
  userId: string,
  date: string,
  { force = false }: { force?: boolean } = {},
): Promise<DaySummary | null> {
  const payload = await getDiaryPayload(userId, date);
  if (!force) {
    if (!payload.meals.some((meal) => meal.entries.length > 0)) return null;
    if (payload.analysis?.fingerprint === summaryFingerprint(payload)) return payload.analysis;
  }

  const context = await loadSummaryContext(userId, date);
  const summary = await summarizeDay(payload, context);
  const day = await getOrCreateDiaryDay(userId, date);
  await db
    .update(diaryDays)
    .set({ analysisJson: summary, completedAt: day.completedAt ?? new Date() })
    .where(eq(diaryDays.id, day.id));
  return summary;
}
