import type { DiaryPayload } from "@/lib/diary/service";
import type { NutritionSnapshot } from "@/types/nutrition";
import type { DaySummary, SummaryStat } from "@/types/summary";

/** History the summary compares against, loaded alongside the day itself. */
export interface SummaryContext {
  /** Totals of up to 7 logged days before this one. */
  recentDays: Array<{ date: string; calories: number; proteinG: number }>;
  /** Foods logged in the last few weeks, one row per label, most-logged first. */
  recentFoods: RecentFood[];
}

export interface RecentFood {
  label: string;
  serving?: string;
  calories: number;
  proteinG: number;
  fiberG: number;
  count: number;
}

export const EMPTY_CONTEXT: SummaryContext = { recentDays: [], recentFoods: [] };

/** One logged item, flattened out of its meal. */
interface Item {
  label: string;
  meal: string;
  time: string | null;
  n: NutritionSnapshot;
}

type NumericKey = keyof NutritionSnapshot;

const MAX_LINES = 3;

export function fmt(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/** "Chicken Breast (Kroger)" → "Chicken Breast": the brand is noise in a sentence. */
export function shortLabel(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, "").trim() || label;
}

function joinNames(names: string[], conjunction = "and"): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} ${conjunction} ${names[names.length - 1]}`;
}

function flatten(payload: DiaryPayload): Item[] {
  return payload.meals.flatMap((meal) =>
    meal.entries.map((entry) => ({
      label: shortLabel(entry.nutritionSnapshotJson.label),
      meal: meal.mealName,
      time: entry.eatenTime,
      n: entry.nutritionSnapshotJson,
    })),
  );
}

/** The same food logged twice counts as one contributor. */
function byLabel(items: Item[]): Item[] {
  const grouped = new Map<string, Item>();
  for (const item of items) {
    const existing = grouped.get(item.label);
    if (!existing) {
      grouped.set(item.label, { ...item, n: { ...item.n } });
      continue;
    }
    for (const [key, value] of Object.entries(item.n)) {
      if (typeof value !== "number") continue;
      const k = key as NumericKey;
      existing.n[k] = ((existing.n[k] as number | undefined) ?? 0) + value;
    }
  }
  return [...grouped.values()];
}

function top(items: Item[], key: NumericKey, count = 2): Array<{ label: string; value: number }> {
  return items
    .map((item) => ({ label: item.label, value: (item.n[key] as number | undefined) ?? 0 }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, count);
}

/** Share of the day's calories from items that report this nutrient at all. */
function coverage(items: Item[], key: NumericKey): number {
  const total = items.reduce((sum, item) => sum + item.n.calories, 0);
  if (total <= 0) return 0;
  const covered = items
    .filter((item) => item.n[key] != null)
    .reduce((sum, item) => sum + item.n.calories, 0);
  return covered / total;
}

/** Scores 1 when the deviation is within `full`, falling to 0 at `zero`. */
function band(deviation: number, full: number, zero: number): number {
  if (deviation <= full) return 1;
  if (deviation >= zero) return 0;
  return 1 - (deviation - full) / (zero - full);
}

/** Changes whenever an entry is added, edited or removed, or the target moves. */
export function summaryFingerprint(payload: DiaryPayload): string {
  const count = payload.meals.reduce((sum, meal) => sum + meal.entries.length, 0);
  const { calories, proteinG, carbsG, fatG } = payload.totals;
  return [
    count,
    Math.round(calories),
    Math.round(proteinG),
    Math.round(carbsG),
    Math.round(fatG),
    payload.goal ? Math.round(payload.goal.calories) : "-",
  ].join(":");
}

/** Saved analysis → summary. Pre-v2 rows held a bare string list; those read as none. */
export function readSummary(value: unknown): DaySummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const summary = value as Partial<DaySummary>;
  return summary.version === 2 ? (summary as DaySummary) : null;
}

/**
 * 0–100 adherence. Calories and protein carry most of it; carbs, fat and the
 * optional caps share the rest, and missing caps drop out of the denominator.
 */
export function dayScore(payload: DiaryPayload): number | null {
  const { goal, totals } = payload;
  if (!goal || goal.calories <= 0) return null;
  let earned = 0;
  let available = 0;
  const add = (points: number, fraction: number) => {
    earned += points * fraction;
    available += points;
  };

  add(40, band(Math.abs(totals.calories - goal.calories) / goal.calories, 0.05, 0.3));
  if (goal.proteinG > 0) add(30, band(1 - totals.proteinG / goal.proteinG, 0.05, 0.5));
  if (goal.carbsG > 0) add(10, band(Math.abs(totals.carbsG - goal.carbsG) / goal.carbsG, 0.1, 0.5));
  if (goal.fatG > 0) add(10, band(Math.abs(totals.fatG - goal.fatG) / goal.fatG, 0.1, 0.5));

  const extras: number[] = [];
  const cap = (actual: number | undefined, max: number | null) => {
    if (max != null && max > 0) extras.push(band((actual ?? 0) / max - 1, 0, 0.5));
  };
  cap(totals.sodiumMg, goal.sodiumMgMax);
  cap(totals.sugarG, goal.sugarGMax);
  cap(totals.satFatG, goal.satFatGMax);
  if (goal.fiberG != null && goal.fiberG > 0) {
    extras.push(band(1 - (totals.fiberG ?? 0) / goal.fiberG, 0, 0.5));
  }
  if (extras.length) add(10, extras.reduce((a, b) => a + b, 0) / extras.length);

  return Math.round((100 * earned) / available);
}

interface Issue {
  severity: number;
  text: string;
  /** What to do about it tomorrow; null when there's nothing specific to say. */
  next: string | null;
  /** The food `next` acts on, so two tips never target the same one. */
  food?: string;
}

function proteinFoods(context: SummaryContext): RecentFood[] {
  return context.recentFoods
    .filter((food) => food.proteinG >= 15 && food.calories > 0)
    .filter((food) => (food.proteinG * 4) / food.calories >= 0.35)
    .sort((a, b) => b.count - a.count || b.proteinG / b.calories - a.proteinG / a.calories)
    .slice(0, 2);
}

function fiberFoods(context: SummaryContext): RecentFood[] {
  return context.recentFoods
    .filter((food) => food.fiberG >= 4)
    .sort((a, b) => b.count - a.count || b.fiberG - a.fiberG)
    .slice(0, 2);
}

function describeFood(food: RecentFood, metric: "protein" | "fiber"): string {
  const serving = food.serving ? `, ${food.serving}` : "";
  return metric === "protein"
    ? `${food.label} (${fmt(food.proteinG)} g protein for ${fmt(food.calories)} cal${serving})`
    : `${food.label} (${fmt(food.fiberG)} g fiber${serving})`;
}

/**
 * The end-of-day summary, built entirely from the diary: a verdict, what went
 * well, what to fix with the foods that caused it, and concrete moves for
 * tomorrow drawn from foods the user already logs.
 */
export function buildDaySummary(
  payload: DiaryPayload,
  context: SummaryContext = EMPTY_CONTEXT,
  now: Date = new Date(),
): DaySummary {
  const { totals, goal } = payload;
  const items = flatten(payload);
  const grouped = byLabel(items);
  const meals = payload.meals.filter((meal) => meal.entries.length > 0);

  const stats: SummaryStat[] = [
    { key: "calories", label: "Calories", actual: Math.round(totals.calories), target: goal ? Math.round(goal.calories) : null },
    { key: "proteinG", label: "Protein", actual: Math.round(totals.proteinG), target: goal ? Math.round(goal.proteinG) : null },
    { key: "carbsG", label: "Carbs", actual: Math.round(totals.carbsG), target: goal ? Math.round(goal.carbsG) : null },
    { key: "fatG", label: "Fat", actual: Math.round(totals.fatG), target: goal ? Math.round(goal.fatG) : null },
  ];
  const base = {
    version: 2 as const,
    date: payload.date,
    generatedAt: now.toISOString(),
    source: "rules" as const,
    fingerprint: summaryFingerprint(payload),
    stats,
  };

  if (items.length === 0) {
    return {
      ...base,
      headline: "Nothing was logged this day.",
      score: null,
      trend: null,
      wins: [],
      improve: [],
      tomorrow: ["Log meals as you eat them, so the summary has something to work with."],
    };
  }

  const trend = buildTrend(payload, context);

  if (!goal || goal.calories <= 0) {
    return {
      ...base,
      headline: `${fmt(totals.calories)} cal, ${fmt(totals.proteinG)} g protein, ${fmt(totals.carbsG)} g carbs, ${fmt(totals.fatG)} g fat.`,
      score: null,
      trend,
      wins: [],
      improve: [],
      tomorrow: ["Set a goal in More → Goals so the summary can judge the day against targets."],
    };
  }

  const calDelta = totals.calories - goal.calories;
  const calDev = calDelta / goal.calories;
  const calOk = Math.abs(calDev) <= 0.05;
  const proteinGap = goal.proteinG - totals.proteinG;
  const proteinOk = goal.proteinG <= 0 || proteinGap <= Math.max(5, goal.proteinG * 0.05);

  const biggestMeal = meals.reduce((a, b) => (b.totals.calories > a.totals.calories ? b : a));
  const biggestShare = totals.calories > 0 ? biggestMeal.totals.calories / totals.calories : 0;
  const pct = (part: number, whole: number) => Math.round((100 * part) / whole);

  // Headline: calories first, protein second — the two things the day is judged on.
  let headline: string;
  const proteinClause = proteinOk
    ? `protein hit (${fmt(totals.proteinG)} of ${fmt(goal.proteinG)} g)`
    : `protein ${fmt(proteinGap)} g short`;
  if (calOk) {
    headline = proteinOk
      ? `On target: ${fmt(totals.calories)} of ${fmt(goal.calories)} cal with ${proteinClause}.`
      : `Calories on target at ${fmt(totals.calories)}, but ${proteinClause}.`;
  } else if (calDelta > 0) {
    const where = biggestShare >= 0.4 && meals.length > 1 ? `, mostly at ${biggestMeal.mealName.toLowerCase()}` : "";
    headline = `${fmt(calDelta)} cal over target${where}, ${proteinOk ? "though" : "and"} ${proteinClause}.`;
  } else if (calDev > -0.25) {
    headline = proteinOk
      ? `${fmt(-calDelta)} cal under target with ${proteinClause}: a clean deficit day.`
      : `${fmt(-calDelta)} cal under target, and ${proteinClause}.`;
  } else {
    headline = `Only ${fmt(totals.calories)} of ${fmt(goal.calories)} cal logged, ${proteinClause}.`;
  }

  // What went well, in priority order.
  const wins: string[] = [];
  if (proteinOk && goal.proteinG > 0) {
    const [lead] = top(grouped, "proteinG", 1);
    wins.push(
      `Protein hit at ${fmt(totals.proteinG)} g${lead ? `; ${lead.label} led with ${fmt(lead.value)} g` : ""}.`,
    );
  }
  if (calOk) {
    wins.push(
      Math.abs(calDelta) < 25
        ? "Calories landed almost exactly on target."
        : `Calories landed within ${fmt(Math.abs(calDelta))} of target.`,
    );
  }
  const fiber = totals.fiberG ?? 0;
  if (goal.fiberG != null && goal.fiberG > 0 && fiber >= goal.fiberG) {
    wins.push(`Fiber goal met: ${fmt(fiber)} of ${fmt(goal.fiberG)} g.`);
  } else if (goal.fiberG == null && fiber >= 30) {
    wins.push(`Fiber reached ${fmt(fiber)} g.`);
  }
  const proteinMeals = meals.filter((meal) => meal.totals.proteinG >= 25).length;
  if (proteinMeals >= 3) {
    wins.push(`Protein was spread well: ${proteinMeals} meals with 25 g or more.`);
  }
  if (context.recentDays.length >= 3) {
    const avgProtein =
      context.recentDays.reduce((sum, day) => sum + day.proteinG, 0) / context.recentDays.length;
    if (totals.proteinG - avgProtein >= 15) {
      wins.push(`Protein was ${fmt(totals.proteinG - avgProtein)} g above your recent average.`);
    }
  }
  const sodium = totals.sodiumMg ?? 0;
  if (goal.sodiumMgMax != null && sodium > 0 && sodium <= goal.sodiumMgMax && coverage(items, "sodiumMg") >= 0.8) {
    wins.push(`Sodium stayed under your cap at ${fmt(sodium)} of ${fmt(goal.sodiumMgMax)} mg.`);
  }
  const carbsOk = goal.carbsG > 0 && Math.abs(totals.carbsG - goal.carbsG) / goal.carbsG <= 0.1;
  const fatOk = goal.fatG > 0 && Math.abs(totals.fatG - goal.fatG) / goal.fatG <= 0.1;
  if (carbsOk && fatOk) wins.push("Carbs and fat both landed within 10% of target.");

  // What to fix, ranked by how far off it was.
  const issues: Issue[] = [];
  const [topCal, nextCal] = top(grouped, "calories", 2);

  if (calDev > 0.05) {
    const mealShare = `${pct(biggestMeal.totals.calories, totals.calories)}% of the day`;
    // When one food is the whole meal, name it once rather than repeat the number.
    const soleItem = topCal && Math.round(topCal.value) === Math.round(biggestMeal.totals.calories);
    issues.push({
      severity: calDev * 4,
      text: `${fmt(calDelta)} cal over. ${
        soleItem
          ? `${topCal.label} at ${biggestMeal.mealName.toLowerCase()} was ${fmt(topCal.value)} cal (${mealShare}).`
          : `${biggestMeal.mealName} was ${fmt(biggestMeal.totals.calories)} cal (${mealShare})${topCal ? `; ${topCal.label} alone was ${fmt(topCal.value)}` : ""}.`
      }`,
      next: topCal
        ? topCal.value / 2 >= calDelta
          ? `A half portion of ${topCal.label} would cover the ${fmt(calDelta)}-cal overage on its own.`
          : `Trim ${fmt(calDelta)} cal: ${topCal.label} (${fmt(topCal.value)} cal)${nextCal ? ` and ${nextCal.label} (${fmt(nextCal.value)} cal) are` : " is"} the biggest levers.`
        : null,
      food: topCal?.label,
    });
  }

  if (!proteinOk) {
    const weak = meals
      .filter((meal) => meal.totals.calories >= 250)
      .map((meal) => ({ meal, density: (100 * meal.totals.proteinG) / meal.totals.calories }))
      .sort((a, b) => a.density - b.density)[0];
    const foods = proteinFoods(context);
    issues.push({
      severity: (proteinGap / goal.proteinG) * 3,
      text: `Protein ${fmt(proteinGap)} g short at ${fmt(totals.proteinG)} of ${fmt(goal.proteinG)} g.${
        weak && weak.density < 5
          ? ` ${weak.meal.mealName} was ${fmt(weak.meal.totals.calories)} cal with only ${fmt(weak.meal.totals.proteinG)} g protein.`
          : ""
      }`,
      next: foods.length
        ? `Close the protein gap with foods you already log: ${joinNames(foods.map((food) => describeFood(food, "protein")), "or")}.`
        : `Build each meal around 30–40 g protein; the ${fmt(proteinGap)} g gap is about one extra serving of a lean protein.`,
    });
  }

  if (calDev <= -0.25) {
    issues.push({
      severity: -calDev * 2,
      text: `${fmt(-calDelta)} cal under target. If nothing is missing from the log, a gap that large is hard to sustain.`,
      next: `Log as you eat so nothing slips; if the day really was this light, add a meal of about ${fmt(-calDelta / 2)} cal tomorrow.`,
    });
  }

  if (goal.sodiumMgMax != null && sodium > goal.sodiumMgMax) {
    const sources = top(grouped, "sodiumMg", 2);
    const share = sources.reduce((sum, s) => sum + s.value, 0);
    const [first] = sources;
    issues.push({
      severity: (sodium / goal.sodiumMgMax - 1) * 1.5,
      text: `Sodium ${fmt(sodium)} mg against a ${fmt(goal.sodiumMgMax)} mg cap${
        sources.length ? `; ${joinNames(sources.map((s) => `${s.label} (${fmt(s.value)} mg)`))} made up ${pct(share, sodium)}%` : ""
      }.`,
      next: first
        ? `${first.label} alone is ${pct(first.value, goal.sodiumMgMax)}% of your sodium cap; on days you have it, keep the other meals low-sodium.`
        : null,
      food: first?.label,
    });
  }

  const macroOver = (key: "fatG" | "carbsG", name: string) => {
    const target = goal[key];
    const delta = totals[key] - target;
    if (target <= 0 || delta < 10 || delta / target <= 0.15) return;
    const sources = top(grouped, key, 2);
    const [first] = sources;
    issues.push({
      severity: (delta / target) * 1.5,
      text: `${name} ${fmt(delta)} g over at ${fmt(totals[key])} of ${fmt(target)} g${
        sources.length ? `, mostly from ${joinNames(sources.map((s) => `${s.label} (${fmt(s.value)} g)`))}` : ""
      }.`,
      next: first
        ? `${first.label} carried ${fmt(first.value)} g ${name.toLowerCase()}; a smaller portion is the easiest trim.`
        : null,
      food: first?.label,
    });
  };
  macroOver("fatG", "Fat");
  macroOver("carbsG", "Carbs");

  const capOver = (key: "sugarG" | "satFatG", max: number | null, name: string) => {
    const actual = totals[key] ?? 0;
    if (max == null || max <= 0 || actual <= max) return;
    const sources = top(grouped, key, 2);
    const [first] = sources;
    issues.push({
      severity: (actual / max - 1) * 1.2,
      text: `${name} ${fmt(actual)} g against a ${fmt(max)} g cap${
        sources.length ? `; ${joinNames(sources.map((s) => `${s.label} (${fmt(s.value)} g)`))}` : ""
      }.`,
      next: first ? `Swap ${first.label} for a lower-${name.toLowerCase()} option; it was ${fmt(first.value)} g.` : null,
      food: first?.label,
    });
  };
  capOver("sugarG", goal.sugarGMax, "Sugar");
  capOver("satFatG", goal.satFatGMax, "Saturated fat");

  const fiberTarget = goal.fiberG != null && goal.fiberG > 0 ? goal.fiberG : null;
  const fiberLow = fiberTarget
    ? fiber < fiberTarget * 0.7
    : fiber < 15 && totals.calories >= 1200 && coverage(items, "fiberG") >= 0.6;
  if (fiberLow) {
    const foods = fiberFoods(context);
    issues.push({
      severity: fiberTarget ? (1 - fiber / fiberTarget) * 1 : 0.4,
      text: fiberTarget ? `Fiber ${fmt(fiber)} of ${fmt(fiberTarget)} g.` : `Fiber was only ${fmt(fiber)} g.`,
      next: foods.length
        ? `Add fiber with foods you already eat: ${joinNames(foods.map((food) => describeFood(food, "fiber")), "or")}.`
        : "Add a fruit, a cup of beans or a bowl of oats; any one of them adds 5–10 g fiber.",
    });
  }

  const late = items.filter((item) => item.time != null && item.time >= "21:00");
  const lateCalories = late.reduce((sum, item) => sum + item.n.calories, 0);
  if (lateCalories >= 400 || (lateCalories > 0 && lateCalories / totals.calories >= 0.3)) {
    const names = top(byLabel(late), "calories", 2).map((s) => s.label);
    issues.push({
      severity: 0.35 + lateCalories / totals.calories,
      text: `${fmt(lateCalories)} cal came after 9 PM (${joinNames(names)}).`,
      next: "Plan the evening snack into the day's budget, or move some of it to dinner.",
    });
  }

  if (calDev <= 0.05 && biggestShare >= 0.55 && meals.length > 1) {
    issues.push({
      severity: biggestShare - 0.3,
      text: `${biggestMeal.mealName} carried ${pct(biggestMeal.totals.calories, totals.calories)}% of the day's calories.`,
      next: `Spread it out: roughly ${fmt(goal.calories / 3)} cal across three meals keeps hunger steadier.`,
    });
  }

  issues.sort((a, b) => b.severity - a.severity);
  const ranked = issues.slice(0, MAX_LINES);
  const tomorrow: string[] = [];
  const targeted = new Set<string>();
  for (const issue of ranked) {
    if (!issue.next || (issue.food && targeted.has(issue.food))) continue;
    if (issue.food) targeted.add(issue.food);
    tomorrow.push(issue.next);
  }
  if (tomorrow.length === 0) {
    tomorrow.push(
      proteinMeals >= 2
        ? `Repeat the pattern: ${proteinMeals} protein-anchored meals got you here.`
        : "Repeat the pattern; today's mix hit the targets.",
    );
  }

  return {
    ...base,
    headline,
    score: dayScore(payload),
    trend,
    wins: wins.slice(0, MAX_LINES),
    improve: ranked.map((issue) => issue.text),
    tomorrow: tomorrow.slice(0, MAX_LINES),
  };
}

function buildTrend(payload: DiaryPayload, context: SummaryContext): string | null {
  const days = context.recentDays;
  if (days.length < 3) return null;
  const avgCal = days.reduce((sum, day) => sum + day.calories, 0) / days.length;
  const avgProtein = days.reduce((sum, day) => sum + day.proteinG, 0) / days.length;
  const dc = payload.totals.calories - avgCal;
  const dp = payload.totals.proteinG - avgProtein;
  const span = `your ${days.length}-day average (${fmt(avgCal)} cal, ${fmt(avgProtein)} g protein)`;
  if (Math.abs(dc) < 100 && Math.abs(dp) < 10) return `In line with ${span}.`;
  return `${fmt(Math.abs(dc))} cal ${dc >= 0 ? "more" : "less"} and ${fmt(Math.abs(dp))} g ${
    dp >= 0 ? "more" : "less"
  } protein than ${span}.`;
}
