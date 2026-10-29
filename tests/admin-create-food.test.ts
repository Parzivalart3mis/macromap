import { describe, expect, it } from "vitest";

import { adminCreateFoodSchema, createFoodSchema } from "@/lib/validations/foods";

const base = {
  name: "Mixed Veg Paratha",
  servingSizeValue: 1,
  servingSizeUnit: "piece",
  calories: 200,
  proteinG: 4,
  carbsG: 27,
  fatG: 7,
};

describe("the member path stays closed", () => {
  it("drops isVerified and store from a member create", () => {
    const parsed = createFoodSchema.parse({
      ...base,
      isVerified: true,
      store: { storeId: crypto.randomUUID(), menuCategory: "Dairy" },
    });
    expect(parsed).not.toHaveProperty("isVerified");
    expect(parsed).not.toHaveProperty("store");
  });
});

describe("adminCreateFoodSchema", () => {
  it("verifies by default, because that is the point of the route", () => {
    expect(adminCreateFoodSchema.parse(base).isVerified).toBe(true);
  });

  it("still allows an admin to add something unverified", () => {
    expect(adminCreateFoodSchema.parse({ ...base, isVerified: false }).isVerified).toBe(false);
  });

  it("places on a menu unless told otherwise", () => {
    const parsed = adminCreateFoodSchema.parse({
      ...base,
      store: { storeId: crypto.randomUUID(), menuCategory: "Dairy" },
    });
    expect(parsed.store?.placement).toBe("menu");
  });

  it("accepts a builder placement with its own group", () => {
    const parsed = adminCreateFoodSchema.parse({
      ...base,
      store: {
        storeId: crypto.randomUUID(),
        menuCategory: "Extras",
        placement: "builder",
        ingredientGroup: "Extras",
      },
    });
    expect(parsed.store?.placement).toBe("builder");
    expect(parsed.store?.ingredientGroup).toBe("Extras");
  });

  it("rejects a store reference that is not an id", () => {
    const bad = adminCreateFoodSchema.safeParse({
      ...base,
      store: { storeId: "marianos", menuCategory: "Dairy" },
    });
    expect(bad.success).toBe(false);
  });

  it("requires a category, so nothing lands in an unnamed section", () => {
    const bad = adminCreateFoodSchema.safeParse({
      ...base,
      store: { storeId: crypto.randomUUID(), menuCategory: "" },
    });
    expect(bad.success).toBe(false);
  });

  it("leaves the food itself alone — no store means no placement", () => {
    expect(adminCreateFoodSchema.parse(base).store).toBeUndefined();
  });
});
