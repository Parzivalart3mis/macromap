/**
 * Adds MyProtein Impact Whey Isolate (Chocolate Brownie) from the official
 * label: one verified food, listed on the menu (Protein) and in the shake
 * builder (Powder).
 *
 * Run: pnpm tsx scripts/add-myprotein-isolate.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, ilike } from "drizzle-orm";

import * as schema from "../src/lib/db/schema";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const db = drizzle(neon(url), { schema });

async function main() {
  const [store] = await db
    .select()
    .from(schema.stores)
    .where(eq(schema.stores.slug, "myprotein"))
    .limit(1);
  if (!store) {
    console.error("MyProtein store not found — run pnpm db:seed first");
    process.exit(1);
  }

  const name = "Impact Whey Isolate, Chocolate Brownie (1 scoop)";
  const [existing] = await db
    .select({ id: schema.foods.id })
    .from(schema.foods)
    .where(and(ilike(schema.foods.name, name), eq(schema.foods.brandName, "MyProtein")))
    .limit(1);
  if (existing) {
    console.log("Already exists — nothing to do");
    return;
  }

  const [food] = await db
    .insert(schema.foods)
    .values({
      name,
      brandName: "MyProtein",
      sourceType: "official_store",
      servingSizeValue: 29,
      servingSizeUnit: "g (1 scoop)",
      calories: 110,
      proteinG: 25,
      carbsG: 1,
      fatG: 0,
      fiberG: 0,
      sugarG: 0,
      satFatG: 0,
      sodiumMg: 40,
      cholesterolMg: 2,
      potassiumMg: 160,
      isVerified: true,
    })
    .returning({ id: schema.foods.id });

  const categoryItems = await db
    .select({ displayOrder: schema.storeMenuItems.displayOrder })
    .from(schema.storeMenuItems)
    .where(
      and(
        eq(schema.storeMenuItems.storeId, store.id),
        eq(schema.storeMenuItems.menuCategory, "Protein"),
      ),
    );
  const nextOrder = Math.max(0, ...categoryItems.map((row) => row.displayOrder)) + 1;

  await db.insert(schema.storeMenuItems).values({
    storeId: store.id,
    foodId: food.id,
    isDefaultVerified: true,
    menuCategory: "Protein",
    displayOrder: nextOrder,
  });

  await db.insert(schema.storeIngredients).values({
    storeId: store.id,
    foodId: food.id,
    ingredientGroup: "Powder",
    isDefaultSelected: false,
  });

  console.log(`Added ${name} (food ${food.id}) to menu + builder`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
