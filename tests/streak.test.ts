import { describe, expect, it } from "vitest";

import { computeStreak } from "@/lib/diary/streak";

const TODAY = "2026-07-04";

describe("computeStreak", () => {
  it("returns zeros with no logged days", () => {
    expect(computeStreak([], TODAY)).toEqual({
      current: 0,
      longest: 0,
      todayLogged: false,
    });
  });

  it("counts a run ending today", () => {
    const result = computeStreak(["2026-07-02", "2026-07-03", "2026-07-04"], TODAY);
    expect(result.current).toBe(3);
    expect(result.todayLogged).toBe(true);
  });

  it("keeps the streak alive through yesterday when today is not logged yet", () => {
    const result = computeStreak(["2026-07-02", "2026-07-03"], TODAY);
    expect(result.current).toBe(2);
    expect(result.todayLogged).toBe(false);
  });

  it("breaks the streak when yesterday and today are both empty", () => {
    const result = computeStreak(["2026-07-01", "2026-07-02"], TODAY);
    expect(result.current).toBe(0);
    expect(result.longest).toBe(2);
  });

  it("ignores a gap before the current run", () => {
    const result = computeStreak(
      ["2026-06-25", "2026-06-26", "2026-07-03", "2026-07-04"],
      TODAY,
    );
    expect(result.current).toBe(2);
  });

  it("tracks the longest run separately from the current one", () => {
    const result = computeStreak(
      ["2026-06-20", "2026-06-21", "2026-06-22", "2026-06-23", "2026-07-04"],
      TODAY,
    );
    expect(result.current).toBe(1);
    expect(result.longest).toBe(4);
  });

  it("handles unsorted input and month boundaries", () => {
    const result = computeStreak(["2026-07-01", "2026-06-30", "2026-06-29"], "2026-07-02");
    expect(result.current).toBe(3);
    expect(result.longest).toBe(3);
  });

  it("counts a single logged today as a 1-day streak", () => {
    expect(computeStreak([TODAY], TODAY).current).toBe(1);
  });
});
