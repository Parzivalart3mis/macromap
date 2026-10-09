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
  type GoalPhase,
} from "@/lib/db/schema";
import { foodToNutrition, roundNutrition, scaleNutrition, sumNutrition } from "@/lib/nutrition";
import { scaleServingText } from "@/lib/units";
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
    .select({ id: goalProfiles.id, activePhase: goalProfiles.activePhase })
    .from(goalProfiles)
    .where(and(eq(goalProfiles.userId, userId), eq(goalProfiles.isActive, true)))
    .limit(1);

  // Pin both the profile and its phase, so changing either later leaves this
  // day's targets exactly as they were when it was logged.
  const [created] = await db
    .insert(diaryDays)
    .values({
      userId,
      date,
      goalProfileId: activeGoal?.id ?? null,
      goalPhase: activeGoal?.activePhase ?? null,
    })
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
  /** Foodless Quick-Add: raw macros the user typed in. */
  raw?: {
    label: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
}

export async function resolveEntrySource(
  userId: string,
  foodId?: string,
  customStoreOrderId?: string,
  quickAdd?: EntrySource["raw"],
): Promise<EntrySource> {
  if (quickAdd) {
    return { raw: quickAdd };
  }
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
  if (source.raw) {
    const base: NutritionSnapshot = {
      calories: source.raw.calories,
      proteinG: source.raw.proteinG,
      carbsG: source.raw.carbsG,
      fatG: source.raw.fatG,
    };
    return {
      ...roundNutrition(scaleNutrition(base, factor)),
      label: source.raw.label,
      serving,
    };
  }
  throw new ApiError("invalid_request", "Entry source missing", 400);
}

/** The frozen snapshot shape carried by every diary entry. */
export type EntrySnapshot = NutritionSnapshot & {
  label: string;
  serving?: string;
  brand?: string;
};

/**
 * Rebuild an entry's frozen snapshot for a new quantity and/or serving unit.
 * Nutrition always rescales from the stored snapshot (never the live food) so
 * history stays immutable even after the shared food is edited.
 *
 * The serving text is the subtle part. Changing only the *count* means the old
 * text just scales ("2 slices" ×2 → "4 slices"). Changing the *unit* does not:
 * scaling "1 cup (245 g)" by 0.408 yields "0.41 cup" when the truth is "100 g".
 * So callers that switch units pass the chosen option's label explicitly and it
 * is used verbatim; callers that only change the count omit it and keep the
 * scaling behaviour.
 */
export function rescaleEntrySnapshot(
  snapshot: EntrySnapshot,
  ratio: number,
  servingText?: string,
): EntrySnapshot {
  const { label, serving, brand, ...nutrition } = snapshot;
  const explicit = servingText?.trim();
  return {
    ...roundNutrition(scaleNutrition(nutrition as NutritionSnapshot, ratio)),
    label,
    serving: explicit || scaleServingText(serving, ratio),
    brand,
  };
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

/** A recurring activity that matches the day, with its per-date state (for the adjust UI). */
export interface DayActivity {
  activityId: string;
  name: string;
  carbsG: number;
  proteinG: number;
  fatG: number;
  calories: number;
  skipped: boolean;
  overridden: boolean;
  /** The skip/override exception on this date, if any (to remove it). */
  exceptionId: string | null;
}

/** A one-off adjustment logged for this date only. */
export interface DayOneOff {
  exceptionId: string;
  label: string;
  carbsG: number;
  proteinG: number;
  fatG: number;
  calories: number;
}

export interface DiaryPayload {
  date: string;
  meals: Array<DiaryMeal & { entries: DiaryEntryWithVerified[]; totals: NutritionSnapshot }>;
  totals: NutritionSnapshot;
  goal: GoalTargets | null;
  /** The pinned/active profile whose goal this day resolves to (for adjustments). */
  goalProfileId: string | null;
  /** The phase this day's targets came from, pinned at creation. */
  goalPhase: GoalPhase | null;
  /** Base + each active activity/exception, when the day's goal has activities. */
  goalBreakdown: GoalBreakdownLine[] | null;
  /** Recurring activities matching this weekday, with per-date state; null if none. */
  dayActivities: DayActivity[] | null;
  /** One-off adjustments for this date; null if none. */
  dayOneOffs: DayOneOff[] | null;
  /** ISO time the day was marked complete, else null. */
  completedAt: string | null;
  /** Saved AI analysis for the day, else null. */
  analysis: string[] | null;
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
  "id" | "activityId" | "kind" | "label" | "deltaCarbsG" | "deltaProteinG" | "deltaFatG"
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
): {
  goal: GoalTargets;
  breakdown: GoalBreakdownLine[];
  dayActivities: DayActivity[];
  dayOneOffs: DayOneOff[];
} {
  const exByActivity = new Map(
    exceptions.filter((e) => e.activityId).map((e) => [e.activityId as string, e]),
  );
  const oneOffExceptions = exceptions.filter((e) => !e.activityId);

  let calories = base.calories;
  let carbsG = base.carbsG;
  let proteinG = base.proteinG;
  let fatG = base.fatG;
  const breakdown: GoalBreakdownLine[] = [
    { label: "Base", calories: base.calories, carbsG: base.carbsG, proteinG: base.proteinG, fatG: base.fatG },
  ];
  const dayActivities: DayActivity[] = [];
  const dayOneOffs: DayOneOff[] = [];

  const inWindow = (from: string | null, until: string | null) =>
    (!from || from <= date) && (!until || date <= until);
  const matching = activities
    .filter((a) => a.daysOfWeek.includes(dayOfWeek) && inWindow(a.effectiveFrom, a.effectiveUntil))
    .sort((x, y) => x.displayOrder - y.displayOrder);

  for (const a of matching) {
    const ex = exByActivity.get(a.id);
    const skipped = ex?.kind === "skip";
    const overridden = ex?.kind === "override";
    const dC = overridden ? (ex!.deltaCarbsG ?? 0) : a.deltaCarbsG;
    const dP = overridden ? (ex!.deltaProteinG ?? 0) : a.deltaProteinG;
    const dF = overridden ? (ex!.deltaFatG ?? 0) : a.deltaFatG;
    const dCal = deltaCalories(dC, dP, dF);
    // State for the adjust UI (skipped activities still listed so they can be restored).
    dayActivities.push({
      activityId: a.id,
      name: a.name,
      carbsG: dC,
      proteinG: dP,
      fatG: dF,
      calories: dCal,
      skipped,
      overridden,
      exceptionId: ex?.id ?? null,
    });
    if (skipped) continue;
    carbsG += dC;
    proteinG += dP;
    fatG += dF;
    calories += dCal;
    breakdown.push({ label: a.name, calories: dCal, carbsG: dC, proteinG: dP, fatG: dF });
  }

  for (const o of oneOffExceptions) {
    const dC = o.deltaCarbsG ?? 0;
    const dP = o.deltaProteinG ?? 0;
    const dF = o.deltaFatG ?? 0;
    const dCal = deltaCalories(dC, dP, dF);
    const label = o.label ?? "One-off";
    dayOneOffs.push({ exceptionId: o.id, label, carbsG: dC, proteinG: dP, fatG: dF, calories: dCal });
    carbsG += dC;
    proteinG += dP;
    fatG += dF;
    calories += dCal;
    breakdown.push({ label, calories: dCal, carbsG: dC, proteinG: dP, fatG: dF });
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
  return { goal, breakdown, dayActivities, dayOneOffs };
}

/** Fetch base + activities + exceptions for a profile/date and layer them. */
async function resolveGoal(
  goalProfileId: string,
  phase: GoalPhase,
  date: string,
  dayOfWeek: number,
): Promise<{
  goal: GoalTargets | null;
  breakdown: GoalBreakdownLine[] | null;
  dayActivities: DayActivity[] | null;
  dayOneOffs: DayOneOff[] | null;
}> {
  // A phase the user has not filled in has no rows at all; the caller surfaces
  // that as "this phase isn't set up" rather than silently borrowing another's.
  const [goalDay] = await db
    .select()
    .from(goalDays)
    .where(
      and(
        eq(goalDays.goalProfileId, goalProfileId),
        eq(goalDays.phase, phase),
        eq(goalDays.dayOfWeek, dayOfWeek),
      ),
    )
    .limit(1);
  if (!goalDay) return { goal: null, breakdown: null, dayActivities: null, dayOneOffs: null };

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
  const { goal, breakdown, dayActivities, dayOneOffs } = layerGoal(
    goalDay,
    activities,
    exceptions,
    date,
    dayOfWeek,
  );
  return {
    goal,
    // Only worth a breakdown when something layered onto the base.
    breakdown: breakdown.length > 1 ? breakdown : null,
    dayActivities: dayActivities.length ? dayActivities : null,
    dayOneOffs: dayOneOffs.length ? dayOneOffs : null,
  };
}

/**
 * The one weekly-target row for a given profile, phase and weekday.
 *
 * Pulled out because reading `goal_days` without filtering on phase is a live
 * hazard: a profile holds up to four complete tables, so an unfiltered lookup
 * silently returns whichever phase the database happened to order last.
 */
export function selectGoalDay<
  T extends { goalProfileId: string; phase: GoalPhase; dayOfWeek: number },
>(rows: T[], profileId: string, phase: GoalPhase, dayOfWeek: number): T | undefined {
  return rows.find(
    (r) => r.goalProfileId === profileId && r.phase === phase && r.dayOfWeek === dayOfWeek,
  );
}

/**
 * Daily targets for a run of dates, resolved the same way the diary resolves a
 * single day: each date uses its own pinned profile and phase, falling back to
 * the active profile for dates with no diary row yet, and activities are
 * layered on with that date's exceptions applied.
 *
 * Exists so charts cannot drift from the diary. The Progress chart previously
 * read `goal_days.calories` directly, which ignored activities and — once a
 * profile could hold four phases — silently picked an arbitrary one.
 *
 * Four queries regardless of how many dates are asked for.
 */
export async function resolveGoalsForDates(
  userId: string,
  dates: string[],
): Promise<Map<string, GoalTargets | null>> {
  const result = new Map<string, GoalTargets | null>(dates.map((d) => [d, null]));
  if (dates.length === 0) return result;

  const [dayRows, activeRows] = await Promise.all([
    db
      .select({
        date: diaryDays.date,
        goalProfileId: diaryDays.goalProfileId,
        goalPhase: diaryDays.goalPhase,
      })
      .from(diaryDays)
      .where(and(eq(diaryDays.userId, userId), inArray(diaryDays.date, dates))),
    db
      .select({ id: goalProfiles.id, activePhase: goalProfiles.activePhase })
      .from(goalProfiles)
      .where(and(eq(goalProfiles.userId, userId), eq(goalProfiles.isActive, true)))
      .limit(1),
  ]);
  const active = activeRows[0];
  const pinned = new Map(dayRows.map((d) => [d.date, d]));

  // Which (profile, phase) each date resolves to, and the profiles involved.
  const resolved = new Map<string, { profileId: string; phase: GoalPhase }>();
  for (const date of dates) {
    const day = pinned.get(date);
    const profileId = day?.goalProfileId ?? active?.id ?? null;
    if (!profileId) continue;
    const phase =
      day?.goalPhase ??
      (day?.goalProfileId && day.goalProfileId !== active?.id
        ? "maintenance" // a day pinned to another profile predates phases
        : (active?.activePhase ?? "maintenance"));
    resolved.set(date, { profileId, phase });
  }
  const profileIds = [...new Set([...resolved.values()].map((r) => r.profileId))];
  if (profileIds.length === 0) return result;

  const [dayTargets, activities, exceptions] = await Promise.all([
    db.select().from(goalDays).where(inArray(goalDays.goalProfileId, profileIds)),
    db.select().from(goalActivities).where(inArray(goalActivities.goalProfileId, profileIds)),
    db
      .select()
      .from(goalActivityExceptions)
      .where(
        and(
          inArray(goalActivityExceptions.goalProfileId, profileIds),
          inArray(goalActivityExceptions.date, dates),
        ),
      ),
  ]);

  for (const [date, { profileId, phase }] of resolved) {
    const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
    const base = selectGoalDay(dayTargets, profileId, phase, dayOfWeek);
    if (!base) continue; // that phase has no table — no target rather than a wrong one
    const { goal } = layerGoal(
      base,
      activities.filter((a) => a.goalProfileId === profileId),
      exceptions.filter((e) => e.goalProfileId === profileId && e.date === date),
      date,
      dayOfWeek,
    );
    result.set(date, goal);
  }
  return result;
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

  // Day-of-week goal from the day's pinned profile and phase, else the active
  // profile and its current phase. Days created before phases existed carry a
  // null goalPhase and fall back to the profile's phase.
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  let goalProfileId = day?.goalProfileId ?? null;
  let goalPhase: GoalPhase | null = day?.goalPhase ?? null;
  if (!goalProfileId || !goalPhase) {
    const [active] = await db
      .select({ id: goalProfiles.id, activePhase: goalProfiles.activePhase })
      .from(goalProfiles)
      .where(
        goalProfileId
          ? eq(goalProfiles.id, goalProfileId)
          : and(eq(goalProfiles.userId, userId), eq(goalProfiles.isActive, true)),
      )
      .limit(1);
    goalProfileId ??= active?.id ?? null;
    goalPhase ??= active?.activePhase ?? null;
  }
  let goal: GoalTargets | null = null;
  let goalBreakdown: GoalBreakdownLine[] | null = null;
  let dayActivities: DayActivity[] | null = null;
  let dayOneOffs: DayOneOff[] | null = null;
  if (goalProfileId && goalPhase) {
    const resolved = await resolveGoal(goalProfileId, goalPhase, date, dayOfWeek);
    goal = resolved.goal;
    goalBreakdown = resolved.breakdown;
    dayActivities = resolved.dayActivities;
    dayOneOffs = resolved.dayOneOffs;
  }

  return {
    date,
    meals,
    totals,
    goal,
    goalProfileId,
    goalPhase,
    goalBreakdown,
    dayActivities,
    dayOneOffs,
    completedAt: day?.completedAt ? day.completedAt.toISOString() : null,
    analysis: day?.analysisJson ?? null,
  };
}
