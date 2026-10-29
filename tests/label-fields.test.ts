import { describe, expect, it } from "vitest";

import { labelWarnings, parseServing } from "@/lib/foods/label-fields";

describe("parseServing", () => {
  it("splits the printed serving into a value and a unit", () => {
    expect(parseServing("1 pack (70 g)")).toEqual({ value: 1, unit: "pack (70 g)" });
    expect(parseServing("28 g")).toEqual({ value: 28, unit: "g" });
    expect(parseServing("100g")).toEqual({ value: 100, unit: "g" });
  });

  it("understands the fractions labels actually print", () => {
    expect(parseServing("1/2 cup")).toEqual({ value: 0.5, unit: "cup" });
    expect(parseServing("2/3 cup (170g)")).toEqual({
      value: 2 / 3,
      unit: "cup (170g)",
    });
  });

  it("falls back rather than producing a zero or negative serving", () => {
    expect(parseServing("piece")).toEqual({ value: 1, unit: "piece" });
    expect(parseServing("0 g")).toEqual({ value: 1, unit: "g" });
    expect(parseServing("")).toEqual({ value: 1, unit: "serving" });
  });
});

describe("labelWarnings", () => {
  const ok = {
    calories: "320", proteinG: "7", carbsG: "43", fatG: "14",
    satFatG: "7", transFatG: "0", fiberG: "2", sugarG: "2", addedSugarsG: "1",
  };

  it("stays quiet on a label that adds up", () => {
    // The real Sunfeast YiPPee panel.
    expect(labelWarnings(ok)).toEqual([]);
  });

  it("catches fat components exceeding total fat", () => {
    // The classic symptom of a %DV column read one row out of register.
    expect(labelWarnings({ ...ok, satFatG: "18" })[0]).toMatch(/total fat/i);
  });

  it("catches fiber and sugar exceeding carbohydrate", () => {
    expect(labelWarnings({ ...ok, fiberG: "30", sugarG: "20" })[0]).toMatch(/carbohydrate/i);
  });

  it("catches added sugars above total sugars", () => {
    expect(labelWarnings({ ...ok, addedSugarsG: "9" })[0]).toMatch(/added sugars/i);
  });

  it("flags macros that cannot produce the printed calories", () => {
    expect(labelWarnings({ ...ok, calories: "90" })[0]).toMatch(/kcal/);
  });

  it("tolerates the rounding and fiber accounting real labels use", () => {
    // L'oven Fresh: 4-4-9 gives 88.5 against a printed 70, because the
    // calories are computed on net carbs. Not an error.
    expect(
      labelWarnings({ calories: "70", proteinG: "5", carbsG: "16", fatG: "0.5", fiberG: "5", sugarG: "3" }),
    ).toEqual([]);
  });

  it("says nothing when the fields are still empty", () => {
    expect(labelWarnings({})).toEqual([]);
  });
});
