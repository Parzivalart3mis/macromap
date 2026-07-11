import type { FoodDTO } from "@/types/api";
import { roundNutrition, scaleNutrition } from "@/lib/nutrition";
import { NUTRITION_KEYS, type NutritionSnapshot } from "@/types/nutrition";

/** Nutrition of one native serving from a client food DTO. */
export function dtoNutrition(food: FoodDTO): NutritionSnapshot {
  const snapshot: NutritionSnapshot = {
    calories: food.calories,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
  };
  for (const key of NUTRITION_KEYS) {
    if (key in snapshot) continue;
    const value = food[key as keyof FoodDTO];
    if (typeof value === "number") snapshot[key] = value;
  }
  return snapshot;
}

/** Volume units → millilitres. */
const VOLUME: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  millilitre: 1,
  l: 1000,
  liter: 1000,
  litre: 1000,
  cup: 236.588,
  "fl oz": 29.5735,
  floz: 29.5735,
  tbsp: 14.7868,
  tablespoon: 14.7868,
  tsp: 4.92892,
  teaspoon: 4.92892,
  pint: 473.176,
  quart: 946.353,
};

/** Weight units → grams. */
const WEIGHT: Record<string, number> = {
  g: 1,
  gram: 1,
  kg: 1000,
  kilogram: 1000,
  mg: 0.001,
  oz: 28.3495,
  ounce: 28.3495,
  lb: 453.592,
  pound: 453.592,
};

export type UnitKind = "volume" | "weight" | "count";

export interface UnitOption {
  /** Display label, e.g. "1 cup", "236.59 ml". */
  label: string;
  /** Numeric amount for this unit choice. */
  value: number;
  /** The unit word, e.g. "cup", "ml", "serving". */
  unit: string;
  /** Amount in the base measure (ml / g), or the count value for count foods. */
  baseAmount: number;
}

export function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

/** How the food's native serving reads: its override label, or "<value> <unit>". */
export function nativeServingLabel(
  food: Pick<FoodDTO, "servingSizeValue" | "servingSizeUnit" | "servingSizeLabel">,
): string {
  return food.servingSizeLabel ?? `${formatNum(food.servingSizeValue)} ${food.servingSizeUnit}`;
}

/**
 * Rescale a stored serving text's amount ("2 slices" ×2 → "4 slices").
 * A trailing parenthetical is a description of the *original* size
 * ("1 medium (118 g)") and would go stale, so it is dropped when scaling.
 * Texts with no leading number pass through unchanged.
 */
export function scaleServingText(
  text: string | undefined,
  ratio: number,
): string | undefined {
  if (text === undefined || ratio === 1) return text;
  const match = text.match(/^\s*([\d.]+)(.*)$/);
  if (!match || !Number.isFinite(Number(match[1]))) return text;
  const rest = match[2].replace(/\s*\([^)]*\)\s*$/, "");
  return `${Math.round(Number(match[1]) * ratio * 100) / 100}${rest}`;
}

/**
 * Serving text for N native servings of a food — the label at exactly 1
 * serving ("1 medium (118 g)", "2 slices"), a pluralized amount otherwise
 * ("4 cookies", "236 g").
 */
export function nativeServingTextFor(
  food: Pick<FoodDTO, "servingSizeValue" | "servingSizeUnit" | "servingSizeLabel">,
  servings: number,
): string {
  if (servings === 1) return nativeServingLabel(food);
  const amount = servings * food.servingSizeValue;
  return `${formatNum(amount)} ${pluralizeUnit(food.servingSizeUnit, amount)}`;
}

/** Recognises the food's serving unit; the first known token wins ("g (1 scoop)" → g). */
function classifyUnit(rawUnit: string): { kind: UnitKind; canonical: string; factor: number } {
  const tokens = rawUnit.toLowerCase().match(/[a-z]+/g) ?? [];
  for (const token of tokens) {
    const singular = token.endsWith("s") ? token.slice(0, -1) : token;
    for (const key of [token, singular]) {
      if (key in VOLUME) return { kind: "volume", canonical: key, factor: VOLUME[key] };
      if (key in WEIGHT) return { kind: "weight", canonical: key, factor: WEIGHT[key] };
    }
  }
  return { kind: "count", canonical: rawUnit, factor: 1 };
}

/** Pluralize count-based units (serving → servings); weights/volumes stay literal. */
function pluralizeUnit(unit: string, count: number): string {
  if (count === 1 || classifyUnit(unit).kind !== "count") return unit;
  return unit.endsWith("s") ? unit : `${unit}s`;
}

/** Total base measure (ml / g) of one of the food's native servings. */
export function baseServingAmount(food: FoodDTO): number {
  const { kind, factor } = classifyUnit(food.servingSizeUnit);
  return kind === "count" ? food.servingSizeValue : food.servingSizeValue * factor;
}

export function unitKindOf(food: FoodDTO): UnitKind {
  return classifyUnit(food.servingSizeUnit).kind;
}

// Extra choices offered per kind, as "1 <unit>".
const VOLUME_CHOICES = ["cup", "ml", "tbsp", "tsp", "fl oz", "l"] as const;
const WEIGHT_CHOICES = ["g", "oz", "lb", "kg"] as const;

/**
 * Selectable serving units for a food. Count-based foods (serving, item,
 * scoop) offer only their native unit — there is no reliable conversion.
 */
export function servingOptions(food: FoodDTO): UnitOption[] {
  const { kind, canonical } = classifyUnit(food.servingSizeUnit);
  const options: UnitOption[] = [];
  const seen = new Set<number>();
  const push = (value: number, unit: string, baseAmount: number, label?: string) => {
    seen.add(Math.round(baseAmount * 1000) / 1000);
    options.push({ label: label ?? `${formatNum(value)} ${unit}`, value, unit, baseAmount });
  };
  const add = (value: number, unit: string, baseAmount: number) => {
    const key = Math.round(baseAmount * 1000) / 1000;
    if (seen.has(key) || baseAmount <= 0) return;
    push(value, unit, baseAmount);
  };

  const base = baseServingAmount(food);
  // Native serving first (its own unit string, or an explicit override label).
  push(food.servingSizeValue, food.servingSizeUnit, base, food.servingSizeLabel ?? undefined);

  // User-defined extra serving sizes, each a multiple of the base serving.
  // Added for every food kind (including count-based). Labelled with the base
  // equivalent, e.g. base "1 serving" + a 4× container → "1 container (4 servings)".
  for (const alt of food.alternateServings ?? []) {
    const baseAmount = alt.multiplier * base;
    const dedupKey = Math.round(baseAmount * 1000) / 1000;
    if (seen.has(dedupKey) || baseAmount <= 0) continue;
    seen.add(dedupKey);
    const equiv = alt.multiplier * food.servingSizeValue;
    const label =
      alt.label ??
      `1 ${alt.unit} (${formatNum(equiv)} ${pluralizeUnit(food.servingSizeUnit, equiv)})`;
    options.push({ label, value: 1, unit: alt.unit, baseAmount });
  }

  if (kind === "count") return options;

  const table = kind === "volume" ? VOLUME : WEIGHT;
  const canonicalUnit = kind === "volume" ? "ml" : "g";
  // The whole native serving in the canonical measure — always shown even when
  // it equals the native amount (e.g. "1 cup" and "236.59 ml" are both useful).
  if (canonical !== canonicalUnit) {
    push(Math.round(base * 100) / 100, canonicalUnit, base);
  }
  // One of each common unit of the same kind.
  const choices = kind === "volume" ? VOLUME_CHOICES : WEIGHT_CHOICES;
  for (const unit of choices) add(1, unit, table[unit]);
  // A 100-unit option is handy for weights/volumes.
  add(100, canonicalUnit, 100);

  return options;
}

/** Compute the diary-entry parameters and preview nutrition for a choice. */
export function computeServing(
  food: FoodDTO,
  option: UnitOption,
  servings: number,
): {
  quantity: number;
  servingMultiplier: number;
  servingText: string;
  nutrition: NutritionSnapshot;
} {
  const base = baseServingAmount(food);
  const servingMultiplier = base > 0 ? option.baseAmount / base : 1;
  const quantity = servings;
  const factor = quantity * servingMultiplier;
  const nutrition = roundNutrition(scaleNutrition(dtoNutrition(food), factor));
  // At exactly 1 serving the option's label is the truest description
  // ("1 medium (118 g)", "16.9 fl oz", "1 serving (6 cookies)"); otherwise
  // write the scaled amount with a pluralized count unit ("4 cookies"). Units
  // that begin with their own number ("16.9 fl oz") read as "2 × 16.9 fl oz".
  const amount = servings * option.value;
  const servingText =
    servings === 1
      ? option.label
      : /^\d/.test(option.unit)
        ? `${formatNum(servings)} × ${option.unit}`
        : `${formatNum(amount)} ${pluralizeUnit(option.unit, amount)}`;
  return { quantity, servingMultiplier, servingText, nutrition };
}
