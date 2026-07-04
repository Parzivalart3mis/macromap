import { describe, expect, it } from "vitest";

import {
  createDiaryEntrySchema,
  createSavedMealSchema,
  updateDiaryEntrySchema,
} from "@/lib/validations/diary";
import {
  barcodeLookupSchema,
  createFoodSchema,
  naturalLogSchema,
  updateFoodSchema,
} from "@/lib/validations/foods";
import { updateGoalProfileSchema } from "@/lib/validations/goals";
import { logBodyMetricsSchema, logWeightSchema } from "@/lib/validations/progress";
import { createCustomOrderSchema } from "@/lib/validations/stores";

const validFood = {
  name: "Oatmeal",
  servingSizeValue: 40,
  servingSizeUnit: "g",
  calories: 150,
  proteinG: 5,
  carbsG: 27,
  fatG: 3,
};

describe("createFoodSchema", () => {
  it("accepts a minimal valid food and defaults forceCreate to false", () => {
    const parsed = createFoodSchema.parse(validFood);
    expect(parsed.forceCreate).toBe(false);
  });

  it("rejects negative nutrition", () => {
    expect(createFoodSchema.safeParse({ ...validFood, calories: -1 }).success).toBe(false);
  });

  it("rejects a too-short barcode", () => {
    expect(createFoodSchema.safeParse({ ...validFood, barcode: "123" }).success).toBe(false);
  });
});

describe("updateFoodSchema", () => {
  it("rejects an empty update", () => {
    expect(updateFoodSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a partial update", () => {
    expect(updateFoodSchema.safeParse({ calories: 180 }).success).toBe(true);
  });
});

describe("barcodeLookupSchema", () => {
  it("requires digits only", () => {
    expect(barcodeLookupSchema.safeParse({ barcode: "12345678" }).success).toBe(true);
    expect(barcodeLookupSchema.safeParse({ barcode: "12a45678" }).success).toBe(false);
  });
});

describe("naturalLogSchema", () => {
  it("validates the date format", () => {
    expect(
      naturalLogSchema.safeParse({ date: "2026-07-04", mealName: "Lunch", text: "2 eggs" })
        .success,
    ).toBe(true);
    expect(
      naturalLogSchema.safeParse({ date: "07/04/2026", mealName: "Lunch", text: "2 eggs" })
        .success,
    ).toBe(false);
  });
});

describe("createDiaryEntrySchema", () => {
  const base = {
    date: "2026-07-04",
    mealName: "Lunch",
    quantity: 1,
    loggedVia: "search" as const,
  };
  const uuid = "3b241101-e2bb-4255-8caf-4136c566a962";

  it("requires exactly one of foodId or customStoreOrderId", () => {
    expect(createDiaryEntrySchema.safeParse({ ...base, foodId: uuid }).success).toBe(true);
    expect(
      createDiaryEntrySchema.safeParse({ ...base, customStoreOrderId: uuid }).success,
    ).toBe(true);
    expect(createDiaryEntrySchema.safeParse(base).success).toBe(false);
    expect(
      createDiaryEntrySchema.safeParse({ ...base, foodId: uuid, customStoreOrderId: uuid })
        .success,
    ).toBe(false);
  });

  it("defaults servingMultiplier to 1", () => {
    const parsed = createDiaryEntrySchema.parse({ ...base, foodId: uuid });
    expect(parsed.servingMultiplier).toBe(1);
  });
});

describe("updateDiaryEntrySchema", () => {
  it("rejects non-positive quantity", () => {
    expect(updateDiaryEntrySchema.safeParse({ quantity: 0 }).success).toBe(false);
  });
});

describe("createSavedMealSchema", () => {
  it("requires name, date, and mealName", () => {
    expect(
      createSavedMealSchema.safeParse({
        name: "My breakfast",
        date: "2026-07-04",
        mealName: "Breakfast",
      }).success,
    ).toBe(true);
    expect(createSavedMealSchema.safeParse({ name: "x", date: "bad" }).success).toBe(false);
  });
});

describe("updateGoalProfileSchema", () => {
  const day = (dayOfWeek: number) => ({
    dayOfWeek,
    calories: 2000,
    proteinG: 150,
    carbsG: 200,
    fatG: 70,
  });

  it("requires exactly 7 days", () => {
    expect(
      updateGoalProfileSchema.safeParse({ days: Array.from({ length: 7 }, (_, i) => day(i)) })
        .success,
    ).toBe(true);
    expect(
      updateGoalProfileSchema.safeParse({ days: Array.from({ length: 6 }, (_, i) => day(i)) })
        .success,
    ).toBe(false);
  });

  it("rejects out-of-range dayOfWeek", () => {
    const days = Array.from({ length: 7 }, (_, i) => day(i));
    days[6] = day(7);
    expect(updateGoalProfileSchema.safeParse({ days }).success).toBe(false);
  });
});

describe("progress schemas", () => {
  it("logWeightSchema requires a positive weight", () => {
    expect(logWeightSchema.safeParse({ date: "2026-07-04", weightValue: 82.4 }).success).toBe(
      true,
    );
    expect(logWeightSchema.safeParse({ date: "2026-07-04", weightValue: 0 }).success).toBe(
      false,
    );
  });

  it("logBodyMetricsSchema requires at least one metric", () => {
    expect(logBodyMetricsSchema.safeParse({ date: "2026-07-04" }).success).toBe(false);
    expect(
      logBodyMetricsSchema.safeParse({ date: "2026-07-04", bodyFatPct: 20 }).success,
    ).toBe(true);
    expect(
      logBodyMetricsSchema.safeParse({ date: "2026-07-04", bodyFatPct: 120 }).success,
    ).toBe(false);
  });
});

describe("createCustomOrderSchema", () => {
  const uuid = "3b241101-e2bb-4255-8caf-4136c566a962";

  it("requires at least one item with positive quantity", () => {
    expect(
      createCustomOrderSchema.safeParse({
        name: "My build",
        items: [{ ingredientFoodId: uuid, quantity: 1 }],
      }).success,
    ).toBe(true);
    expect(createCustomOrderSchema.safeParse({ name: "My build", items: [] }).success).toBe(
      false,
    );
    expect(
      createCustomOrderSchema.safeParse({
        name: "My build",
        items: [{ ingredientFoodId: uuid, quantity: 0 }],
      }).success,
    ).toBe(false);
  });
});
