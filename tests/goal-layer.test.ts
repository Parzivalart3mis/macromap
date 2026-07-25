import { describe, expect, it } from "vitest";

import { layerGoal } from "@/lib/diary/service";

// Base = the rest-day floor from Workout #5 - Updated.
const base = {
  calories: 2100,
  carbsG: 196,
  proteinG: 160,
  fatG: 75,
  fiberG: null,
  sugarGMax: null,
  sodiumMgMax: null,
  satFatGMax: null,
};

const act = (
  id: string,
  name: string,
  days: number[],
  deltaCarbsG: number,
  displayOrder = 0,
) => ({
  id,
  name,
  daysOfWeek: days,
  deltaCarbsG,
  deltaProteinG: 0,
  deltaFatG: 0,
  displayOrder,
  effectiveFrom: null,
  effectiveUntil: null,
});

// The four constant weekday activities + Monday's lifting session.
const WEEKDAY = [
  act("ebike", "E-bike commute", [1, 2, 3, 4, 5], 28, 0),
  act("std", "Standard commute", [1, 2, 3, 4, 5], 50, 1),
  act("gym", "Gym-trip bike", [1, 2, 3, 4, 5], 20, 2),
  act("shift", "Subway shift", [1, 2, 3, 4, 5], 62, 3),
  act("legsA", "Legs A", [1], 78, 4),
];

describe("layerGoal", () => {
  it("reproduces Monday's target (base + activities)", () => {
    const { goal } = layerGoal(base, WEEKDAY, [], "2026-07-20", 1); // Mon
    expect(goal.carbsG).toBe(434); // 196 + 28+50+20+62+78
    expect(goal.proteinG).toBe(160);
    expect(goal.fatG).toBe(75);
    expect(goal.calories).toBe(3052); // 2100 + 238*4
  });

  it("weekend is base-only (no activities match)", () => {
    const { goal, breakdown } = layerGoal(base, WEEKDAY, [], "2026-07-25", 6); // Sat
    expect(goal.carbsG).toBe(196);
    expect(goal.calories).toBe(2100);
    expect(breakdown).toHaveLength(1); // just Base
  });

  it("a skip exception removes exactly that activity", () => {
    const skip = [{ id: "e1", activityId: "legsA", kind: "skip" as const, label: null, deltaCarbsG: null, deltaProteinG: null, deltaFatG: null }];
    const { goal } = layerGoal(base, WEEKDAY, skip, "2026-07-20", 1);
    expect(goal.carbsG).toBe(434 - 78); // Legs A gone
    expect(goal.calories).toBe(3052 - 78 * 4);
  });

  it("an override replaces a day's delta", () => {
    const override = [{ id: "e2", activityId: "legsA", kind: "override" as const, label: null, deltaCarbsG: 40, deltaProteinG: null, deltaFatG: null }];
    const { goal } = layerGoal(base, WEEKDAY, override, "2026-07-20", 1);
    expect(goal.carbsG).toBe(434 - 78 + 40);
  });

  it("a one-off adds an ad-hoc adjustment", () => {
    const oneoff = [{ id: "e3", activityId: null, kind: "oneoff" as const, label: "Extra ride", deltaCarbsG: 30, deltaProteinG: null, deltaFatG: null }];
    const { goal, breakdown } = layerGoal(base, WEEKDAY, oneoff, "2026-07-20", 1);
    expect(goal.carbsG).toBe(434 + 30);
    expect(breakdown.at(-1)!.label).toBe("Extra ride");
  });

  it("reports per-activity state for the adjust UI", () => {
    const skip = [{ id: "ex1", activityId: "legsA", kind: "skip" as const, label: null, deltaCarbsG: null, deltaProteinG: null, deltaFatG: null }];
    const { dayActivities } = layerGoal(base, WEEKDAY, skip, "2026-07-20", 1);
    expect(dayActivities).toHaveLength(5); // all Monday activities, skipped ones included
    const legs = dayActivities.find((a) => a.activityId === "legsA")!;
    expect(legs.skipped).toBe(true);
    expect(legs.exceptionId).toBe("ex1");
    const shift = dayActivities.find((a) => a.activityId === "shift")!;
    expect(shift.skipped).toBe(false);
    expect(shift.exceptionId).toBeNull();
  });

  it("surfaces one-offs with their exception id", () => {
    const oneoff = [{ id: "ex9", activityId: null, kind: "oneoff" as const, label: "Extra ride", deltaCarbsG: 30, deltaProteinG: null, deltaFatG: null }];
    const { dayOneOffs } = layerGoal(base, WEEKDAY, oneoff, "2026-07-20", 1);
    expect(dayOneOffs).toEqual([
      { exceptionId: "ex9", label: "Extra ride", carbsG: 30, proteinG: 0, fatG: 0, calories: 120 },
    ]);
  });

  it("respects effective windows and floors at 0", () => {
    const future = [{ ...act("x", "Future", [1], 50), effectiveFrom: "2026-08-01" }];
    expect(layerGoal(base, future, [], "2026-07-20", 1).goal.carbsG).toBe(196); // not yet active
    const bigRemoval = [act("neg", "Removal", [1], -500)];
    expect(layerGoal(base, bigRemoval, [], "2026-07-20", 1).goal.carbsG).toBe(0); // floored
  });
});
