import type { WeightLogDTO } from "@/types/api";

/**
 * Helpers for the weigh-in dialog. Day-to-day weight moves by a couple of
 * tenths, so the dialog opens on the last reading and nudges from there rather
 * than asking for the whole number every morning.
 */

/** The increment the stepper buttons move by. */
export const WEIGHT_STEP = 0.1;

/** Steps a weight, keeping it positive and free of float dust. */
export function stepWeight(current: number, delta: number): number {
  return Math.max(WEIGHT_STEP, Math.round((current + delta) * 10) / 10);
}

/**
 * The reading a new entry should be compared against: the most recent one
 * strictly before `date`. Back-dating an entry therefore compares it with the
 * day before it, not with whatever happens to be newest.
 *
 * `weights` is ascending by date, as the progress endpoint returns it.
 */
export function previousReading(
  weights: WeightLogDTO[],
  date: string,
): WeightLogDTO | null {
  let best: WeightLogDTO | null = null;
  for (const w of weights) {
    if (w.date < date && (!best || w.date > best.date)) best = w;
  }
  return best;
}

/** Signed change against that reading, to one decimal; null without a baseline. */
export function weightDelta(
  value: number,
  previous: WeightLogDTO | null,
): number | null {
  if (!previous || !Number.isFinite(value)) return null;
  return Math.round((value - previous.weightValue) * 10) / 10;
}
