import { describe, expect, it } from "vitest";

import {
  previousReading,
  stepWeight,
  weightDelta,
  WEIGHT_STEP,
} from "@/lib/progress/weight-entry";
import { daysBetweenISO, relativeDayLabel } from "@/lib/dates";
import type { WeightLogDTO } from "@/types/api";

const w = (date: string, weightValue: number): WeightLogDTO =>
  ({ id: date, date, weightValue }) as WeightLogDTO;

describe("stepWeight", () => {
  it("moves by a tenth without float dust", () => {
    // 75.3 + 0.1 in binary floating point is 75.39999999999999.
    expect(stepWeight(75.3, WEIGHT_STEP)).toBe(75.4);
    expect(stepWeight(75.4, -WEIGHT_STEP)).toBe(75.3);
    expect(stepWeight(0.3, -0.1)).toBe(0.2);
  });

  it("never steps down past a positive weight", () => {
    expect(stepWeight(0.1, -WEIGHT_STEP)).toBe(WEIGHT_STEP);
    expect(stepWeight(0.1, -10)).toBe(WEIGHT_STEP);
  });

  it("round-trips up and back down", () => {
    let v = 75.3;
    for (let i = 0; i < 10; i++) v = stepWeight(v, WEIGHT_STEP);
    for (let i = 0; i < 10; i++) v = stepWeight(v, -WEIGHT_STEP);
    expect(v).toBe(75.3);
  });
});

describe("previousReading", () => {
  // Ascending, as the progress endpoint returns it.
  const weights = [w("2026-10-20", 75.4), w("2026-10-22", 75.3), w("2026-10-24", 75.5)];

  it("compares against the entry before the date, not the newest", () => {
    // Back-dating to the 21st should read against the 20th, not the 24th.
    expect(previousReading(weights, "2026-10-21")?.date).toBe("2026-10-20");
    expect(previousReading(weights, "2026-10-25")?.date).toBe("2026-10-24");
  });

  it("excludes an entry on the same date, which is the one being replaced", () => {
    expect(previousReading(weights, "2026-10-22")?.date).toBe("2026-10-20");
  });

  it("has no baseline before the first weigh-in", () => {
    expect(previousReading(weights, "2026-10-19")).toBeNull();
    expect(previousReading([], "2026-10-22")).toBeNull();
  });

  it("is order-independent", () => {
    const shuffled = [weights[2], weights[0], weights[1]];
    expect(previousReading(shuffled, "2026-10-23")?.date).toBe("2026-10-22");
  });
});

describe("weightDelta", () => {
  it("signs the change and rounds to a tenth", () => {
    expect(weightDelta(75.1, w("2026-10-22", 75.3))).toBe(-0.2);
    expect(weightDelta(75.5, w("2026-10-22", 75.3))).toBe(0.2);
    expect(weightDelta(75.3, w("2026-10-22", 75.3))).toBe(0);
  });

  it("has nothing to say without a baseline or a number", () => {
    expect(weightDelta(75.1, null)).toBeNull();
    expect(weightDelta(Number.NaN, w("2026-10-22", 75.3))).toBeNull();
  });
});

describe("relativeDayLabel", () => {
  const today = "2026-10-29";

  it("names the days you actually backfill", () => {
    expect(relativeDayLabel("2026-10-29", today)).toBe("today");
    expect(relativeDayLabel("2026-10-28", today)).toBe("yesterday");
    expect(relativeDayLabel("2026-10-26", today)).toBe("3 days ago");
    expect(relativeDayLabel("2026-10-22", today)).toBe("7 days ago");
  });

  it("falls back to a real date once the count stops helping", () => {
    expect(relativeDayLabel("2026-10-21", today)).not.toContain("days ago");
  });

  it("counts whole days across a month boundary", () => {
    expect(daysBetweenISO("2026-09-30", "2026-10-01")).toBe(1);
    expect(daysBetweenISO("2026-10-29", "2026-10-29")).toBe(0);
  });
});
