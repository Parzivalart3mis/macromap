import { describe, expect, it } from "vitest";

import {
  baseServingAmount,
  computeServing,
  formatNum,
  matchServingOption,
  nativeServingLabel,
  nativeServingTextFor,
  scaleServingText,
  servingOptions,
  servingTextFor,
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
    servingSizeLabel: null,
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
    expect(result.servingText).toBe("2 cups");
  });

  it("scales correctly when a smaller unit is chosen", () => {
    const ml = servingOptions(milk).find((o) => o.label === "1 ml")!;
    const result = computeServing(milk, ml, 100);
    // 100 ml of a 236.588 ml cup = 100/236.588 of the serving.
    expect(result.nutrition.calories).toBeCloseTo((300 * 100) / 236.588, 1);
    expect(result.servingText).toBe("100 ml");
  });

  it("pluralizes count units in the serving text", () => {
    const parle = food({ servingSizeValue: 1, servingSizeUnit: "cookie", calories: 21.7 });
    const native = servingOptions(parle)[0];
    expect(computeServing(parle, native, 4).servingText).toBe("4 cookies");
    expect(computeServing(parle, native, 1).servingText).toBe("1 cookie");
  });

  it("uses the option's explicit label at exactly one serving", () => {
    const soda = food({
      servingSizeValue: 1,
      servingSizeUnit: "can",
      calories: 140,
      alternateServings: [{ unit: "16.9 fl oz", multiplier: 1.4083, label: "16.9 fl oz" }],
    });
    const bottle = servingOptions(soda).find((o) => o.unit === "16.9 fl oz")!;
    expect(computeServing(soda, bottle, 1).servingText).toBe("16.9 fl oz");
    expect(computeServing(soda, bottle, 1).nutrition.calories).toBeCloseTo(140 * 1.4083, 0);
  });

  it("keeps a labelled alternate's nutrition = servings × multiplier", () => {
    const banana = food({
      servingSizeValue: 118,
      servingSizeUnit: "g",
      servingSizeLabel: "1 medium (118 g)",
      calories: 105,
      alternateServings: [{ unit: "large", multiplier: 136 / 118, label: "1 large (136 g)" }],
    });
    const opts = servingOptions(banana);
    expect(opts[0].label).toBe("1 medium (118 g)");
    const large = opts.find((o) => o.unit === "large")!;
    const one = computeServing(banana, large, 1);
    expect(one.servingText).toBe("1 large (136 g)");
    expect(one.servingMultiplier).toBeCloseTo(136 / 118, 5);
    expect(one.nutrition.calories).toBeCloseTo(105 * (136 / 118), 0);
    // The logged pair (quantity, multiplier) must reproduce the same factor.
    expect(one.quantity * one.servingMultiplier).toBeCloseTo(136 / 118, 5);
  });
});

describe("scaleServingText", () => {
  it("scales every amount, so the parenthetical stays true instead of going stale", () => {
    expect(scaleServingText("2 slices", 2)).toBe("4 slices");
    expect(scaleServingText("1 medium (118 g)", 2)).toBe("2 medium (236 g)");
    expect(scaleServingText("1 medium (118 g)", 0.9)).toBe("0.9 medium (106.2 g)");
    expect(scaleServingText("31 g (1 scoop)", 2)).toBe("62 g (2 scoops)");
    expect(scaleServingText("1 pack (4 cups, 601 g)", 2)).toBe("2 packs (8 cups, 1202 g)");
    expect(scaleServingText("1 serving (~165 g)", 2)).toBe("2 servings (~330 g)");
  });

  it("makes the unit agree with the new amount in both directions", () => {
    expect(scaleServingText("1 order", 3)).toBe("3 orders");
    expect(scaleServingText("2 cookies", 0.5)).toBe("1 cookie");
    expect(scaleServingText("2 slices (41 g)", 0.5)).toBe("1 slice (20.5 g)");
    expect(scaleServingText("1 box (454 g)", 2)).toBe("2 boxes (908 g)");
    expect(scaleServingText("1 dish", 2)).toBe("2 dishes");
  });

  it("leaves abbreviations and size adjectives uninflected", () => {
    expect(scaleServingText("2 tbsp (28 g)", 2)).toBe("4 tbsp (56 g)");
    expect(scaleServingText("1 extra small (81 g)", 2)).toBe("2 extra small (162 g)");
    expect(scaleServingText("12 fl oz", 2)).toBe("24 fl oz");
  });

  it("pluralizes the measure, not its qualifier", () => {
    expect(scaleServingText("1 cup, sliced (150 g)", 2)).toBe("2 cups, sliced (300 g)");
    expect(scaleServingText("1 cup with gravy (~200 g)", 2)).toBe("2 cups with gravy (~400 g)");
    expect(scaleServingText("1 family pack (10 blocks, 700 g)", 2)).toBe(
      "2 family packs (20 blocks, 1400 g)",
    );
  });

  it("reads fractions, and keeps text after the parenthetical", () => {
    expect(scaleServingText("3/4 cup (56 g) dry", 2)).toBe("1.5 cups (112 g) dry");
    expect(scaleServingText("½ bagel (56.5 g)", 2)).toBe("1 bagel (113 g)");
  });

  it("drops a parenthetical that has no amount to scale", () => {
    expect(scaleServingText("2 cookies (label serving)", 2)).toBe("4 cookies");
  });

  it("passes through unscaled, unnumbered or unparseable texts", () => {
    expect(scaleServingText("1 medium (118 g)", 1)).toBe("1 medium (118 g)");
    expect(scaleServingText("Custom build", 2)).toBe("Custom build");
    expect(scaleServingText(undefined, 2)).toBeUndefined();
    // A mixed number is not modelled; mangling it would be worse than leaving it.
    expect(scaleServingText("1 1/2 cups", 2)).toBe("1 1/2 cups");
  });

  it("scales multiplied texts by their multiplier alone", () => {
    expect(scaleServingText("2 × 16.9 fl oz", 2)).toBe("4 × 16.9 fl oz");
    expect(scaleServingText("2 × whole pizza", 0.5)).toBe("whole pizza");
  });
});

describe("servingTextFor", () => {
  it("uses the label verbatim at one serving", () => {
    expect(servingTextFor("1 medium (118 g)", 1)).toBe("1 medium (118 g)");
  });

  it("counts a label that carries no amount of its own", () => {
    expect(servingTextFor("whole pizza", 2)).toBe("2 × whole pizza");
    expect(servingTextFor("large (6 oz)", 2)).toBe("2 × large (6 oz)");
  });
});

describe("the banana that read differently once logged", () => {
  // Picking "1 medium (118 g)" and logging 0.9 or 2 of it used to store
  // "106.2 g" / "236 g": the diary row lost the unit the picker had shown.
  const banana = food({
    servingSizeValue: 118,
    servingSizeUnit: "g",
    servingSizeLabel: "1 medium (118 g)",
    calories: 105,
    alternateServings: [
      { unit: "extra small", multiplier: 81 / 118, label: "1 extra small (81 g)" },
      { unit: "cup sliced", multiplier: 150 / 118, label: "1 cup, sliced (150 g)" },
    ],
  });
  const opts = servingOptions(banana);

  it("keeps the picked unit at any number of servings", () => {
    expect(computeServing(banana, opts[0], 1).servingText).toBe("1 medium (118 g)");
    expect(computeServing(banana, opts[0], 2).servingText).toBe("2 medium (236 g)");
    expect(computeServing(banana, opts[0], 0.9).servingText).toBe("0.9 medium (106.2 g)");
  });

  it("does the same for a labelled alternate", () => {
    const small = opts.find((o) => o.unit === "extra small")!;
    expect(computeServing(banana, small, 2).servingText).toBe("2 extra small (162 g)");
    const sliced = opts.find((o) => o.unit === "cup sliced")!;
    expect(computeServing(banana, sliced, 2).servingText).toBe("2 cups, sliced (300 g)");
  });

  it("still writes plain grams when grams are what was picked", () => {
    const gram = opts.find((o) => o.label === "1 g")!;
    expect(computeServing(banana, gram, 130).servingText).toBe("130 g");
  });

  it("round-trips through the edit dialog's per-serving view", () => {
    // The dialog divides the stored total by the quantity to show one serving.
    const stored = computeServing(banana, opts[0], 2).servingText;
    expect(scaleServingText(stored, 1 / 2)).toBe("1 medium (118 g)");
  });
});

describe("numeric-unit serving text", () => {
  it("writes multiples of number-led units with ×", () => {
    const soda = food({
      servingSizeValue: 1,
      servingSizeUnit: "can",
      alternateServings: [{ unit: "16.9 fl oz", multiplier: 1.4083, label: "16.9 fl oz" }],
    });
    const bottle = servingOptions(soda).find((o) => o.unit === "16.9 fl oz")!;
    expect(computeServing(soda, bottle, 2).servingText).toBe("2 × 16.9 fl oz");
  });
});

describe("nativeServingTextFor", () => {
  it("uses the native label at one serving and pluralized amounts otherwise", () => {
    const banana = food({
      servingSizeValue: 118,
      servingSizeUnit: "g",
      servingSizeLabel: "1 medium (118 g)",
    });
    expect(nativeServingTextFor(banana, 1)).toBe("1 medium (118 g)");
    expect(nativeServingTextFor(banana, 2)).toBe("2 medium (236 g)");

    const whey = food({ servingSizeValue: 32, servingSizeUnit: "g (1 scoop)" });
    expect(nativeServingTextFor(whey, 2)).toBe("64 g (2 scoops)");

    const egg = food({ servingSizeValue: 1, servingSizeUnit: "egg" });
    expect(nativeServingTextFor(egg, 3)).toBe("3 eggs");
    expect(nativeServingTextFor(egg, 1)).toBe("1 egg");

    const bread = food({ servingSizeValue: 2, servingSizeUnit: "slices" });
    expect(nativeServingTextFor(bread, 1)).toBe("2 slices");
    expect(nativeServingTextFor(bread, 2)).toBe("4 slices");
  });
});

describe("nativeServingLabel", () => {
  it("makes a bare unit agree with its amount", () => {
    expect(nativeServingLabel(food({ servingSizeValue: 3, servingSizeUnit: "piece" }))).toBe(
      "3 pieces",
    );
    expect(nativeServingLabel(food({ servingSizeValue: 1, servingSizeUnit: "slices" }))).toBe(
      "1 slice",
    );
    expect(nativeServingLabel(food({ servingSizeValue: 100, servingSizeUnit: "g" }))).toBe("100 g");
  });
});

describe("unit classification by leading word", () => {
  it("does not mistake a described bowl for a gram", () => {
    // "bowl (~325g)" used to classify as weight — one bowl became 1 g, and the
    // generated "100 g" option logged a hundred bowls.
    const poha = food({ servingSizeValue: 1, servingSizeUnit: "bowl (~325g)", calories: 250 });
    expect(unitKindOf(poha)).toBe("count");
    expect(servingOptions(poha).map((o) => o.label)).toEqual(["1 bowl (~325g)"]);
  });

  it("still reads a leading measure through its description", () => {
    expect(unitKindOf(food({ servingSizeUnit: "ml (12 fl oz)" }))).toBe("volume");
    expect(unitKindOf(food({ servingSizeUnit: "fl oz" }))).toBe("volume");
    expect(unitKindOf(food({ servingSizeUnit: "slices" }))).toBe("count");
  });
});

describe("generated options", () => {
  it("offers grams and ounces, not pounds or kilograms", () => {
    const labels = servingOptions(food({ servingSizeValue: 28, servingSizeUnit: "g" })).map(
      (o) => o.label,
    );
    expect(labels).toEqual(["28 g", "1 g", "1 oz", "100 g"]);
  });

  it("does not offer litres for a volume food", () => {
    const labels = servingOptions(food({ servingSizeValue: 1, servingSizeUnit: "cup" })).map(
      (o) => o.label,
    );
    expect(labels).not.toContain("1 l");
    expect(labels).toContain("1 tbsp");
  });

  it("labels a weight alternate as the weight, not a fraction of the base", () => {
    // Used to read "1 g (0.83 almonds)".
    const almonds = food({
      servingSizeValue: 1,
      servingSizeUnit: "almond",
      alternateServings: [{ unit: "g", multiplier: 0.8333 }],
    });
    const gram = servingOptions(almonds).find((o) => o.unit === "g")!;
    expect(gram.label).toBe("1 g");
    expect(computeServing(almonds, gram, 30).servingText).toBe("30 g");
  });
});

describe("matchServingOption", () => {
  // The curd entry: base 100 g with a "1 cup (245 g)" alternate.
  const curd = food({
    servingSizeValue: 100,
    servingSizeUnit: "g",
    alternateServings: [{ unit: "cup", multiplier: 2.45, label: "1 cup (245 g)" }],
    calories: 61,
  });

  it("finds the native serving at multiplier 1", () => {
    expect(matchServingOption(curd, 1)?.label).toBe("100 g");
  });

  it("finds an alternate serving by its multiplier", () => {
    expect(matchServingOption(curd, 2.45)?.label).toBe("1 cup (245 g)");
  });

  it("finds an auto-generated weight option", () => {
    // 1 oz = 28.3495 g against a 100 g base.
    expect(matchServingOption(curd, 0.283495)?.label).toBe("1 oz");
  });

  it("returns null when no option matches", () => {
    // A multiplier from a unit the food no longer offers: leave the entry alone.
    expect(matchServingOption(curd, 3.7)).toBeNull();
  });

  it("returns null for a food with no measurable base", () => {
    expect(matchServingOption(curd, Number.NaN)).toBeNull();
  });

  it("tolerates floating-point drift in a stored multiplier", () => {
    expect(matchServingOption(curd, 2.4500000001)?.label).toBe("1 cup (245 g)");
  });

  it("matches count-based alternates too", () => {
    const cookie = food({
      servingSizeValue: 1,
      servingSizeUnit: "cookie",
      servingSizeLabel: "1 cookie (~15.5 g)",
      alternateServings: [{ unit: "cookie", multiplier: 2, label: "2 cookies" }],
      calories: 70,
    });
    expect(matchServingOption(cookie, 1)?.label).toBe("1 cookie (~15.5 g)");
    expect(matchServingOption(cookie, 2)?.label).toBe("2 cookies");
    expect(matchServingOption(cookie, 5)).toBeNull();
  });
});
