import { afterEach, describe, expect, it, vi } from "vitest";

import { addDaysISO, formatClock, weekStartISO, zonedDateHour } from "@/lib/dates";
import { defaultMealForNow, readableTextOn } from "@/lib/store-theme";

describe("addDaysISO", () => {
  it("adds and subtracts days across month boundaries", () => {
    expect(addDaysISO("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDaysISO("2026-07-01", -1)).toBe("2026-06-30");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("formatClock", () => {
  it("formats 24h HH:MM as 12h with period", () => {
    expect(formatClock("00:05")).toBe("12:05 AM");
    expect(formatClock("08:30")).toBe("8:30 AM");
    expect(formatClock("12:00")).toBe("12:00 PM");
    expect(formatClock("14:05")).toBe("2:05 PM");
    expect(formatClock("23:59")).toBe("11:59 PM");
  });

  it("passes through non-time strings", () => {
    expect(formatClock("nope")).toBe("nope");
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

describe("zonedDateHour", () => {
  it("reads the user's own day and hour", () => {
    // 04:30 UTC on Nov 1 is still 11 PM on Oct 31 in Chicago (CDT, UTC-5).
    const now = new Date("2026-11-01T04:30:00Z");
    expect(zonedDateHour("America/Chicago", now)).toEqual({ date: "2026-10-31", hour: 23 });
    expect(zonedDateHour("UTC", now)).toEqual({ date: "2026-11-01", hour: 4 });
    expect(zonedDateHour("Asia/Kolkata", now)).toEqual({ date: "2026-11-01", hour: 10 });
  });

  it("falls back to UTC for an unknown zone", () => {
    const now = new Date("2026-11-01T00:15:00Z");
    expect(zonedDateHour("Not/AZone", now)).toEqual({ date: "2026-11-01", hour: 0 });
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
      [17, "Snacks"],
      [19, "Dinner"],
      [22, "Dinner"],
    ];
    for (const [hour, expected] of cases) {
      vi.setSystemTime(new Date(2026, 6, 4, hour, 0, 0));
      expect(defaultMealForNow()).toBe(expected);
    }
  });
});
