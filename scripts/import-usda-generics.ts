/**
 * Imports USDA's curated generic foods into the shared database:
 *  - FNDDS ("Survey") — ~7k everyday foods ("Rice, white, cooked") with
 *    full nutrient panels; this is the corpus MyFitnessPal-style generic
 *    entries are built from.
 *  - Foundation Foods — several hundred high-quality staples.
 *
 * Values are per 100 g. Entries are marked verified with no brand.
 * Idempotent: skips names that already exist as USDA generics.
 *
 * Run: pnpm tsx scripts/import-usda-generics.ts   (needs BARCODE_API_KEY)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { and, eq, isNull } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "../src/lib/db/schema";

const url = process.env.DATABASE_URL;
const apiKey = process.env.BARCODE_API_KEY;
if (!url || !apiKey) {
  console.error("DATABASE_URL and BARCODE_API_KEY must be set");
  process.exit(1);
}
const db = drizzle(neon(url), { schema });

interface ListFood {
  fdcId: number;
  description?: string;
  foodNutrients?: Array<{
    number?: string;
    name?: string;
    amount?: number;
    unitName?: string;
  }>;
}

function nutrient(food: ListFood, ...numbers: string[]): number | undefined {
  for (const number of numbers) {
    const hit = food.foodNutrients?.find((n) => n.number === number && n.amount != null);
    if (hit) return hit.amount;
  }
  return undefined;
}

async function fetchPage(dataType: string, page: number): Promise<ListFood[]> {
  const params = new URLSearchParams({
    api_key: apiKey!,
    dataType,
    pageSize: "200",
    pageNumber: String(page),
  });
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/list?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 429) {
    console.log("Rate limited, waiting 60s...");
    await new Promise((resolve) => setTimeout(resolve, 60_000));
    return fetchPage(dataType, page);
  }
  if (!res.ok) throw new Error(`FDC list ${dataType} page ${page}: HTTP ${res.status}`);
  return (await res.json()) as ListFood[];
}

async function main() {
  // Names of existing brandless USDA generics, for idempotency.
  const existingRows = await db
    .select({ name: schema.foods.name })
    .from(schema.foods)
    .where(and(eq(schema.foods.sourceType, "barcode_api"), isNull(schema.foods.brandName)));
  const existing = new Set(existingRows.map((row) => row.name.toLowerCase()));
  console.log(`${existing.size} USDA generics already present`);

  let imported = 0;
  let skipped = 0;

  for (const dataType of ["Survey (FNDDS)", "Foundation"]) {
    for (let page = 1; ; page++) {
      const foods = await fetchPage(dataType, page);
      if (foods.length === 0) break;

      const values = [];
      for (const food of foods) {
        const name = food.description?.trim();
        // 208 = Energy (kcal)
        const calories = nutrient(food, "208");
        if (!name || calories == null) {
          skipped++;
          continue;
        }
        if (existing.has(name.toLowerCase())) {
          skipped++;
          continue;
        }
        existing.add(name.toLowerCase());

        values.push({
          name,
          brandName: null,
          sourceType: "barcode_api" as const,
          servingSizeValue: 100,
          servingSizeUnit: "g",
          calories,
          proteinG: nutrient(food, "203") ?? 0,
          carbsG: nutrient(food, "205") ?? 0,
          fatG: nutrient(food, "204") ?? 0,
          fiberG: nutrient(food, "291") ?? null,
          sugarG: nutrient(food, "269") ?? null,
          satFatG: nutrient(food, "606") ?? null,
          sodiumMg: nutrient(food, "307") ?? null,
          cholesterolMg: nutrient(food, "601") ?? null,
          potassiumMg: nutrient(food, "306") ?? null,
          transFatG: nutrient(food, "605") ?? null,
          polyUnsatFatG: nutrient(food, "646") ?? null,
          monoUnsatFatG: nutrient(food, "645") ?? null,
          isVerified: true,
        });
      }

      if (values.length > 0) {
        await db.insert(schema.foods).values(values);
        imported += values.length;
      }
      console.log(`${dataType} page ${page}: +${values.length} (total ${imported})`);
      if (foods.length < 200) break;
    }
  }

  console.log(`Done: ${imported} imported, ${skipped} skipped`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
