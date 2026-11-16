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

/**
 * How the food's native serving reads: its override label, or "<value> <unit>"
 * with the unit agreeing with the amount ("3 pieces", not "3 piece").
 */
export function nativeServingLabel(
  food: Pick<FoodDTO, "servingSizeValue" | "servingSizeUnit" | "servingSizeLabel">,
): string {
  return (
    food.servingSizeLabel ??
    `${formatNum(food.servingSizeValue)} ${inflectUnitPhrase(food.servingSizeUnit, food.servingSizeValue)}`
  );
}

/** Abbreviated measures and size adjectives — words that never take a plural. */
const UNINFLECTED = new Set([
  "g", "kg", "mg", "oz", "lb", "ml", "l", "tbsp", "tsp", "fl", "floz",
  "small", "medium", "large", "mini", "regular", "jumbo", "whole", "half",
]);
/** Measure nouns that lead a phrase and carry its plural ("cups, sliced", "cups cooked"). */
const LEADING_NOUNS = new Set([
  "cup", "slice", "piece", "serving", "scoop", "bowl", "can", "bottle", "packet", "stick",
]);
/** "-ies" plurals whose singular ends in "y"; every other "-ies" just drops the "s" (cookies). */
const Y_NOUNS = new Set(["berry", "patty", "candy", "fry", "cherry", "pastry", "jelly", "gummy"]);

function singularize(word: string): string {
  const lower = word.toLowerCase();
  if (/(ss|us|is)$/.test(lower) || !lower.endsWith("s")) return word;
  if (/(ch|sh|x|z|ss)es$/.test(lower)) return word.slice(0, -2);
  if (lower.endsWith("ies") && Y_NOUNS.has(`${lower.slice(0, -3)}y`)) return `${word.slice(0, -3)}y`;
  return word.slice(0, -1);
}

function pluralize(word: string): string {
  const lower = word.toLowerCase();
  if (lower.endsWith("s") && !/(ss|us|is)$/.test(lower)) return word; // already plural
  if (/(s|x|z|ch|sh)$/.test(lower)) return `${word}es`;
  if (/[^aeiou]y$/.test(lower) && Y_NOUNS.has(lower)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

/**
 * Make a unit phrase agree with its amount: "slice" ↔ "slices", "cup, sliced" ↔
 * "cups, sliced", "family pack" ↔ "family packs". Abbreviations ("g", "tbsp",
 * "fl oz") and size adjectives ("medium", "extra small") are left alone.
 */
export function inflectUnitPhrase(phrase: string, amount: number): string {
  // Qualifiers after a comma or dot ("cup, sliced", "regular · serves 2") never inflect.
  const cut = phrase.search(/[,·]/);
  const head = cut === -1 ? phrase : phrase.slice(0, cut);
  const rest = cut === -1 ? "" : phrase.slice(cut);
  const words = head.split(" ");
  const filled = words.map((w, i) => (w ? i : -1)).filter((i) => i >= 0);
  if (filled.length === 0) return phrase;
  const first = filled[0];
  const last = filled[filled.length - 1];
  const target = LEADING_NOUNS.has(singularize(words[first]).toLowerCase()) ? first : last;
  const word = words[target];
  if (!/^[A-Za-z]+$/.test(word) || UNINFLECTED.has(word.toLowerCase())) return phrase;
  words[target] = amount === 1 ? singularize(word) : pluralize(word);
  return words.join(" ") + rest;
}

const VULGAR: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125,
};
// A leading amount: "2", "1.5", "3/4", "½" — optionally approximate ("~165").
const AMOUNT = String.raw`(~?)(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?|[½⅓⅔¼¾⅛])`;
const AMOUNT_PHRASE = new RegExp(String.raw`^${AMOUNT}(\s*)(.*)$`, "u");

function parseAmount(raw: string): number {
  if (raw in VULGAR) return VULGAR[raw];
  if (raw.includes("/")) {
    const [a, b] = raw.split("/").map((part) => Number(part.trim()));
    return b ? a / b : Number.NaN;
  }
  return Number(raw);
}

/** Scale one "<amount> <unit phrase>" segment, or null when it is not one. */
function scaleSegment(segment: string, ratio: number): string | null {
  const match = segment.match(AMOUNT_PHRASE);
  if (!match) return null;
  const [, approx, rawAmount, gap, phrase] = match;
  // "1 1/2 cups" — a mixed number this parser does not model; leave it be.
  if (/^\d/.test(phrase)) return null;
  const amount = parseAmount(rawAmount);
  if (!Number.isFinite(amount)) return null;
  const scaled = Math.round(amount * ratio * 100) / 100;
  return `${approx}${formatNum(scaled)}${gap}${inflectUnitPhrase(phrase, scaled)}`;
}

/**
 * Rescale a serving text by `ratio`, keeping it a description of the whole
 * amount: "1 medium (118 g)" ×2 → "2 medium (236 g)", "2 slices (41 g)" ×0.5 →
 * "1 slice (20.5 g)", "1 pack (4 cups, 601 g)" ×2 → "2 packs (8 cups, 1202 g)".
 *
 * Every amount in the text scales together, so the parenthetical stays true
 * instead of going stale — collapsing it to the bare weight ("236 g") is what
 * used to make a logged banana read differently from the one you picked. A
 * parenthetical with no amount in it ("label serving", "¼ recipe") cannot be
 * scaled and is dropped. Texts with no leading amount pass through unchanged.
 */
export function scaleServingText(
  text: string | undefined,
  ratio: number,
): string | undefined {
  if (text === undefined || ratio === 1) return text;

  // "2 × 16.9 fl oz", "2 × whole pizza": only the multiplier scales.
  const times = text.match(/^\s*(\d+(?:\.\d+)?)\s*×\s*(.+)$/u);
  if (times) {
    const n = Math.round(Number(times[1]) * ratio * 100) / 100;
    return n === 1 ? times[2] : `${formatNum(n)} × ${times[2]}`;
  }

  // lead "(parenthetical)" tail — e.g. `3/4 cup` `(56 g)` ` dry`.
  const open = text.indexOf("(");
  const close = open === -1 ? -1 : text.indexOf(")", open);
  const lead = (open === -1 ? text : text.slice(0, open)).trim();
  const inner = open !== -1 && close !== -1 ? text.slice(open + 1, close) : null;
  const tail = open !== -1 && close !== -1 ? text.slice(close + 1) : "";

  const scaledLead = scaleSegment(lead, ratio);
  if (scaledLead === null) return text;

  let paren = "";
  if (inner !== null) {
    const parts = inner.split(",").map((part) => scaleSegment(part.trim(), ratio));
    if (parts.every((part): part is string => part !== null)) paren = ` (${parts.join(", ")})`;
  }
  return `${scaledLead}${paren}${tail}`;
}

/**
 * Serving text for `servings` of a serving described by `label`. At exactly one
 * the label is used verbatim; otherwise it is scaled, and a label with no
 * amount of its own ("whole pizza", "large (6 oz)") is counted: "2 × whole pizza".
 */
export function servingTextFor(label: string, servings: number): string {
  if (servings === 1) return label;
  const scaled = scaleServingText(label, servings);
  return scaled !== undefined && scaled !== label
    ? scaled
    : `${formatNum(servings)} × ${label}`;
}

/**
 * Serving text for N native servings of a food — the label at exactly 1
 * serving ("1 medium (118 g)", "2 slices"), the label scaled otherwise
 * ("2 medium (236 g)", "4 slices", "64 g (2 scoops)").
 */
export function nativeServingTextFor(
  food: Pick<FoodDTO, "servingSizeValue" | "servingSizeUnit" | "servingSizeLabel">,
  servings: number,
): string {
  return servingTextFor(nativeServingLabel(food), servings);
}

/**
 * Recognises the food's serving unit from its leading word: "g (1 scoop)" is
 * grams, "fl oz" is volume, "slices" is a count. A measure that only appears
 * later is a description, not the unit — "bowl (~325g)" is one bowl, and reading
 * it as one gram would make the "100 g" option a hundred bowls.
 */
function classifyUnit(rawUnit: string): { kind: UnitKind; canonical: string; factor: number } {
  const tokens = rawUnit.toLowerCase().replace(/\(.*$/, "").match(/[a-z]+/g) ?? [];
  const candidates = [tokens.slice(0, 2).join(" "), tokens[0] ?? ""];
  for (const candidate of candidates) {
    const singular = candidate.endsWith("s") ? candidate.slice(0, -1) : candidate;
    for (const key of [candidate, singular]) {
      if (key in VOLUME) return { kind: "volume", canonical: key, factor: VOLUME[key] };
      if (key in WEIGHT) return { kind: "weight", canonical: key, factor: WEIGHT[key] };
    }
  }
  return { kind: "count", canonical: rawUnit, factor: 1 };
}

/**
 * Whether a serving unit is count-based (slice, piece, roti…) rather than a
 * weight/volume measure. Used to step whole units in the store builder.
 */
export function isCountUnit(unit: string): boolean {
  return classifyUnit(unit).kind === "count";
}

/** Pluralize count-based units (serving → servings); weights/volumes stay literal. */
/** Total base measure (ml / g) of one of the food's native servings. */
export function baseServingAmount(food: FoodDTO): number {
  const { kind, factor } = classifyUnit(food.servingSizeUnit);
  return kind === "count" ? food.servingSizeValue : food.servingSizeValue * factor;
}

export function unitKindOf(food: FoodDTO): UnitKind {
  return classifyUnit(food.servingSizeUnit).kind;
}

// Extra choices offered per kind, as "1 <unit>". Pounds, kilograms and litres
// are deliberately absent: nobody logs a pound of yogurt, and across the whole
// diary those three options were never once chosen — they only lengthened the list.
const VOLUME_CHOICES = ["cup", "ml", "tbsp", "tsp", "fl oz"] as const;
const WEIGHT_CHOICES = ["g", "oz"] as const;

/**
 * Selectable serving units for a food. Count-based foods (serving, item,
 * scoop) offer only their native unit — there is no reliable conversion.
 */
export function servingOptions(food: FoodDTO): UnitOption[] {
  const { kind } = classifyUnit(food.servingSizeUnit);
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
    // A container-like alternate explains itself in base units ("1 container
    // (4 servings)"). A plain measure does not need to: "1 g" of almonds is
    // clearer than "1 g (0.83 almonds)".
    const label =
      alt.label ??
      (classifyUnit(alt.unit).kind === "count"
        ? `1 ${alt.unit} (${formatNum(equiv)} ${inflectUnitPhrase(food.servingSizeUnit, equiv)})`
        : `1 ${alt.unit}`);
    options.push({ label, value: 1, unit: alt.unit, baseAmount });
  }

  if (kind === "count") return options;

  const table = kind === "volume" ? VOLUME : WEIGHT;
  const canonicalUnit = kind === "volume" ? "ml" : "g";
  // A measure the food already names in a label is not offered again: beside
  // "1 oz (28 g)" a second, generated "1 oz" (28.35 g) is a near-duplicate that
  // only invites the wrong tap. The same goes for "1 cup (240 ml)" and "1 cup".
  const named = (unit: string) =>
    options.some((o) => o.label === `1 ${unit}` || o.label.startsWith(`1 ${unit} (`));
  // One of each common unit of the same kind. The native serving restated in
  // the canonical measure ("236.59 ml" under "1 cup") used to sit here too; it
  // was never picked and "1 ml" / "100 ml" already cover that need.
  const choices = kind === "volume" ? VOLUME_CHOICES : WEIGHT_CHOICES;
  for (const unit of choices) if (!named(unit)) add(1, unit, table[unit]);
  // A 100-unit option is handy for weights/volumes.
  add(100, canonicalUnit, 100);

  return options;
}

/** Compute the diary-entry parameters and preview nutrition for a choice. */
/**
 * The serving option a stored `servingMultiplier` was logged in, or null when
 * none matches — which happens when the food's servings were edited after the
 * entry was logged. Callers must treat null as "leave the entry alone" rather
 * than silently snapping it to another unit.
 */
export function matchServingOption(
  food: FoodDTO,
  servingMultiplier: number,
): UnitOption | null {
  const base = baseServingAmount(food);
  if (!(base > 0) || !Number.isFinite(servingMultiplier)) return null;
  const target = servingMultiplier * base;
  return (
    servingOptions(food).find((o) => Math.abs(o.baseAmount - target) <= base * 1e-6) ?? null
  );
}

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
  // The option's label is the truest description of what was picked, so the
  // text is that label scaled — "1 medium (118 g)" twice is "2 medium (236 g)",
  // never the bare "236 g" it used to collapse to. Units that begin with their
  // own number ("16.9 fl oz") are counted instead: "2 × 16.9 fl oz".
  const servingText =
    servings !== 1 && /^\d/.test(option.unit)
      ? `${formatNum(servings)} × ${option.unit}`
      : servingTextFor(option.label, servings);
  return { quantity, servingMultiplier, servingText, nutrition };
}
