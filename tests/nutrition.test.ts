import { describe, expect, it } from "vitest";

import type { Food } from "@/lib/db/schema";
import {
  emptyNutrition,
  foodToNutrition,
  roundNutrition,
  scaleNutrition,
  sumNutrition,
} from "@/lib/nutrition";

const baseFood = {
  id: "f1",
  name: "Test food",
  brandName: null,
  sourceType: "user_created",
  createdByUserId: null,
  servingSizeValue: 100,
  servingSizeUnit: "g",
  calories: 200,
  proteinG: 10,
  carbsG: 30,
  fatG: 5,
  fiberG: 4,
  sugarG: null,
  satFatG: null,
  sodiumMg: 300,
  cholesterolMg: null,
  potassiumMg: null,
  barcode: null,
  isVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Food;

describe("foodToNutrition", () => {
  it("copies required macros and only present micros", () => {
    const snapshot = foodToNutrition(baseFood);
    expect(snapshot).toEqual({
      calories: 200,
      proteinG: 10,
      carbsG: 30,
      fatG: 5,
      fiberG: 4,
      sodiumMg: 300,
    });
    expect("sugarG" in snapshot).toBe(false);
  });
});

describe("scaleNutrition", () => {
  it("scales every present key", () => {
    const scaled = scaleNutrition(foodToNutrition(baseFood), 2.5);
    expect(scaled.calories).toBe(500);
    expect(scaled.proteinG).toBe(25);
    expect(scaled.fiberG).toBe(10);
    expect(scaled.sodiumMg).toBe(750);
  });

  it("keeps missing optional keys missing", () => {
    const scaled = scaleNutrition({ calories: 100, proteinG: 1, carbsG: 2, fatG: 3 }, 2);
    expect(scaled.sugarG).toBeUndefined();
  });
});

describe("sumNutrition", () => {
  it("sums across snapshots and treats missing micros as 0", () => {
    const total = sumNutrition([
      { calories: 100, proteinG: 10, carbsG: 5, fatG: 2, fiberG: 3 },
      { calories: 50, proteinG: 5, carbsG: 10, fatG: 1 },
    ]);
    expect(total.calories).toBe(150);
    expect(total.proteinG).toBe(15);
    expect(total.fiberG).toBe(3);
  });

  it("returns zeros for an empty list", () => {
    expect(sumNutrition([])).toEqual(emptyNutrition());
  });
});

describe("roundNutrition", () => {
  it("rounds to one decimal by default", () => {
    const rounded = roundNutrition({
      calories: 123.456,
      proteinG: 0.04,
      carbsG: 9.99,
      fatG: 1.111,
    });
    expect(rounded.calories).toBe(123.5);
    expect(rounded.proteinG).toBe(0);
    expect(rounded.carbsG).toBe(10);
    expect(rounded.fatG).toBe(1.1);
  });
});
