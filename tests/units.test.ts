import { describe, expect, it } from "vitest";

import {
  baseServingAmount,
  computeServing,
  formatNum,
  servingOptions,
  unitKindOf,
} from "@/lib/units";
import type { FoodDTO } from "@/types/api";

function food(overrides: Partial<FoodDTO>): FoodDTO {
  return {
    id: "f1",
    name: "Test",
    brandName: null,
    description: null,
    createdByUserId: null,
    sourceType: "user_created",
    servingSizeValue: 1,
    servingSizeUnit: "serving",
    alternateServings: [],
    calories: 100,
    proteinG: 10,
    carbsG: 20,
    fatG: 5,
    fiberG: null,
    sugarG: null,
    satFatG: null,
    sodiumMg: null,
    cholesterolMg: null,
    potassiumMg: null,
    transFatG: null,
    polyUnsatFatG: null,
    monoUnsatFatG: null,
    addedSugarsG: null,
    sugarAlcoholsG: null,
    vitaminAPct: null,
    vitaminCPct: null,
    calciumPct: null,
    ironPct: null,
    vitaminDPct: null,
    barcode: null,
    isVerified: false,
    isRecipe: false,
    logCount: 0,
    ...overrides,
  };
}

describe("formatNum", () => {
  it("keeps integers whole and rounds decimals to 2 places", () => {
    expect(formatNum(2)).toBe("2");
    expect(formatNum(236.588)).toBe("236.59");
    expect(formatNum(0.5)).toBe("0.5");
  });
});

describe("unitKindOf", () => {
  it("classifies units, taking the first known token", () => {
    expect(unitKindOf(food({ servingSizeUnit: "cup" }))).toBe("volume");
    expect(unitKindOf(food({ servingSizeUnit: "100 g" }))).toBe("weight");
    expect(unitKindOf(food({ servingSizeUnit: "g (1 scoop)" }))).toBe("weight");
    expect(unitKindOf(food({ servingSizeUnit: "serving" }))).toBe("count");
    expect(unitKindOf(food({ servingSizeUnit: "item" }))).toBe("count");
  });
});

describe("baseServingAmount", () => {
  it("converts the native serving to the base measure", () => {
    expect(baseServingAmount(food({ servingSizeValue: 1, servingSizeUnit: "cup" }))).toBeCloseTo(
      236.588,
      2,
    );
    expect(baseServingAmount(food({ servingSizeValue: 100, servingSizeUnit: "g" }))).toBe(100);
  });

  it("uses the raw value for count units", () => {
    expect(baseServingAmount(food({ servingSizeValue: 1, servingSizeUnit: "serving" }))).toBe(1);
  });
});

describe("servingOptions", () => {
  it("offers native + conversions for a cup-based food", () => {
    const opts = servingOptions(food({ servingSizeValue: 1, servingSizeUnit: "cup" }));
    const labels = opts.map((o) => o.label);
    expect(labels[0]).toBe("1 cup");
    expect(labels).toContain("236.59 ml");
    expect(labels).toContain("1 ml");
  });

  it("offers only the native unit for count foods", () => {
    const opts = servingOptions(food({ servingSizeValue: 1, servingSizeUnit: "serving" }));
    expect(opts).toHaveLength(1);
    expect(opts[0].label).toBe("1 serving");
  });

  it("dedupes options with the same base amount", () => {
    // 100 g native collides with the "100 g" canonical option.
    const opts = servingOptions(food({ servingSizeValue: 100, servingSizeUnit: "g" }));
    const hundredGram = opts.filter((o) => Math.abs(o.baseAmount - 100) < 0.001);
    expect(hundredGram).toHaveLength(1);
  });

  it("adds user-defined alternate servings, even for count foods", () => {
    const opts = servingOptions(
      food({
        servingSizeValue: 1,
        servingSizeUnit: "packet",
        alternateServings: [{ unit: "scoop", multiplier: 0.5 }],
      }),
    );
    // Labelled with the base equivalent in parentheses.
    const scoop = opts.find((o) => o.unit === "scoop");
    expect(scoop).toBeDefined();
    expect(scoop!.label).toBe("1 scoop (0.5 packets)");
    // Half a packet's worth of the base measure.
    expect(scoop!.baseAmount).toBeCloseTo(0.5);
  });

  it("labels a whole-multiple alternate serving with the base unit", () => {
    const opts = servingOptions(
      food({
        servingSizeValue: 1,
        servingSizeUnit: "serving",
        alternateServings: [{ unit: "container", multiplier: 4 }],
      }),
    );
    const container = opts.find((o) => o.unit === "container");
    expect(container?.label).toBe("1 container (4 servings)");
  });
});

describe("computeServing", () => {
  const milk = food({
    servingSizeValue: 1,
    servingSizeUnit: "cup",
    calories: 300,
    proteinG: 16,
    carbsG: 24,
    fatG: 16,
  });

  it("scales nutrition to the full native serving", () => {
    const cup = servingOptions(milk).find((o) => o.label === "1 cup")!;
    const result = computeServing(milk, cup, 2);
    expect(result.quantity).toBe(2);
    expect(result.servingMultiplier).toBeCloseTo(1, 5);
    expect(result.nutrition.calories).toBe(600);
    expect(result.servingText).toBe("2 cup");
  });

  it("scales correctly when a smaller unit is chosen", () => {
    const ml = servingOptions(milk).find((o) => o.label === "1 ml")!;
    const result = computeServing(milk, ml, 100);
    // 100 ml of a 236.588 ml cup = 100/236.588 of the serving.
    expect(result.nutrition.calories).toBeCloseTo((300 * 100) / 236.588, 1);
    expect(result.servingText).toBe("100 ml");
  });
});
