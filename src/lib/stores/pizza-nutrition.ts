import { and, eq } from "drizzle-orm";

import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { pizzaComponents, pizzaConfigs } from "@/lib/db/schema";
import { roundNutrition, scaleNutrition, sumNutrition } from "@/lib/nutrition";
import type { BuildPizzaOrderInput } from "@/lib/validations/stores";
import type { NutritionSnapshot } from "@/types/nutrition";

/** The per-slice nutrient columns shared by pizza configs and components. */
interface PizzaNutriRow {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  satFatG: number;
  transFatG: number;
  sodiumMg: number;
  cholesterolMg: number;
  addedSugarsG: number;
}

/** Map a config/component row to a NutritionSnapshot (micros not on the guide). */
export function pizzaRowToNutrition(r: PizzaNutriRow): NutritionSnapshot {
  return {
    calories: r.calories,
    proteinG: r.proteinG,
    carbsG: r.carbsG,
    fatG: r.fatG,
    fiberG: r.fiberG,
    sugarG: r.sugarG,
    satFatG: r.satFatG,
    transFatG: r.transFatG,
    sodiumMg: r.sodiumMg,
    cholesterolMg: r.cholesterolMg,
    addedSugarsG: r.addedSugarsG,
  };
}

/** A per-slice component lookup: (group, name, variant?) → nutrition or undefined. */
export type ComponentLookup = (
  group: string,
  name: string,
  variant?: string,
) => NutritionSnapshot | undefined;

type PizzaSelections = Pick<
  BuildPizzaOrderInput,
  "sauce" | "cheeseLevel" | "toppings" | "garlicOil"
>;

/**
 * Pure whole-pizza assembly: crust base + garlic oil + sauce + cheese + toppings,
 * per slice, then scaled to the whole pizza. Cheese uses the "with_toppings"
 * amount when any topping is present, else "only". Kept DB-free so the slice/
 * whole math is unit-testable.
 */
export function assemblePizzaSnapshot(
  crust: NutritionSnapshot,
  slicesPerPizza: number,
  selections: PizzaSelections,
  lookup: ComponentLookup,
): NutritionSnapshot {
  const perSlice: NutritionSnapshot[] = [crust];
  if (selections.garlicOil) {
    const g = lookup("extra", "Garlic Oil Blend");
    if (g) perSlice.push(g);
  }
  if (selections.sauce) {
    const s = lookup("sauce", selections.sauce);
    if (s) perSlice.push(s);
  }
  if (selections.cheeseLevel !== "None") {
    const variant = selections.toppings.length > 0 ? "with_toppings" : "only";
    const ch = lookup("cheese", `${selections.cheeseLevel} Cheese`, variant);
    if (ch) perSlice.push(ch);
  }
  for (const t of selections.toppings) {
    const tc = lookup("topping", t.name);
    if (tc) perSlice.push(scaleNutrition(tc, t.qty));
  }
  return roundNutrition(scaleNutrition(sumNutrition(perSlice), slicesPerPizza));
}

/**
 * Sum a built pizza's WHOLE-PIZZA nutrition server-side (authoritative). The
 * store scope is enforced so a snapshot can't be forged from another store's
 * config.
 */
export async function computePizzaSnapshot(
  storeId: string,
  input: BuildPizzaOrderInput,
): Promise<{ snapshot: NutritionSnapshot; slicesPerPizza: number }> {
  const [config] = await db
    .select()
    .from(pizzaConfigs)
    .where(and(eq(pizzaConfigs.id, input.configId), eq(pizzaConfigs.storeId, storeId)))
    .limit(1);
  if (!config) {
    throw new ApiError("invalid_request", "Pizza configuration not found for this store", 400);
  }
  const comps = await db
    .select()
    .from(pizzaComponents)
    .where(eq(pizzaComponents.configId, config.id));

  const lookup: ComponentLookup = (group, name, variant) => {
    const row = comps.find(
      (c) =>
        c.componentGroup === group &&
        c.name === name &&
        (variant === undefined || c.variant === variant),
    );
    return row ? pizzaRowToNutrition(row) : undefined;
  };

  const snapshot = assemblePizzaSnapshot(
    pizzaRowToNutrition(config),
    config.slicesPerPizza,
    input,
    lookup,
  );
  return { snapshot, slicesPerPizza: config.slicesPerPizza };
}
