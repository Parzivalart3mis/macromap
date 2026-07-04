import { afterEach, describe, expect, it, vi } from "vitest";

import { addDaysISO, weekStartISO } from "@/lib/dates";
import { defaultMealForNow, readableTextOn } from "@/lib/store-theme";

describe("addDaysISO", () => {
  it("adds and subtracts days across month boundaries", () => {
    expect(addDaysISO("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDaysISO("2026-07-01", -1)).toBe("2026-06-30");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("weekStartISO", () => {
  it("returns the Monday of the containing week", () => {
    // 2026-07-04 is a Saturday; that week's Monday is 2026-06-29.
    expect(weekStartISO("2026-07-04")).toBe("2026-06-29");
    // Monday maps to itself.
    expect(weekStartISO("2026-06-29")).toBe("2026-06-29");
    // Sunday belongs to the week that started 6 days earlier.
    expect(weekStartISO("2026-07-05")).toBe("2026-06-29");
  });
});

describe("readableTextOn", () => {
  it("picks white text on dark brand colors", () => {
    expect(readableTextOn("#00543C")).toBe("#ffffff"); // Subway green
    expect(readableTextOn("#381F00")).toBe("#ffffff"); // Dunkin brown
  });

  it("picks dark text on light colors", () => {
    expect(readableTextOn("#FFC72C")).toBe("#141F1B"); // McDonald's yellow
    expect(readableTextOn("#F5EBDC")).toBe("#141F1B");
  });
});

describe("defaultMealForNow", () => {
  afterEach(() => vi.useRealTimers());

  it("maps hours to meal buckets", () => {
    vi.useFakeTimers();
    const cases: Array<[number, string]> = [
      [8, "Breakfast"],
      [12, "Lunch"],
      [19, "Dinner"],
      [22, "Snacks"],
    ];
    for (const [hour, expected] of cases) {
      vi.setSystemTime(new Date(2026, 6, 4, hour, 0, 0));
      expect(defaultMealForNow()).toBe(expected);
    }
  });
});
