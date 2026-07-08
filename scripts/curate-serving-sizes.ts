/**
 * Sets natural default serving sizes (with recomputed per-serving nutrition) for
 * a curated list of common USDA generic foods that were imported at a blanket
 * 100 g. Nutrition is re-scaled; a "g" alternate serving is added to count-based
 * foods so weight logging still works. Idempotent (only touches rows still at
 * 100 g) and non-destructive (updates in place, preserving food IDs).
 *
 * Run: pnpm tsx scripts/curate-serving-sizes.ts
 */
import { config } from "dotenv"; config({ path: ".env.local" }); config();
import { and, eq, isNull } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const db = drizzle(neon(url), { schema });

// [exact USDA name, display unit, grams per serving]
const STAPLES: [string, string, number][] = [
  ["Almonds, NFS", "almond", 1.2],
  ["Cashews, NFS", "cashew", 1.6],
  ["Egg, whole, raw", "egg", 50],
  ["Banana, raw", "banana", 118],
  ["Apple, raw", "apple", 182],
  ["Orange, raw", "orange", 131],
  ["Avocado, raw", "avocado", 150],
  ["Carrots, raw", "carrot", 61],
  ["Bread, white", "slice", 28],
  ["Bread, whole wheat", "slice", 28],
  ["Cheese, Cheddar", "slice", 28],
  ["Milk, whole", "cup", 244],
  ["Milk, reduced fat (2%)", "cup", 244],
  ["Rice, white, cooked, no added fat", "cup", 158],
  ["Blueberries, raw", "cup", 148],
  ["Strawberries, raw", "cup", 144],
  ["Broccoli, raw", "cup", 91],
  ["Yogurt, Greek, plain, nonfat", "cup", 245],
  ["Peanut butter", "tbsp", 16],
  ["Honey", "tbsp", 21],
  ["Olive oil", "tbsp", 14],
  ["Butter, NFS", "tbsp", 14],
];

const WEIGHT_VOLUME = new Set(["cup", "tbsp", "tsp", "oz", "ml", "g", "fl oz"]);
const NUM_COLS = [
  "calories","proteinG","carbsG","fatG","fiberG","sugarG","satFatG","sodiumMg",
  "cholesterolMg","potassiumMg","transFatG","polyUnsatFatG","monoUnsatFatG",
  "addedSugarsG","sugarAlcoholsG","vitaminAPct","vitaminCPct","calciumPct",
  "ironPct","vitaminDPct",
] as const;

async function main() {
  let updated = 0;
  const missing: string[] = [];
  for (const [name, unit, grams] of STAPLES) {
    const [food] = await db
      .select()
      .from(schema.foods)
      .where(
        and(
          eq(schema.foods.name, name),
          isNull(schema.foods.brandName),
          eq(schema.foods.servingSizeValue, 100),
          eq(schema.foods.servingSizeUnit, "g"),
        ),
      )
      .limit(1);
    if (!food) { missing.push(name); continue; }

    const factor = grams / 100;
    const row = food as unknown as Record<string, number | null>;
    const set: Record<string, unknown> = {
      servingSizeValue: 1,
      servingSizeUnit: unit,
      alternateServings: WEIGHT_VOLUME.has(unit)
        ? []
        : [{ unit: "g", multiplier: Math.round((1 / grams) * 10000) / 10000 }],
      updatedAt: new Date(),
    };
    for (const col of NUM_COLS) {
      const v = row[col];
      set[col] = v == null ? null : Math.round(v * factor * 100) / 100;
    }
    await db.update(schema.foods).set(set).where(eq(schema.foods.id, food.id));
    updated++;
  }
  console.log(`Curated ${updated}/${STAPLES.length} staples. Missing/already-done: ${missing.join(" | ") || "none"}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
