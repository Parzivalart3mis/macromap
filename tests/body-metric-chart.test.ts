import { describe, expect, it } from "vitest";

import { weightOnOrBefore } from "@/components/progress/charts";
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
