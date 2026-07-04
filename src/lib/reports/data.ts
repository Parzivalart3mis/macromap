import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  bodyMetricLogs,
  diaryDays,
  diaryEntries,
  diaryMeals,
  weightLogs,
  type BodyMetricLog,
  type WeightLog,
} from "@/lib/db/schema";
import { roundNutrition, sumNutrition } from "@/lib/nutrition";
import type { NutritionSnapshot } from "@/types/nutrition";

export interface ReportEntry {
  mealName: string;
  label: string;
  quantity: number;
  nutrition: NutritionSnapshot;
}

export interface ReportDay {
  date: string;
  totals: NutritionSnapshot;
  entries: ReportEntry[];
}

export interface ReportData {
  from: string;
  to: string;
  days: ReportDay[];
  weights: WeightLog[];
  bodyMetrics: BodyMetricLog[];
}

export async function getReportData(
  userId: string,
  from: string,
  to: string,
): Promise<ReportData> {
  const dayRows = await db
    .select()
    .from(diaryDays)
    .where(
      and(eq(diaryDays.userId, userId), gte(diaryDays.date, from), lte(diaryDays.date, to)),
    )
    .orderBy(asc(diaryDays.date));

  const dayIds = dayRows.map((d) => d.id);
  const mealRows = dayIds.length
    ? await db.select().from(diaryMeals).where(inArray(diaryMeals.diaryDayId, dayIds))
    : [];
  const mealIds = mealRows.map((m) => m.id);
  const entryRows = mealIds.length
    ? await db
        .select()
        .from(diaryEntries)
        .where(inArray(diaryEntries.diaryMealId, mealIds))
        .orderBy(asc(diaryEntries.createdAt))
    : [];

  const mealsById = new Map(mealRows.map((m) => [m.id, m]));
  const days: ReportDay[] = dayRows.map((day) => {
    const dayMealIds = new Set(
      mealRows.filter((m) => m.diaryDayId === day.id).map((m) => m.id),
    );
    const entries = entryRows
      .filter((entry) => dayMealIds.has(entry.diaryMealId))
      .map((entry) => ({
        mealName: mealsById.get(entry.diaryMealId)?.mealName ?? "Meal",
        label: entry.nutritionSnapshotJson.label,
        quantity: entry.quantity * entry.servingMultiplier,
        nutrition: entry.nutritionSnapshotJson,
      }));
    return {
      date: day.date,
      totals: roundNutrition(sumNutrition(entries.map((e) => e.nutrition))),
      entries,
    };
  });

  const weights = await db
    .select()
    .from(weightLogs)
    .where(
      and(eq(weightLogs.userId, userId), gte(weightLogs.date, from), lte(weightLogs.date, to)),
    )
    .orderBy(asc(weightLogs.date));

  const bodyMetrics = await db
    .select()
    .from(bodyMetricLogs)
    .where(
      and(
        eq(bodyMetricLogs.userId, userId),
        gte(bodyMetricLogs.date, from),
        lte(bodyMetricLogs.date, to),
      ),
    )
    .orderBy(asc(bodyMetricLogs.date));

  return { from, to, days, weights, bodyMetrics };
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  days: Array<{ date: string; totals: NutritionSnapshot }>;
  averages: NutritionSnapshot;
  daysLogged: number;
  weightChange: number | null;
}

export function buildWeeklySummary(data: ReportData): WeeklySummary {
  const logged = data.days.filter((day) => day.entries.length > 0);
  const averages =
    logged.length > 0
      ? roundNutrition(
          Object.fromEntries(
            Object.entries(sumNutrition(logged.map((d) => d.totals))).map(
              ([key, value]) => [key, (value as number) / logged.length],
            ),
          ) as unknown as NutritionSnapshot,
        )
      : { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

  let weightChange: number | null = null;
  if (data.weights.length >= 2) {
    const first = data.weights[0].weightValue;
    const last = data.weights[data.weights.length - 1].weightValue;
    weightChange = Math.round((last - first) * 100) / 100;
  }

  return {
    weekStart: data.from,
    weekEnd: data.to,
    days: data.days.map((day) => ({ date: day.date, totals: day.totals })),
    averages,
    daysLogged: logged.length,
    weightChange,
  };
}
