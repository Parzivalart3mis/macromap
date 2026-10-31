import { describe, expect, it } from "vitest";

import {
  buildDaySummary,
  dayScore,
  readSummary,
  shortLabel,
  summaryFingerprint,
  type SummaryContext,
} from "@/lib/diary/day-summary";
import type { DiaryPayload } from "@/lib/diary/service";
import type { NutritionSnapshot } from "@/types/nutrition";

type ItemSpec = Partial<NutritionSnapshot> & { label: string; time?: string };

function meal(name: string, items: ItemSpec[]): DiaryPayload["meals"][number] {
  const entries = items.map((item, index) => {
    const { label, time, ...n } = item;
    return {
      id: `${name}-${index}`,
      diaryMealId: name,
      foodId: null,
      customStoreOrderId: null,
      quantity: 1,
      servingMultiplier: 1,
      loggedVia: "search" as const,
      eatenTime: time ?? null,
      nutritionSnapshotJson: { label, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, ...n },
      verified: false,
      createdAt: new Date(),
    };
  });
  return { id: name, diaryDayId: "d", mealName: name, displayOrder: 0, entries, totals: sum(items) };
}

function sum(items: Partial<NutritionSnapshot>[]): NutritionSnapshot {
  const total: NutritionSnapshot = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const item of items) {
    for (const [key, value] of Object.entries(item)) {
      if (typeof value !== "number") continue;
      const k = key as keyof NutritionSnapshot;
      total[k] = (total[k] ?? 0) + value;
    }
  }
  return total;
}

const GOAL = {
  calories: 2000,
  proteinG: 170,
  carbsG: 190,
  fatG: 65,
  fiberG: null,
  sugarGMax: null,
  sodiumMgMax: 2300,
  satFatGMax: null,
};

function day(meals: DiaryPayload["meals"], overrides: Partial<DiaryPayload> = {}): DiaryPayload {
  return {
    date: "2026-07-04",
    meals,
    totals: sum(meals.map((m) => m.totals)),
    goal: GOAL,
    goalProfileId: null,
    goalPhase: null,
    goalBreakdown: null,
    dayActivities: null,
    dayOneOffs: null,
    completedAt: null,
    analysis: null,
    ...overrides,
  };
}

const ON_TARGET = [
  meal("Breakfast", [{ label: "Greek Yogurt (Fage)", calories: 500, proteinG: 50, carbsG: 50, fatG: 15, sodiumMg: 300 }]),
  meal("Lunch", [{ label: "Chicken Bowl", calories: 750, proteinG: 60, carbsG: 70, fatG: 25, sodiumMg: 900 }]),
  meal("Dinner", [{ label: "Salmon Rice", calories: 750, proteinG: 60, carbsG: 70, fatG: 25, sodiumMg: 800 }]),
];

describe("buildDaySummary", () => {
  it("handles an empty day", () => {
    const summary = buildDaySummary(day([]));
    expect(summary.headline).toBe("Nothing was logged this day.");
    expect(summary.score).toBeNull();
  });

  it("reports raw totals and asks for a goal when none exists", () => {
    const summary = buildDaySummary(day(ON_TARGET, { goal: null }));
    expect(summary.headline).toContain("2,000 cal");
    expect(summary.score).toBeNull();
    expect(summary.tomorrow[0]).toContain("Set a goal");
  });

  it("calls an on-target day and credits the protein source", () => {
    const summary = buildDaySummary(day(ON_TARGET));
    expect(summary.headline).toMatch(/^On target: 2,000 of 2,000 cal/);
    expect(summary.wins[0]).toContain("Protein hit at 170 g; Chicken Bowl led with 60 g");
    expect(summary.wins.some((w) => w.includes("Sodium stayed under"))).toBe(false); // only 3 kept
    expect(summary.improve).toEqual([]);
    expect(summary.score).toBeGreaterThanOrEqual(95);
  });

  it("names the meal and the food behind a calorie overage", () => {
    const summary = buildDaySummary(
      day([
        ...ON_TARGET.slice(0, 2),
        meal("Dinner", [{ label: "Deep Dish Pizza (Lou's)", calories: 1400, proteinG: 55, carbsG: 120, fatG: 70 }]),
      ]),
    );
    expect(summary.headline).toContain("650 cal over target, mostly at dinner");
    expect(summary.improve[0]).toBe("650 cal over. Deep Dish Pizza at dinner was 1,400 cal (53% of the day).");
    expect(summary.tomorrow[0]).toContain("A half portion of Deep Dish Pizza");
  });

  it("points at a protein-poor meal and suggests foods the user already logs", () => {
    const context: SummaryContext = {
      recentDays: [],
      recentFoods: [
        { label: "Whey Shake", serving: "1 scoop", calories: 120, proteinG: 25, fiberG: 0, count: 9 },
        { label: "Cookies", calories: 300, proteinG: 3, fiberG: 1, count: 12 },
      ],
    };
    const summary = buildDaySummary(
      day([
        meal("Breakfast", [{ label: "Bagel", calories: 600, proteinG: 15, carbsG: 110, fatG: 8 }]),
        meal("Lunch", [{ label: "Chicken Bowl", calories: 750, proteinG: 60, carbsG: 70, fatG: 25 }]),
        meal("Dinner", [{ label: "Pasta", calories: 650, proteinG: 25, carbsG: 90, fatG: 20 }]),
      ]),
      context,
    );
    expect(summary.headline).toContain("protein 70 g short");
    const protein = summary.improve.find((line) => line.startsWith("Protein 70 g short"));
    expect(protein).toContain("Breakfast was 600 cal with only 15 g protein");
    expect(summary.tomorrow.join(" ")).toContain("Whey Shake (25 g protein for 120 cal, 1 scoop)");
    expect(summary.tomorrow.join(" ")).not.toContain("Cookies");
  });

  it("attributes a sodium overage to its biggest sources", () => {
    const summary = buildDaySummary(
      day([
        meal("Lunch", [
          { label: "Ramen", calories: 1000, proteinG: 85, carbsG: 95, fatG: 32, sodiumMg: 2400 },
          { label: "Pickles", calories: 0, sodiumMg: 600 },
        ]),
        meal("Dinner", [{ label: "Steak Plate", calories: 1000, proteinG: 85, carbsG: 95, fatG: 33, sodiumMg: 200 }]),
      ]),
    );
    const line = summary.improve.find((l) => l.startsWith("Sodium"));
    expect(line).toBe(
      "Sodium 3,200 mg against a 2,300 mg cap; Ramen (2,400 mg) and Pickles (600 mg) made up 94%.",
    );
  });

  it("flags heavy late-night eating from entry times", () => {
    const summary = buildDaySummary(
      day([
        meal("Lunch", [{ label: "Chicken Bowl", calories: 1300, proteinG: 120, carbsG: 120, fatG: 40 }]),
        meal("Snacks", [{ label: "Ice Cream", calories: 700, proteinG: 50, carbsG: 70, fatG: 25, time: "22:30" }]),
      ]),
    );
    expect(summary.improve.some((l) => l.startsWith("700 cal came after 9 PM (Ice Cream)"))).toBe(true);
  });

  it("compares with recent days once there is history", () => {
    const summary = buildDaySummary(day(ON_TARGET), {
      recentDays: [
        { date: "2026-07-03", calories: 2400, proteinG: 140 },
        { date: "2026-07-02", calories: 2400, proteinG: 140 },
        { date: "2026-07-01", calories: 2400, proteinG: 140 },
      ],
      recentFoods: [],
    });
    expect(summary.trend).toBe(
      "400 cal less and 30 g more protein than your 3-day average (2,400 cal, 140 g protein).",
    );
  });

  it("keeps every section to three lines and never uses exclamation marks", () => {
    const summary = buildDaySummary(
      day([meal("Dinner", [{ label: "Buffet", calories: 4000, proteinG: 40, carbsG: 500, fatG: 200, sodiumMg: 6000, sugarG: 200 }])], {
        goal: { ...GOAL, sugarGMax: 50, fiberG: 30 },
      }),
    );
    for (const lines of [summary.wins, summary.improve, summary.tomorrow]) {
      expect(lines.length).toBeLessThanOrEqual(3);
    }
    for (const text of [summary.headline, ...summary.wins, ...summary.improve, ...summary.tomorrow]) {
      expect(text).not.toContain("!");
    }
  });
});

describe("dayScore", () => {
  it("is null without a goal and drops as the day drifts", () => {
    expect(dayScore(day(ON_TARGET, { goal: null }))).toBeNull();
    const good = dayScore(day(ON_TARGET))!;
    const bad = dayScore(
      day([meal("Dinner", [{ label: "Pizza", calories: 3000, proteinG: 60, carbsG: 300, fatG: 150 }])]),
    )!;
    expect(good).toBeGreaterThan(bad);
    expect(bad).toBeLessThan(30);
  });
});

describe("summaryFingerprint / readSummary", () => {
  it("changes when an entry changes", () => {
    const a = summaryFingerprint(day(ON_TARGET));
    const b = summaryFingerprint(
      day([...ON_TARGET, meal("Snacks", [{ label: "Apple", calories: 95, carbsG: 25 }])]),
    );
    expect(a).not.toBe(b);
  });

  it("reads v2 summaries and treats the old string list as none", () => {
    expect(readSummary(["Protein is on track for today."])).toBeNull();
    expect(readSummary(null)).toBeNull();
    const summary = buildDaySummary(day(ON_TARGET));
    expect(readSummary(summary)).toBe(summary);
  });

  it("drops a trailing brand from labels", () => {
    expect(shortLabel("Chicken Breast (Kroger)")).toBe("Chicken Breast");
    expect(shortLabel("Pad Thai")).toBe("Pad Thai");
  });
});
