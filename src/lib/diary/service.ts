import { and, asc, eq, inArray } from "drizzle-orm";

import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import {
  customStoreOrders,
  diaryDays,
  diaryEntries,
  diaryMeals,
  foods,
  goalDays,
  goalProfiles,
  stores,
  type DiaryEntry,
  type DiaryMeal,
  type Food,
} from "@/lib/db/schema";
import { foodToNutrition, roundNutrition, scaleNutrition, sumNutrition } from "@/lib/nutrition";
import type { NutritionSnapshot } from "@/types/nutrition";

export const DEFAULT_MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

export async function getOrCreateDiaryDay(userId: string, date: string) {
  const existing = await db
    .select()
    .from(diaryDays)
    .where(and(eq(diaryDays.userId, userId), eq(diaryDays.date, date)))
    .limit(1);
  if (existing[0]) return existing[0];

  const [activeGoal] = await db
    .select({ id: goalProfiles.id })
    .from(goalProfiles)
    .where(and(eq(goalProfiles.userId, userId), eq(goalProfiles.isActive, true)))
    .limit(1);

  const [created] = await db
    .insert(diaryDays)
    .values({ userId, date, goalProfileId: activeGoal?.id ?? null })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Lost a concurrent race — the row exists now.
  const [row] = await db
    .select()
    .from(diaryDays)
    .where(and(eq(diaryDays.userId, userId), eq(diaryDays.date, date)))
    .limit(1);
  return row;
}

export async function getOrCreateMeal(diaryDayId: string, mealName: string) {
  const existing = await db
    .select()
    .from(diaryMeals)
    .where(and(eq(diaryMeals.diaryDayId, diaryDayId), eq(diaryMeals.mealName, mealName)))
    .limit(1);
  if (existing[0]) return existing[0];

  const defaultIndex = DEFAULT_MEALS.indexOf(mealName as (typeof DEFAULT_MEALS)[number]);
  const displayOrder = defaultIndex >= 0 ? defaultIndex : 10;
  const [created] = await db
    .insert(diaryMeals)
    .values({ diaryDayId, mealName, displayOrder })
    .returning();
  return created;
}

export interface EntrySource {
  food?: Food;
  order?: {
    id: string;
    name: string;
    nutritionSnapshotJson: NutritionSnapshot;
    storeName: string | null;
  };
}

export async function resolveEntrySource(
  userId: string,
  foodId?: string,
  customStoreOrderId?: string,
): Promise<EntrySource> {
  if (foodId) {
    const [food] = await db.select().from(foods).where(eq(foods.id, foodId)).limit(1);
    if (!food) throw new ApiError("not_found", "Food not found", 404);
    return { food };
  }
  if (customStoreOrderId) {
    // Join the store so the entry can record the store as its brand.
    const [order] = await db
      .select({
        id: customStoreOrders.id,
        name: customStoreOrders.name,
        nutritionSnapshotJson: customStoreOrders.nutritionSnapshotJson,
        storeName: stores.name,
      })
      .from(customStoreOrders)
      .leftJoin(stores, eq(stores.id, customStoreOrders.storeId))
      .where(
        and(
          eq(customStoreOrders.id, customStoreOrderId),
          eq(customStoreOrders.userId, userId),
        ),
      )
      .limit(1);
    if (!order) throw new ApiError("not_found", "Custom order not found", 404);
    return { order };
  }
  throw new ApiError("invalid_request", "foodId or customStoreOrderId required", 400);
}

export function buildEntrySnapshot(
  source: EntrySource,
  quantity: number,
  servingMultiplier: number,
  servingText?: string,
): NutritionSnapshot & { label: string; serving?: string; brand?: string } {
  const factor = quantity * servingMultiplier;
  const serving = servingText?.trim() || undefined;
  if (source.food) {
    const base = foodToNutrition(source.food);
    const label = source.food.brandName
      ? `${source.food.name} (${source.food.brandName})`
      : source.food.name;
    return {
      ...roundNutrition(scaleNutrition(base, factor)),
      label,
      serving,
      brand: source.food.brandName ?? undefined,
    };
  }
  if (source.order) {
    return {
      ...roundNutrition(scaleNutrition(source.order.nutritionSnapshotJson, factor)),
      label: source.order.name,
      serving,
      brand: source.order.storeName ?? undefined,
    };
  }
  throw new ApiError("invalid_request", "Entry source missing", 400);
}

export interface DiaryPayload {
  date: string;
  meals: Array<DiaryMeal & { entries: DiaryEntry[]; totals: NutritionSnapshot }>;
  totals: NutritionSnapshot;
  goal: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number | null;
    sugarGMax: number | null;
    sodiumMgMax: number | null;
    satFatGMax: number | null;
  } | null;
}

export async function getDiaryPayload(
  userId: string,
  date: string,
): Promise<DiaryPayload> {
  const [day] = await db
    .select()
    .from(diaryDays)
    .where(and(eq(diaryDays.userId, userId), eq(diaryDays.date, date)))
    .limit(1);

  let meals: Array<DiaryMeal & { entries: DiaryEntry[]; totals: NutritionSnapshot }> = [];
  if (day) {
    const mealRows = await db
      .select()
      .from(diaryMeals)
      .where(eq(diaryMeals.diaryDayId, day.id))
      .orderBy(asc(diaryMeals.displayOrder), asc(diaryMeals.mealName));
    const entryRows = mealRows.length
      ? await db
          .select()
          .from(diaryEntries)
          .where(
            inArray(
              diaryEntries.diaryMealId,
              mealRows.map((m) => m.id),
            ),
          )
          .orderBy(asc(diaryEntries.createdAt))
      : [];
    meals = mealRows.map((meal) => {
      const entries = entryRows.filter((entry) => entry.diaryMealId === meal.id);
      return {
        ...meal,
        entries,
        totals: roundNutrition(
          sumNutrition(entries.map((entry) => entry.nutritionSnapshotJson)),
        ),
      };
    });
  }

  const totals = roundNutrition(sumNutrition(meals.map((meal) => meal.totals)));

  // Day-of-week goal from the day's pinned profile, else the active profile.
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  let goalProfileId = day?.goalProfileId ?? null;
  if (!goalProfileId) {
    const [active] = await db
      .select({ id: goalProfiles.id })
      .from(goalProfiles)
      .where(and(eq(goalProfiles.userId, userId), eq(goalProfiles.isActive, true)))
      .limit(1);
    goalProfileId = active?.id ?? null;
  }
  let goal: DiaryPayload["goal"] = null;
  if (goalProfileId) {
    const [goalDay] = await db
      .select()
      .from(goalDays)
      .where(
        and(eq(goalDays.goalProfileId, goalProfileId), eq(goalDays.dayOfWeek, dayOfWeek)),
      )
      .limit(1);
    if (goalDay) {
      goal = {
        calories: goalDay.calories,
        proteinG: goalDay.proteinG,
        carbsG: goalDay.carbsG,
        fatG: goalDay.fatG,
        fiberG: goalDay.fiberG,
        sugarGMax: goalDay.sugarGMax,
        sodiumMgMax: goalDay.sodiumMgMax,
        satFatGMax: goalDay.satFatGMax,
      };
    }
  }

  return { date, meals, totals, goal };
}
