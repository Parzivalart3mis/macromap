import { describe, expect, it } from "vitest";

import { ruleBasedInsights } from "@/lib/ai/daily-insights";
import type { DiaryPayload } from "@/lib/diary/service";

function payload(overrides: Partial<DiaryPayload> = {}): DiaryPayload {
  return {
    date: "2026-07-04",
    meals: [],
    totals: { calories: 1500, proteinG: 120, carbsG: 150, fatG: 50, sodiumMg: 1500 },
    goal: {
      calories: 2000,
      proteinG: 170,
      carbsG: 190,
      fatG: 65,
      fiberG: null,
      sugarGMax: null,
      sodiumMgMax: 2300,
      satFatGMax: null,
    },
    ...overrides,
  };
}

describe("ruleBasedInsights", () => {
  it("reports remaining calories and protein gap", () => {
    const insights = ruleBasedInsights(payload());
    expect(insights.some((i) => i.includes("500 calories left"))).toBe(true);
    expect(insights.some((i) => i.includes("50 g short"))).toBe(true);
  });

  it("reports overage when past the goal", () => {
    const insights = ruleBasedInsights(
      payload({
        totals: { calories: 2400, proteinG: 180, carbsG: 200, fatG: 70 },
      }),
    );
    expect(insights.some((i) => i.includes("400 calories over"))).toBe(true);
    expect(insights.some((i) => i.includes("Protein is on track"))).toBe(true);
  });

  it("flags a sodium cap breach", () => {
    const insights = ruleBasedInsights(
      payload({
        totals: { calories: 1500, proteinG: 120, carbsG: 150, fatG: 50, sodiumMg: 3000 },
      }),
    );
    expect(insights.some((i) => i.includes("Sodium is over"))).toBe(true);
  });

  it("suggests setting a goal when none exists", () => {
    const insights = ruleBasedInsights(payload({ goal: null }));
    expect(insights.some((i) => i.includes("Set a goal profile"))).toBe(true);
  });

  it("names the largest meal", () => {
    const meal = (name: string, calories: number) => ({
      id: name,
      diaryDayId: "d",
      mealName: name,
      displayOrder: 0,
      entries: [
        {
          id: `${name}-e`,
          diaryMealId: name,
          foodId: null,
          customStoreOrderId: null,
          quantity: 1,
          servingMultiplier: 1,
          loggedVia: "search" as const,
          eatenTime: null,
          nutritionSnapshotJson: {
            label: "x",
            calories,
            proteinG: 0,
            carbsG: 0,
            fatG: 0,
          },
          createdAt: new Date(),
        },
      ],
      totals: { calories, proteinG: 0, carbsG: 0, fatG: 0 },
    });
    const insights = ruleBasedInsights(
      payload({ meals: [meal("Breakfast", 400), meal("Dinner", 900)] }),
    );
    expect(insights.some((i) => i.includes("Dinner was your largest meal at 900"))).toBe(
      true,
    );
  });

  it("never uses exclamation marks", () => {
    for (const insight of ruleBasedInsights(payload())) {
      expect(insight).not.toContain("!");
    }
  });

  it("caps output at 5 insights", () => {
    expect(ruleBasedInsights(payload()).length).toBeLessThanOrEqual(5);
  });
});
