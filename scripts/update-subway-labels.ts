/**
 * Backfills the newly added label fields (trans fat, added sugars, and
 * Vitamin A / Vitamin C / Calcium / Iron as % DV) for every Subway item,
 * transcribed from the official U.S. Nutrition Information PDF (Jan 2026).
 * Also completes the MyProtein Impact Whey Isolate micronutrients.
 *
 * Run: pnpm tsx scripts/update-subway-labels.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq } from "drizzle-orm";

import * as schema from "../src/lib/db/schema";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const db = drizzle(neon(url), { schema });

// name -> [trans fat g, added sugars g, vit A %DV, vit C %DV, calcium %DV, iron %DV]
type Patch = [number, number, number, number, number, number];

const SUBWAY: Record<string, Patch> = {
  // --- 6" Sandwiches ---
  '6" Steak Philly': [1, 3, 10, 6, 90, 100],
  '6" Chipotle Philly': [1, 4, 2, 6, 100, 100],
  '6" Cheesy Garlic Steak': [0, 4, 2, 30, 90, 100],
  '6" Grilled Chicken': [1, 3, 25, 10, 100, 90],
  '6" Chicken & Bacon Ranch': [0, 4, 25, 8, 100, 100],
  '6" Spicy Nacho Chicken': [0, 3, 6, 35, 90, 90],
  '6" Honey Mustard BBQ Chicken': [0, 11, 25, 8, 100, 100],
  '6" Sweet Onion Teriyaki Chicken': [0, 16, 20, 10, 10, 15],
  '6" B.M.T.': [1, 3, 20, 15, 100, 100],
  '6" Spicy Italian': [1, 3, 20, 25, 100, 100],
  '6" 5 Meat Italian': [1, 4, 20, 15, 100, 100],
  '6" Meatball Marinara': [0, 4, 20, 15, 110, 100],
  '6" Meatball Pepperoni': [1, 5, 20, 20, 110, 100],
  '6" Oven-Roasted Turkey': [1, 3, 20, 6, 100, 100],
  '6" Black Forest Ham': [0, 4, 20, 6, 100, 90],
  '6" Roast Beef': [0, 4, 20, 6, 100, 90],
  '6" Cold Cut Combo': [1, 3, 20, 6, 100, 100],
  '6" Tuna': [1, 3, 20, 6, 100, 90],
  '6" Veggie Delite': [0, 4, 35, 15, 20, 15],
  '6" All American Club': [1, 4, 20, 8, 90, 100],
  '6" Subway Club': [1, 5, 20, 6, 10, 25],
  '6" Big Hot Pastrami': [0, 2, 15, 0, 90, 110],
  '6" B.L.T.': [0, 4, 15, 6, 80, 90],
  '6" Buffalo Chicken': [0, 3, 35, 15, 25, 35],
  '6" Oven-Roasted Turkey & Ham': [1, 4, 20, 6, 20, 20],
  '6" Pizza Sub': [1, 3, 15, 20, 100, 100],
  '6" Veggie Patty': [0, 4, 35, 10, 10, 15],
  '6" Grilled Chicken & Smashed Avocado': [0, 4, 30, 15, 4, 20],
  '6" Grilled Chicken & Fresh Avocado': [0, 4, 30, 15, 4, 20],
  '6" Ham & Turkey Stacker': [0, 4, 30, 10, 4, 20],
  '6" Turkey & Ranch Delite': [1, 5, 30, 10, 4, 30],
  '6" Seasoned Steak & Smashed Avocado': [0, 5, 30, 10, 4, 25],
  '6" Seasoned Steak & Fresh Avocado': [0, 5, 30, 10, 4, 25],
  "Kids' Mini Sub Veggie Delite": [0, 2, 20, 10, 2, 10],
  "Kids' Mini Sub Black Forest Ham": [0, 3, 20, 10, 2, 10],
  "Kids' Mini Sub Oven Roasted Turkey": [0, 3, 20, 10, 2, 15],
  // --- Wraps ---
  "Steak Philly Wrap": [1, 3, 10, 6, 15, 30],
  "Chipotle Philly Wrap": [1, 3, 0, 6, 20, 30],
  "Cheesy Garlic Steak Wrap": [0, 3, 2, 30, 8, 30],
  "Grilled Chicken Wrap": [1, 1, 25, 15, 25, 20],
  "Chicken & Bacon Ranch Wrap": [1, 4, 25, 8, 20, 25],
  "Spicy Nacho Chicken Wrap": [0, 3, 6, 35, 6, 25],
  "Honey Mustard BBQ Chicken Wrap": [0, 11, 25, 8, 20, 25],
  "Sweet Onion Teriyaki Chicken Wrap": [0, 22, 20, 15, 15, 25],
  "B.M.T. Wrap": [1, 3, 20, 15, 100, 100],
  "Spicy Italian Wrap": [1, 3, 20, 35, 25, 30],
  "5 Meat Italian Wrap": [2, 6, 20, 25, 25, 40],
  "Meatball Marinara Wrap": [0, 7, 30, 25, 30, 30],
  "Meatball Pepperoni Wrap": [1, 7, 30, 35, 30, 35],
  "Oven-Roasted Turkey Wrap": [1, 3, 20, 6, 20, 40],
  "Black Forest Ham Wrap": [0, 5, 20, 6, 20, 25],
  "Roast Beef Wrap": [1, 6, 20, 8, 20, 25],
  "Cold Cut Combo Wrap": [1, 3, 20, 6, 30, 30],
  "Tuna Wrap": [1, 3, 20, 6, 20, 25],
  "Veggie Delite Wrap": [0, 2, 35, 15, 20, 20],
  "All American Club Wrap": [1, 5, 20, 8, 15, 35],
  "Subway Club Wrap": [1, 6, 20, 6, 15, 40],
  "Big Hot Pastrami Wrap": [0, 2, 20, 0, 15, 50],
  "B.L.T. Wrap": [0, 5, 15, 8, 6, 25],
  "Turkey & Ham Wrap": [1, 4, 20, 6, 20, 30],
  "Pizza Sub Wrap": [1, 3, 15, 30, 25, 25],
  "Veggie Patty Wrap": [1, 2, 35, 10, 10, 20],
  // --- Protein Pockets ---
  "Baja Chicken Protein Pocket": [0, 0, 15, 8, 15, 15],
  "Italian Trio Protein Pocket": [1, 1, 10, 20, 15, 15],
  "Peppercorn Ranch Chicken Protein Pocket": [0, 0, 15, 8, 15, 15],
  "Turkey & Ham Protein Pocket": [0, 3, 10, 4, 15, 20],
  // --- Salads ---
  "Steak Philly Salad": [1, 1, 80, 35, 15, 15],
  "Chipotle Philly Salad": [1, 2, 70, 35, 15, 15],
  "Cheesy Garlic Steak Salad": [0, 2, 70, 80, 8, 15],
  "Grilled Chicken Salad": [1, 0, 80, 40, 20, 10],
  "Chicken & Bacon Ranch Salad": [1, 2, 80, 35, 20, 15],
  "Spicy Nacho Chicken Salad": [0, 0, 80, 70, 6, 10],
  "Honey Mustard BBQ Chicken Salad": [0, 17, 80, 35, 20, 15],
  "Sweet Onion Teriyaki Chicken Salad": [0, 19, 80, 40, 15, 15],
  "B.M.T. Salad": [1, 1, 80, 45, 25, 15],
  "Spicy Italian Salad": [1, 0, 80, 50, 25, 15],
  "5 Meat Italian Salad": [1, 2, 80, 45, 25, 20],
  "Meatball Marinara Salad with MVP Parmesan Vinaigrette": [1, 4, 90, 50, 30, 20],
  "Meatball Pepperoni Salad with MVP Parmesan Vinaigrette": [1, 4, 90, 50, 30, 20],
  "Oven-Roasted Turkey Salad": [1, 1, 80, 35, 20, 20],
  "Black Forest Ham Salad": [1, 1, 80, 35, 20, 10],
  "Roast Beef Salad": [1, 2, 80, 35, 20, 10],
  "Cold Cut Combo Salad": [1, 0, 80, 35, 25, 15],
  "Tuna Salad": [1, 0, 80, 35, 20, 10],
  "Veggie Delite Salad": [0, 0, 80, 35, 20, 10],
  "All American Club Salad": [1, 2, 80, 35, 15, 15],
  "Subway Club Salad": [1, 2, 80, 35, 15, 20],
  "Big Hot Pastrami Salad": [0, 0, 80, 35, 15, 25],
  "B.L.T. Salad": [0, 1, 70, 35, 6, 10],
  "Turkey & Ham Salad": [1, 1, 80, 35, 20, 15],
  "Pizza Sub Salad": [1, 1, 80, 50, 25, 15],
  "Veggie Patty Salad": [0, 0, 80, 35, 15, 10],
  // --- Protein Bowls ---
  "Steak Philly Protein Bowl": [1, 2, 80, 30, 20, 20],
  "Chipotle Philly Protein Bowl": [1, 3, 60, 30, 25, 20],
  "Cheesy Garlic Steak Protein Bowl": [1, 3, 60, 80, 8, 20],
  "Grilled Chicken Protein Bowl": [1, 0, 80, 40, 35, 10],
  "Chicken & Bacon Ranch Protein Bowl": [1, 2, 80, 30, 35, 15],
  "Spicy Nacho Chicken Protein Bowl": [0, 1, 70, 90, 8, 15],
  "Honey Mustard BBQ Chicken Protein Bowl": [1, 17, 80, 30, 35, 15],
  "Sweet Onion Teriyaki Chicken Protein Bowl": [1, 26, 80, 40, 20, 15],
  "B.M.T. Protein Bowl": [2, 2, 70, 50, 40, 15],
  "Spicy Italian Protein Bowl": [2, 1, 80, 60, 40, 20],
  "5 Meat Italian Protein Bowl": [2, 4, 80, 50, 40, 30],
  "Meatball Marinara Protein Bowl with MVP Parmesan Vinaigrette": [1, 6, 90, 60, 50, 25],
  "Meatball Pepperoni Protein Bowl with MVP Parmesan Vinaigrette": [1, 6, 90, 70, 50, 25],
  "Oven-Roasted Turkey Protein Bowl": [2, 1, 70, 30, 35, 25],
  "Black Forest Ham Protein Bowl": [1, 3, 80, 30, 35, 15],
  "Roast Beef Protein Bowl": [1, 3, 80, 30, 35, 15],
  "Cold Cut Combo Protein Bowl": [1, 1, 70, 30, 45, 15],
  "Tuna Protein Bowl": [1, 0, 80, 30, 35, 15],
  "All American Club Protein Bowl": [1, 3, 80, 30, 20, 20],
  "Subway Club Protein Bowl": [1, 3, 70, 30, 20, 25],
  "Big Hot Pastrami Protein Bowl": [1, 0, 80, 30, 25, 40],
  "B.L.T. Protein Bowl": [0, 3, 60, 35, 6, 15],
  "Turkey & Ham Protein Bowl": [1, 2, 70, 30, 35, 20],
  "Pizza Sub Protein Bowl": [1, 2, 80, 60, 40, 15],
  "Veggie Patty Protein Bowl": [1, 0, 70, 30, 20, 6],
  // --- Breakfast ---
  '6" Bacon, Egg & Cheese': [0, 3, 10, 0, 100, 100],
  '6" Black Forest Ham, Egg & Cheese': [0, 3, 10, 0, 90, 100],
  '6" Egg & Cheese': [0, 2, 10, 0, 90, 100],
  '6" Steak, Egg & Cheese': [0, 3, 10, 0, 90, 100],
  "Bacon, Egg & Cheese Wrap": [1, 2, 15, 0, 20, 30],
  "Black Forest Ham, Egg & Cheese Wrap": [1, 2, 15, 0, 20, 30],
  "Egg & Cheese Wrap": [1, 1, 15, 0, 20, 30],
  "Steak, Egg & Cheese Wrap": [1, 2, 15, 0, 20, 35],
  // --- Pizza & Sliders ---
  '8" Cheese Pizza': [1, 3, 30, 8, 40, 35],
  '8" Bacon Pizza': [1, 3, 30, 10, 40, 35],
  '8" Meatball Pizza': [1, 3, 30, 8, 40, 35],
  '8" Pepperoni Pizza': [1, 3, 30, 15, 40, 35],
  "Ham & Jack Slider": [0, 2, 0, 0, 45, 45],
  "Italian Spice Slider": [0, 2, 2, 6, 45, 45],
  "Little Cheesesteak Slider": [0, 2, 2, 4, 45, 45],
  "Turkey Slider": [0, 0, 6, 0, 50, 50],
  // --- Cookies & Sides ---
  "Chocolate Chip Cookie": [0, 18, 0, 0, 0, 10],
  "Double Chocolate Cookie": [0, 19, 0, 0, 2, 10],
  "Oatmeal Raisin Cookie": [0, 10, 0, 0, 2, 6],
  "Raspberry Cheesecake Cookie": [0, 15, 0, 0, 2, 6],
  "White Chip Macadamia Nut Cookie": [0, 17, 0, 0, 2, 6],
  Applesauce: [0, 0, 0, 0, 0, 2],
  "Hash Browns": [0, 0, 0, 0, 2, 60],
  "Footlong Chocolate Chip Cookie": [1, 100, 0, 0, 4, 50],
  // --- Soups ---
  "Broccoli Cheddar Soup (8 oz)": [0, 0, 20, 15, 20, 2],
  "Chicken Noodle Soup (8 oz)": [0, 0, 15, 2, 2, 0],
  "Loaded Baked Potato with Bacon Soup (8 oz)": [0, 0, 10, 15, 10, 2],
  // --- Ingredients: Bread ---
  '6" Artisan Italian Bread': [0, 2, 0, 0, 80, 90],
  '6" Hearty Multigrain Bread': [0, 4, 0, 0, 2, 10],
  '6" Jalapeño Cheddar Bread': [0, 2, 4, 2, 90, 90],
  '6" Artisan Flatbread': [0, 2, 0, 0, 0, 15],
  '12" Wrap': [0, 1, 0, 0, 6, 15],
  '9" Wrap (Pocket)': [0, 0, 0, 0, 6, 10],
  "Mini Artisan Italian Bread": [0, 2, 0, 0, 60, 60],
  "Mini Hearty Multigrain Bread": [0, 2, 0, 0, 0, 8],
  // --- Ingredients: Protein ---
  "All-American Club Meats (Ham, Turkey, Bacon)": [0, 1, 0, 0, 0, 8],
  "Bacon (2 strips)": [0, 1, 0, 0, 0, 2],
  "Black Forest Ham": [0, 1, 0, 0, 0, 2],
  "Cold Cut Combo Meats": [0, 0, 0, 0, 4, 4],
  "Egg Patty": [0, 0, 4, 0, 2, 6],
  "Genoa Salami (3 slices)": [0, 0, 0, 4, 0, 2],
  "Grilled Chicken": [0, 0, 2, 4, 0, 2],
  "Grilled Chicken, Sweet Onion Teriyaki Glazed": [0, 7, 0, 4, 0, 2],
  Meatballs: [0, 2, 10, 15, 4, 8],
  "Oven-Roasted Turkey": [0, 0, 0, 0, 0, 10],
  Pastrami: [0, 0, 2, 0, 0, 8],
  "Pepperoni (3 slices)": [0, 0, 0, 4, 0, 2],
  "Roast Beef": [0, 2, 0, 0, 0, 2],
  "Rotisserie-Style Chicken": [0, 0, 0, 0, 0, 2],
  "Steak (no cheese)": [0, 1, 0, 0, 0, 6],
  "Subway Club Meats (Turkey, Ham, Roast Beef)": [0, 2, 0, 0, 0, 10],
  Tuna: [0, 0, 0, 0, 0, 2],
  "Veggie Patty": [0, 0, 0, 0, 0, 0],
  // --- Ingredients: Cheese ---
  "American Cheese": [0, 0, 8, 0, 8, 0],
  "Monterey Cheddar, Shredded": [0, 0, 10, 0, 15, 0],
  "Parmesan, Grated": [0, 0, 0, 0, 2, 0],
  "Pepper Jack Cheese": [0, 0, 0, 0, 10, 0],
  Provolone: [0, 0, 8, 0, 15, 0],
  // --- Ingredients: Veggies ---
  "Avocado, Sliced": [0, 0, 2, 4, 0, 0],
  "Avocado, Smashed": [0, 0, 0, 0, 0, 0],
  "Banana Peppers (3 rings)": [0, 0, 0, 6, 0, 0],
  "Cucumbers (3 slices)": [0, 0, 0, 0, 0, 0],
  "Green Chiles": [0, 0, 0, 0, 0, 0],
  "Green Peppers (3 strips)": [0, 0, 0, 6, 0, 0],
  "Jalapeno Peppers (3 rings)": [0, 0, 0, 2, 0, 0],
  Lettuce: [0, 0, 2, 0, 0, 0],
  "Olives, Black (3 rings)": [0, 0, 0, 0, 0, 0],
  Onions: [0, 0, 0, 0, 0, 0],
  "Pickles, Crinkle (3 chips)": [0, 0, 0, 0, 0, 0],
  "Spinach, Baby": [0, 0, 15, 2, 0, 2],
  "Tomatoes (3 wheels)": [0, 0, 10, 6, 0, 0],
  // --- Ingredients: Sauce ---
  "Baja Chipotle": [0, 0, 0, 0, 0, 0],
  "BBQ Sauce": [0, 5, 0, 0, 0, 0],
  "Cheddar Cheese Sauce": [0, 0, 2, 25, 0, 0],
  "Creamy Sriracha": [0, 0, 4, 2, 0, 0],
  "Buffalo Sauce": [0, 0, 0, 0, 0, 0],
  Giardiniera: [0, 0, 0, 0, 0, 0],
  "Honey Mustard": [0, 3, 0, 0, 0, 0],
  "Hot Honey Sauce": [0, 8, 0, 0, 0, 0],
  Mayonnaise: [0, 0, 0, 0, 0, 0],
  "Mustard, Yellow": [0, 0, 0, 0, 0, 2],
  "Olive Oil Blend": [0, 0, 0, 0, 0, 0],
  "Olive Oil Blend & Vinegar": [0, 0, 0, 0, 0, 0],
  "MVP Parmesan Vinaigrette": [0, 1, 0, 0, 0, 0],
  "Peppercorn Ranch": [0, 0, 0, 0, 0, 0],
  "Red Wine Vinegar": [0, 0, 0, 0, 0, 0],
  "Roasted Garlic Aioli": [0, 0, 0, 0, 0, 0],
  Subkrunch: [0, 0, 0, 0, 0, 0],
  "Sweet Onion Teriyaki": [0, 6, 0, 0, 0, 0],
  // --- Ingredients: Seasonings ---
  "Black Pepper": [0, 0, 0, 0, 0, 0],
  Oregano: [0, 0, 0, 0, 0, 0],
  Salt: [0, 0, 0, 0, 0, 0],
};

async function main() {
  let updated = 0;
  const missing: string[] = [];
  for (const [name, [transFatG, addedSugarsG, vitaminAPct, vitaminCPct, calciumPct, ironPct]] of Object.entries(SUBWAY)) {
    const result = await db
      .update(schema.foods)
      .set({ transFatG, addedSugarsG, vitaminAPct, vitaminCPct, calciumPct, ironPct })
      .where(and(eq(schema.foods.name, name), eq(schema.foods.brandName, "Subway")))
      .returning({ id: schema.foods.id });
    if (result.length === 0) missing.push(name);
    else updated += result.length;
  }

  // MyProtein Impact Whey Isolate label micros (vit D 2% DV, calcium 10%, iron 2%).
  const iso = await db
    .update(schema.foods)
    .set({ transFatG: 0, addedSugarsG: 0, vitaminDPct: 2, calciumPct: 10, ironPct: 2 })
    .where(
      and(
        eq(schema.foods.name, "Impact Whey Isolate, Chocolate Brownie (1 scoop)"),
        eq(schema.foods.brandName, "MyProtein"),
      ),
    )
    .returning({ id: schema.foods.id });

  console.log(`Updated ${updated} Subway foods + ${iso.length} MyProtein food`);
  if (missing.length) console.log("Not found (check names):", missing);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
