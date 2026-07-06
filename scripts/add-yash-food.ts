/**
 * Add a custom food item for user Yash
 * Run: pnpm tsx scripts/add-yash-food.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

import * as schema from "../src/lib/db/schema";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const db = drizzle(neon(url), { schema });

async function main() {
  // Find user Yash
  const users = await db
    .select()
    .from(schema.users)
    .where(sql`${schema.users.displayName} ILIKE '%Yash%'`)
    .limit(1);

  if (users.length === 0) {
    console.error("User 'Yash' not found in database");
    process.exit(1);
  }

  const userId = users[0].id;
  console.log(`Found user: ${users[0].displayName} (${userId})`);

  // Insert the food item
  const [food] = await db
    .insert(schema.foods)
    .values({
      name: "Burrito with Tofu, Cheese and Fat-Free Cheese",
      description: "Signature (Jewel Osco) 9\" tortilla, 46g pinto beans, 28g fat-free cheese, 14g cheese, 45g tofu, 1/5 tsp oil",
      sourceType: "user_created",
      createdByUserId: userId,
      servingSizeValue: 1,
      servingSizeUnit: "burrito",
      calories: 545,
      proteinG: 33.5,
      carbsG: 66.3,
      fatG: 15.4,
      fiberG: 12.1,
      sugarG: 3.0,
      satFatG: 4.7,
      sodiumMg: 1355,
      cholesterolMg: 20,
      potassiumMg: 650,
      transFatG: 0,
      polyUnsatFatG: 2.5,
      monoUnsatFatG: 4.0,
      addedSugarsG: 0,
      sugarAlcoholsG: 0,
      vitaminAPct: 4,
      vitaminCPct: 3,
      calciumPct: 50,
      ironPct: 31,
      vitaminDPct: 0,
      isVerified: false,
    })
    .returning();

  console.log(`Food item added successfully with ID: ${food.id}`);
  console.log(`Name: ${food.name}`);
  console.log(`Calories: ${food.calories}`);
  console.log(`Protein: ${food.proteinG}g`);
  console.log(`Carbs: ${food.carbsG}g`);
  console.log(`Fat: ${food.fatG}g`);

  // Insert the second food item (Frankie)
  const [food2] = await db
    .insert(schema.foods)
    .values({
      name: "Frankie",
      description: "Paratha, 1/2 potato, 1 american cheese slice, sauce mix",
      sourceType: "user_created",
      createdByUserId: userId,
      servingSizeValue: 1,
      servingSizeUnit: "frankie",
      calories: 420,
      proteinG: 12,
      carbsG: 55,
      fatG: 16.5,
      fiberG: 6,
      sugarG: 6,
      satFatG: 5.2,
      sodiumMg: 780,
      cholesterolMg: 15,
      potassiumMg: 520,
      transFatG: 0,
      polyUnsatFatG: 3.0,
      monoUnsatFatG: 6.5,
      addedSugarsG: 3,
      sugarAlcoholsG: 0,
      vitaminAPct: 4,
      vitaminCPct: 20,
      calciumPct: 12,
      ironPct: 12,
      vitaminDPct: 0,
      isVerified: false,
    })
    .returning();

  console.log(`\nSecond food item added successfully with ID: ${food2.id}`);
  console.log(`Name: ${food2.name}`);
  console.log(`Calories: ${food2.calories}`);
  console.log(`Protein: ${food2.proteinG}g`);
  console.log(`Carbs: ${food2.carbsG}g`);
  console.log(`Fat: ${food2.fatG}g`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
