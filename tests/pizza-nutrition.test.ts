import { describe, expect, it } from "vitest";

import { assemblePizzaSnapshot, type ComponentLookup } from "@/lib/stores/pizza-nutrition";
import type { NutritionSnapshot } from "@/types/nutrition";

const n = (calories: number, proteinG = 0, carbsG = 0, fatG = 0): NutritionSnapshot => ({
  calories,
  proteinG,
  carbsG,
  fatG,
});

// Stand-ins keyed to a Medium 12" Hand Tossed per-slice table.
const crust = n(110, 4, 21, 1.5);
const lookup: ComponentLookup = (group, name, variant) => {
  if (group === "sauce" && name === "Pizza Sauce") return n(10, 0, 2, 0);
  if (group === "cheese" && name === "Regular Cheese" && variant === "only") return n(70, 4, 1, 5);
  if (group === "cheese" && name === "Regular Cheese" && variant === "with_toppings")
    return n(50, 3, 1, 3.5);
  if (group === "topping" && name === "Pepperoni") return n(30, 1, 0, 2.5);
  if (group === "extra" && name === "Garlic Oil Blend") return n(10, 0, 0, 1);
  return undefined;
};

describe("assemblePizzaSnapshot", () => {
  it("cheese pizza = crust + sauce + cheese-only, scaled to the whole pizza (×8)", () => {
    const whole = assemblePizzaSnapshot(
      crust,
      8,
      { sauce: "Pizza Sauce", cheeseLevel: "Regular", toppings: [], garlicOil: false },
      lookup,
    );
    expect(whole.calories).toBe((110 + 10 + 70) * 8); // 1520
    expect(whole.proteinG).toBe((4 + 0 + 4) * 8); // 64
  });

  it("switches to the with-toppings cheese amount once a topping is added", () => {
    const whole = assemblePizzaSnapshot(
      crust,
      8,
      {
        sauce: "Pizza Sauce",
        cheeseLevel: "Regular",
        toppings: [{ name: "Pepperoni", qty: 1 }],
        garlicOil: false,
      },
      lookup,
    );
    // per slice: 110 + 10 + 50 (with_toppings) + 30 = 200 → ×8
    expect(whole.calories).toBe(200 * 8);
  });

  it("doubles a topping at qty 2", () => {
    const base = { sauce: null, cheeseLevel: "None" as const, garlicOil: false };
    const single = assemblePizzaSnapshot(
      crust,
      1,
      { ...base, toppings: [{ name: "Pepperoni", qty: 1 }] },
      lookup,
    );
    const double = assemblePizzaSnapshot(
      crust,
      1,
      { ...base, toppings: [{ name: "Pepperoni", qty: 2 }] },
      lookup,
    );
    expect(double.calories - single.calories).toBe(30);
  });

  it("omits cheese at level None and adds the garlic-oil brush when selected", () => {
    const plain = assemblePizzaSnapshot(
      crust,
      1,
      { sauce: null, cheeseLevel: "None", toppings: [], garlicOil: false },
      lookup,
    );
    expect(plain.calories).toBe(110); // crust only

    const brushed = assemblePizzaSnapshot(
      crust,
      1,
      { sauce: null, cheeseLevel: "None", toppings: [], garlicOil: true },
      lookup,
    );
    expect(brushed.calories).toBe(120); // crust + garlic oil
  });
});
