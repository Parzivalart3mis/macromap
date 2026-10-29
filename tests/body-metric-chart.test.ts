import { describe, expect, it } from "vitest";

import { chartSize, plotMinWidth, weightOnOrBefore } from "@/components/progress/charts";
import type { WeightLogDTO } from "@/types/api";

const w = (date: string, weightValue: number): WeightLogDTO =>
  ({ id: date, date, weightValue }) as WeightLogDTO;

describe("weightOnOrBefore", () => {
  const weights = [w("2026-10-01", 76), w("2026-10-05", 75.5), w("2026-10-09", 75)];

  it("uses the weigh-in from the same day when there is one", () => {
    expect(weightOnOrBefore(weights, "2026-10-05")).toBe(75.5);
  });

  it("falls back to the most recent earlier weigh-in", () => {
    // Measured on the 7th, last weighed on the 5th.
    expect(weightOnOrBefore(weights, "2026-10-07")).toBe(75.5);
    expect(weightOnOrBefore(weights, "2026-10-31")).toBe(75);
  });

  it("never reaches forward to a later weigh-in", () => {
    // A measurement before any weight exists has nothing to divide.
    expect(weightOnOrBefore(weights, "2026-09-30")).toBeNull();
  });

  it("is order-independent", () => {
    const shuffled = [weights[2], weights[0], weights[1]];
    expect(weightOnOrBefore(shuffled, "2026-10-07")).toBe(75.5);
  });

  it("returns null with no weigh-ins at all", () => {
    expect(weightOnOrBefore([], "2026-10-07")).toBeNull();
  });
});

describe("chartSize", () => {
  it("gives a card a fixed strip and an expanded chart the full height", () => {
    expect(chartSize(false).heightClass).toBe("h-48");
    expect(chartSize(true).heightClass).toBe("h-full");
  });

  it("grows the touch target when expanded", () => {
    // The card's 4px active dot is not a fingertip; the expanded one is.
    expect(chartSize(true).activeDotR).toBeGreaterThan(chartSize(false).activeDotR);
    expect(chartSize(true).dotR).toBeGreaterThan(chartSize(false).dotR);
  });

  it("labels every reading only when expanded", () => {
    expect(chartSize(false).tickInterval).toBe("preserveStartEnd");
    expect(chartSize(true).tickInterval).toBe(0);
  });
});

describe("plotMinWidth", () => {
  it("never constrains a card chart, however many readings", () => {
    expect(plotMinWidth(false, 90)).toBe(0);
    expect(plotMinWidth(false, 1)).toBe(0);
  });

  it("reserves fingertip room per reading when expanded", () => {
    // 90 daily weigh-ins across a ~360px phone is ~4px apart; this is the fix.
    expect(plotMinWidth(true, 90)).toBeGreaterThan(360 * 10);
    expect(plotMinWidth(true, 90) / 90).toBeGreaterThanOrEqual(44);
  });

  it("scales linearly with the number of readings", () => {
    expect(plotMinWidth(true, 20)).toBe(plotMinWidth(true, 10) * 2);
  });

  it("asks for no minimum when there is nothing to plot", () => {
    expect(plotMinWidth(true, 0)).toBe(0);
  });
});
