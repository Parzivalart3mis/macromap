import type { BiologicalSex } from "@/lib/db/schema";

/**
 * Body-composition maths. Pure — every input is passed in, nothing is read from
 * the database — so each formula can be tested directly.
 *
 * All lengths are centimetres and all masses kilograms, matching how they are
 * stored; the UI converts for display.
 */

/** Rounds to one decimal, the precision these estimates actually carry. */
const r1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * Body fat by the US Navy circumference method.
 *
 * Men need waist and neck; women also need hips. Accurate to roughly ±3–4
 * percentage points against DEXA, which makes it reliable for tracking change
 * over weeks but not for a single authoritative number.
 *
 * Returns null whenever the inputs cannot support an estimate — missing
 * measurements, an unspecified sex (the formula has no such variant), or
 * a waist that does not exceed the neck, which makes the logarithm undefined.
 */
export function navyBodyFatPct(input: {
  sex: BiologicalSex | null;
  heightCm: number | null;
  waistCm: number | null;
  neckCm: number | null;
  hipCm?: number | null;
}): number | null {
  const { sex, heightCm, waistCm, neckCm, hipCm } = input;
  if (!sex || sex === "unspecified") return null;
  if (!heightCm || !waistCm || !neckCm) return null;
  if (heightCm <= 0 || waistCm <= 0 || neckCm <= 0) return null;

  if (sex === "male") {
    const girth = waistCm - neckCm;
    if (girth <= 0) return null;
    const pct =
      495 /
        (1.0324 - 0.19077 * Math.log10(girth) + 0.15456 * Math.log10(heightCm)) -
      450;
    return clampPct(pct);
  }

  if (!hipCm || hipCm <= 0) return null;
  const girth = waistCm + hipCm - neckCm;
  if (girth <= 0) return null;
  const pct =
    495 / (1.29579 - 0.35004 * Math.log10(girth) + 0.221 * Math.log10(heightCm)) -
    450;
  return clampPct(pct);
}

/** Outside this range the formula has left the domain it was fitted on. */
function clampPct(pct: number): number | null {
  if (!Number.isFinite(pct) || pct < 2 || pct > 70) return null;
  return r1(pct);
}

export type WaistBand = "lean" | "athletic" | "fit" | "healthy" | "elevated" | "high";

export interface WaistToHeight {
  ratio: number;
  band: WaistBand;
  label: string;
  /** Waist at which the next band down begins, or null when already leanest. */
  nextBandCm: number | null;
}

const BANDS: Array<{ max: number; band: WaistBand; label: string }> = [
  { max: 0.43, band: "lean", label: "Lean" },
  { max: 0.45, band: "athletic", label: "Athletic" },
  { max: 0.47, band: "fit", label: "Fit" },
  { max: 0.5, band: "healthy", label: "Healthy" },
  { max: 0.55, band: "elevated", label: "Elevated" },
  { max: Infinity, band: "high", label: "High" },
];

/**
 * Waist divided by height — a directly measured number rather than an estimate,
 * and more informative than BMI because it tracks central fat specifically.
 * Under 0.5 is the widely used healthy ceiling at any height.
 */
export function waistToHeight(
  waistCm: number | null,
  heightCm: number | null,
): WaistToHeight | null {
  if (!waistCm || !heightCm || waistCm <= 0 || heightCm <= 0) return null;
  const ratio = waistCm / heightCm;
  const index = BANDS.findIndex((b) => ratio <= b.max);
  const entry = BANDS[index];
  // The waist that would move you one band leaner.
  const nextBandCm = index > 0 ? r1(BANDS[index - 1].max * heightCm) : null;
  return { ratio: Math.round(ratio * 1000) / 1000, band: entry.band, label: entry.label, nextBandCm };
}

/**
 * Lean mass and fat mass at a given body fat percentage. On a cut this is the
 * pair worth watching: lean mass holding while weight falls is the goal, and
 * body fat percentage alone hides which one is moving.
 */
export function bodyComposition(
  weightKg: number | null,
  bodyFatPct: number | null,
): { leanKg: number; fatKg: number } | null {
  if (!weightKg || bodyFatPct == null) return null;
  if (weightKg <= 0 || bodyFatPct < 0 || bodyFatPct >= 100) return null;
  const fatKg = r1((weightKg * bodyFatPct) / 100);
  return { leanKg: r1(weightKg - fatKg), fatKg };
}

/** Whole years at `on`, or null when the date of birth is unknown. */
export function ageOn(dateOfBirth: string | null, on: string): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  const at = new Date(`${on}T00:00:00Z`);
  if (Number.isNaN(dob.getTime()) || Number.isNaN(at.getTime())) return null;
  let age = at.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    at.getUTCMonth() < dob.getUTCMonth() ||
    (at.getUTCMonth() === dob.getUTCMonth() && at.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}
