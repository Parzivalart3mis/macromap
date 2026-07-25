import { and, asc, eq, inArray } from "drizzle-orm";

import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import {
  customStoreOrders,
  diaryDays,
  diaryEntries,
  diaryMeals,
  foods,
  goalActivities,
  goalActivityExceptions,
  goalDays,
  goalProfiles,
  stores,
  type DiaryEntry,
  type DiaryMeal,
  type Food,
  type GoalActivity,
  type GoalActivityException,
  type GoalDay,
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

/** A logged entry plus whether its food currently carries the verified badge. */
export type DiaryEntryWithVerified = DiaryEntry & { verified: boolean };

export interface GoalTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarGMax: number | null;
  sodiumMgMax: number | null;
  satFatGMax: number | null;
}

/** One line of the target breakdown ("Base 2,100", "Legs A +312"). */
export interface GoalBreakdownLine {
  label: string;
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
}

export interface DiaryPayload {
  date: string;
  meals: Array<DiaryMeal & { entries: DiaryEntryWithVerified[]; totals: NutritionSnapshot }>;
  totals: NutritionSnapshot;
  goal: GoalTargets | null;
  /** Base + each active activity/exception, when the day's goal has activities. */
  goalBreakdown: GoalBreakdownLine[] | null;
}

/** Calorie contribution of a macro delta (activities store no calorie field). */
function deltaCalories(carbsG: number, proteinG: number, fatG: number): number {
  return 4 * carbsG + 4 * proteinG + 9 * fatG;
}

type BaseGoal = Pick<
  GoalDay,
  | "calories"
  | "carbsG"
  | "proteinG"
  | "fatG"
  | "fiberG"
  | "sugarGMax"
  | "sodiumMgMax"
  | "satFatGMax"
>;
type ActivityInput = Pick<
  GoalActivity,
  | "id"
  | "name"
  | "daysOfWeek"
  | "deltaCarbsG"
  | "deltaProteinG"
  | "deltaFatG"
  | "displayOrder"
  | "effectiveFrom"
  | "effectiveUntil"
>;
type ExceptionInput = Pick<
  GoalActivityException,
  "activityId" | "kind" | "label" | "deltaCarbsG" | "deltaProteinG" | "deltaFatG"
>;

/**
 * Pure target layering (no DB): final = base + each recurring activity matching
 * the weekday/date, adjusted by that date's exceptions (skip / override /
 * one-off). Calories auto-derive from macro deltas; fiber and ceiling limits stay
 * base-only; everything floors at 0.
 */
export function layerGoal(
  base: BaseGoal,
  activities: ActivityInput[],
  exceptions: ExceptionInput[],
  date: string,
  dayOfWeek: number,
): { goal: GoalTargets; breakdown: GoalBreakdownLine[] } {
  const exByActivity = new Map(
    exceptions.filter((e) => e.activityId).map((e) => [e.activityId as string, e]),
  );
  const oneOffs = exceptions.filter((e) => !e.activityId);

  let calories = base.calories;
  let carbsG = base.carbsG;
  let proteinG = base.proteinG;
  let fatG = base.fatG;
  const breakdown: GoalBreakdownLine[] = [
    { label: "Base", calories: base.calories, carbsG: base.carbsG, proteinG: base.proteinG, fatG: base.fatG },
  ];

  const inWindow = (from: string | null, until: string | null) =>
    (!from || from <= date) && (!until || date <= until);
  const matching = activities
    .filter((a) => a.daysOfWeek.includes(dayOfWeek) && inWindow(a.effectiveFrom, a.effectiveUntil))
    .sort((x, y) => x.displayOrder - y.displayOrder);

  const apply = (label: string, dC: number, dP: number, dF: number) => {
    carbsG += dC;
    proteinG += dP;
    fatG += dF;
    const dCal = deltaCalories(dC, dP, dF);
    calories += dCal;
    breakdown.push({ label, calories: dCal, carbsG: dC, proteinG: dP, fatG: dF });
  };

  for (const a of matching) {
    const ex = exByActivity.get(a.id);
    if (ex?.kind === "skip") continue;
    const override = ex?.kind === "override";
    apply(
      a.name,
      override ? (ex!.deltaCarbsG ?? 0) : a.deltaCarbsG,
      override ? (ex!.deltaProteinG ?? 0) : a.deltaProteinG,
      override ? (ex!.deltaFatG ?? 0) : a.deltaFatG,
    );
  }
  for (const o of oneOffs) {
    apply(o.label ?? "One-off", o.deltaCarbsG ?? 0, o.deltaProteinG ?? 0, o.deltaFatG ?? 0);
  }

  const goal: GoalTargets = {
    calories: Math.max(0, Math.round(calories)),
    proteinG: Math.max(0, proteinG),
    carbsG: Math.max(0, carbsG),
    fatG: Math.max(0, fatG),
    fiberG: base.fiberG,
    sugarGMax: base.sugarGMax,
    sodiumMgMax: base.sodiumMgMax,
    satFatGMax: base.satFatGMax,
  };
  return { goal, breakdown };
}

/** Fetch base + activities + exceptions for a profile/date and layer them. */
async function resolveGoal(
  goalProfileId: string,
  date: string,
  dayOfWeek: number,
): Promise<{ goal: GoalTargets | null; breakdown: GoalBreakdownLine[] | null }> {
  const [goalDay] = await db
    .select()
    .from(goalDays)
    .where(and(eq(goalDays.goalProfileId, goalProfileId), eq(goalDays.dayOfWeek, dayOfWeek)))
    .limit(1);
  if (!goalDay) return { goal: null, breakdown: null };

  const [activities, exceptions] = await Promise.all([
    db.select().from(goalActivities).where(eq(goalActivities.goalProfileId, goalProfileId)),
    db
      .select()
      .from(goalActivityExceptions)
      .where(
        and(
          eq(goalActivityExceptions.goalProfileId, goalProfileId),
          eq(goalActivityExceptions.date, date),
        ),
      ),
  ]);
  const { goal, breakdown } = layerGoal(goalDay, activities, exceptions, date, dayOfWeek);
  // Only worth surfacing a breakdown when something layered onto the base.
  return { goal, breakdown: breakdown.length > 1 ? breakdown : null };
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

  let meals: Array<DiaryMeal & { entries: DiaryEntryWithVerified[]; totals: NutritionSnapshot }> =
    [];
  if (day) {
    const mealRows = await db
      .select()
      .from(diaryMeals)
      .where(eq(diaryMeals.diaryDayId, day.id))
      .orderBy(asc(diaryMeals.displayOrder), asc(diaryMeals.mealName));
    const rawEntries = mealRows.length
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

    // Verification is read live from the food (one lookup for the whole day),
    // not frozen into the snapshot — so a food promoted to official later
    // shows its badge on entries that were logged before the promotion.
    const foodIds = [...new Set(rawEntries.map((e) => e.foodId).filter((id): id is string => !!id))];
    const verifiedIds = new Set(
      foodIds.length
        ? (
            await db
              .select({ id: foods.id, isVerified: foods.isVerified })
              .from(foods)
              .where(inArray(foods.id, foodIds))
          )
            .filter((f) => f.isVerified)
            .map((f) => f.id)
        : [],
    );
    const entryRows: DiaryEntryWithVerified[] = rawEntries.map((entry) => ({
      ...entry,
      verified: entry.foodId ? verifiedIds.has(entry.foodId) : false,
    }));

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
  let goal: GoalTargets | null = null;
  let goalBreakdown: GoalBreakdownLine[] | null = null;
  if (goalProfileId) {
    const resolved = await resolveGoal(goalProfileId, date, dayOfWeek);
    goal = resolved.goal;
    goalBreakdown = resolved.breakdown;
  }

  return { date, meals, totals, goal, goalBreakdown };
}
