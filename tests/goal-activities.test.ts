import { describe, expect, it } from "vitest";

import { todayInTimeZone } from "@/lib/dates";
import { currentActivities } from "@/lib/goals/activities";

describe("currentActivities", () => {
  const rows = [
    { name: "open-ended", effectiveUntil: null },
    { name: "retired yesterday", effectiveUntil: "2026-11-22" },
    { name: "ends today", effectiveUntil: "2026-11-23" },
    { name: "ends later", effectiveUntil: "2026-12-31" },
  ];

  it("hides only activities that have already ended", () => {
    expect(currentActivities(rows, "2026-11-23").map((r) => r.name)).toEqual([
      "open-ended",
      "ends today",
      "ends later",
    ]);
  });
});

describe("todayInTimeZone", () => {
  // 03:30 UTC on the 24th is still the evening of the 23rd in Chicago.
  const instant = new Date("2026-11-24T03:30:00Z");

  it("reads the date on the user's calendar, not the server's", () => {
    expect(todayInTimeZone("America/Chicago", instant)).toBe("2026-11-23");
    expect(todayInTimeZone("UTC", instant)).toBe("2026-11-24");
  });

  it("falls back to UTC for an unknown zone", () => {
    expect(todayInTimeZone("Not/AZone", instant)).toBe("2026-11-24");
  });
});
