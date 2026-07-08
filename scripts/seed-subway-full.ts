/**
 * Replaces Subway's menu and ingredient catalog with the complete official U.S.
 * Nutrition Information sheet (January 2026), parsed from us-nutrition-en.pdf
 * into subway-data.json (see parse_subway.py). Full FDA label per item
 * (incl. trans fat, added sugars, and vitamin/mineral %DV).
 *
 * Safe to run on a live DB: old Subway foods are deleted, which sets
 * diary_entries.food_id to NULL while their immutable nutrition snapshots keep
 * history intact.
 *
 * Run: pnpm tsx scripts/seed-subway-full.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray } from "drizzle-orm";

import * as schema from "../src/lib/db/schema";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const db = drizzle(neon(url), { schema });

interface Row {
  name: string;
  category?: string;
  group?: string;
  default?: boolean;
  serving: number;
  cal: number;
  fat: number;
  sat: number;
  trans: number;
  chol: number;
  sodium: number;
  carb: number;
  fiber: number;
  sugar: number;
  added: number;
  protein: number;
  vitA: number;
  vitC: number;
  ca: number;
  iron: number;
}

const dataPath = join(dirname(fileURLToPath(import.meta.url)), "subway-data.json");
const data = JSON.parse(readFileSync(dataPath, "utf8")) as {
  menu: Row[];
  ingredients: Row[];
};

/** One food row. Serving is the PDF gram weight; 0 g (spices) becomes 1 serving. */
function foodValues(r: Row) {
  const weighed = r.serving > 0;
  return {
    name: r.name,
    brandName: "Subway",
    sourceType: "official_store" as const,
    servingSizeValue: weighed ? r.serving : 1,
    servingSizeUnit: weighed ? "g" : "serving",
    calories: r.cal,
    proteinG: r.protein,
    carbsG: r.carb,
    fatG: r.fat,
    fiberG: r.fiber,
    sugarG: r.sugar,
    satFatG: r.sat,
    sodiumMg: r.sodium,
    cholesterolMg: r.chol,
    transFatG: r.trans,
    addedSugarsG: r.added,
    vitaminAPct: r.vitA,
    vitaminCPct: r.vitC,
    calciumPct: r.ca,
    ironPct: r.iron,
    isVerified: true,
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const [store] = await db
    .select()
    .from(schema.stores)
    .where(eq(schema.stores.slug, "subway"))
    .limit(1);
  if (!store) {
    console.error("Subway store not found — run pnpm db:seed first");
    process.exit(1);
  }

  // Remove the old catalog (cascades to menu/ingredient rows; diary snapshots kept).
  const oldMenu = await db
    .select({ foodId: schema.storeMenuItems.foodId })
    .from(schema.storeMenuItems)
    .where(eq(schema.storeMenuItems.storeId, store.id));
  const oldIngredients = await db
    .select({ foodId: schema.storeIngredients.foodId })
    .from(schema.storeIngredients)
    .where(eq(schema.storeIngredients.storeId, store.id));
  const oldFoodIds = [...new Set([...oldMenu, ...oldIngredients].map((r) => r.foodId))];
  for (const part of chunk(oldFoodIds, 100)) {
    if (part.length > 0) await db.delete(schema.foods).where(inArray(schema.foods.id, part));
  }
  console.log(`Removed ${oldFoodIds.length} old Subway foods`);

  // Bulk-insert all foods, then map name -> id (names are unique).
  const allRows = [...data.menu, ...data.ingredients];
  const idByName = new Map<string, string>();
  for (const part of chunk(allRows, 100)) {
    const inserted = await db
      .insert(schema.foods)
      .values(part.map(foodValues))
      .returning({ id: schema.foods.id, name: schema.foods.name });
    for (const row of inserted) idByName.set(row.name, row.id);
  }

  // Menu items, grouped by category with per-category display order.
  const menuValues: (typeof schema.storeMenuItems.$inferInsert)[] = [];
  const orderByCat = new Map<string, number>();
  for (const r of data.menu) {
    const cat = r.category!;
    const order = orderByCat.get(cat) ?? 0;
    orderByCat.set(cat, order + 1);
    menuValues.push({
      storeId: store.id,
      foodId: idByName.get(r.name)!,
      isDefaultVerified: true,
      menuCategory: cat,
      displayOrder: order,
    });
  }
  for (const part of chunk(menuValues, 100)) {
    await db.insert(schema.storeMenuItems).values(part);
  }

  // Build-your-own ingredients.
  const ingredientValues = data.ingredients.map((r) => ({
    storeId: store.id,
    foodId: idByName.get(r.name)!,
    ingredientGroup: r.group!,
    isDefaultSelected: Boolean(r.default),
  }));
  for (const part of chunk(ingredientValues, 100)) {
    await db.insert(schema.storeIngredients).values(part);
  }

  console.log(
    `Done: ${data.menu.length} menu items, ${data.ingredients.length} ingredients`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
