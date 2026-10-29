import { describe, expect, it } from "vitest";

import { dayRing } from "@/components/diary/week-strip";

describe("dayRing", () => {
  const GOAL = 2160;

  it("declines to draw when the day resolved no goal", () => {
    // Older days predate any goal profile; the strip falls back to a tick.
    expect(dayRing(1800, null)).toBeNull();
  });

  it("declines to draw on a zero or negative goal rather than dividing by it", () => {
    expect(dayRing(1800, 0)).toBeNull();
    expect(dayRing(1800, -100)).toBeNull();
  });

  it("separates a snack from a full day, which the old tick could not", () => {
    const snack = dayRing(400, GOAL)!;
    const full = dayRing(2100, GOAL)!;
    expect(snack.outcome).toBe("under");
    expect(full.outcome).toBe("onTarget");
    expect(snack.fraction).toBeLessThan(full.fraction);
  });

  it("counts the last 5% as hitting the goal, not undershooting", () => {
    expect(dayRing(GOAL * 0.94, GOAL)!.outcome).toBe("under");
    expect(dayRing(GOAL * 0.95, GOAL)!.outcome).toBe("onTarget");
    expect(dayRing(GOAL, GOAL)!.outcome).toBe("onTarget");
  });

  it("flags anything past the goal as over", () => {
    expect(dayRing(GOAL + 1, GOAL)!.outcome).toBe("over");
    expect(dayRing(GOAL * 2, GOAL)!.outcome).toBe("over");
  });

  it("clamps the arc so an overshoot never overdraws the circle", () => {
    expect(dayRing(GOAL * 3, GOAL)!.fraction).toBe(1);
    expect(dayRing(GOAL, GOAL)!.fraction).toBe(1);
  });

  it("fills proportionally below the goal", () => {
    expect(dayRing(GOAL / 2, GOAL)!.fraction).toBeCloseTo(0.5, 5);
    expect(dayRing(0, GOAL)!.fraction).toBe(0);
  });

  it("treats a logged-but-empty day as zero rather than null", () => {
    const ring = dayRing(0, GOAL)!;
    expect(ring).not.toBeNull();
    expect(ring.outcome).toBe("under");
  });
});
