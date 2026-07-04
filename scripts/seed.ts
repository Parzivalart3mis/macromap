/**
 * Seeds: 11 stores (top 10 US chains + MyProtein) with brand theme tokens,
 * verified menu items, ingredient catalogs (Subway, Chipotle, MyProtein),
 * plus a demo user with goals, diary history, weight logs, and a saved
 * custom order.
 *
 * Run: pnpm db:seed  (requires DATABASE_URL; migrations must be applied)
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

type MenuSeed = [
  category: string,
  name: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  sodiumMg?: number,
];
type IngredientSeed = [
  group: string,
  name: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  defaultSelected?: boolean,
];

interface StoreSeed {
  name: string;
  slug: string;
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    surfaceTint: string;
    textOverride?: string;
  };
  menu: MenuSeed[];
  ingredients?: IngredientSeed[];
}

const STORES: StoreSeed[] = [
  {
    name: "McDonald's",
    slug: "mcdonalds",
    theme: { primary: "#DA291C", secondary: "#A81E14", accent: "#FFC72C", surfaceTint: "#FDECEA" },
    menu: [
      ["Burgers", "Big Mac", 590, 25, 46, 34, 1050],
      ["Burgers", "Quarter Pounder with Cheese", 520, 30, 41, 26, 1140],
      ["Burgers", "McDouble", 400, 22, 33, 20, 920],
      ["Chicken", "McChicken", 400, 14, 39, 21, 560],
      ["Chicken", "10 pc Chicken McNuggets", 410, 23, 25, 24, 750],
      ["Sides", "Medium French Fries", 320, 4, 43, 15, 260],
      ["Breakfast", "Egg McMuffin", 310, 17, 30, 13, 770],
    ],
  },
  {
    name: "Subway",
    slug: "subway",
    theme: { primary: "#00543C", secondary: "#003B2A", accent: "#FFC600", surfaceTint: "#E6F0EC" },
    menu: [
      ["Footlongs", "Turkey Breast Footlong", 560, 36, 92, 7, 1520],
      ["Footlongs", "Italian B.M.T. Footlong", 820, 38, 94, 32, 2500],
      ["Footlongs", "Meatball Marinara Footlong", 960, 42, 118, 36, 2020],
      ["6 Inch", "Turkey Breast 6in", 280, 18, 46, 3.5, 760],
      ["6 Inch", "Veggie Delite 6in", 200, 9, 39, 2, 280],
      ["Salads", "Rotisserie Chicken Salad", 190, 27, 10, 5, 500],
    ],
    ingredients: [
      ["Bread", "Italian Bread 6in", 180, 7, 34, 2, true],
      ["Bread", "9-Grain Wheat 6in", 180, 8, 34, 2],
      ["Bread", "Italian Herbs and Cheese 6in", 240, 9, 39, 5],
      ["Protein", "Turkey Breast", 50, 9, 2, 1, true],
      ["Protein", "Rotisserie Chicken", 90, 15, 1, 3],
      ["Protein", "Steak", 110, 15, 3, 4],
      ["Protein", "Tuna", 250, 10, 1, 23],
      ["Cheese", "American Cheese", 40, 2, 1, 3.5, true],
      ["Cheese", "Provolone", 50, 4, 0, 4],
      ["Veggies", "Lettuce", 5, 0, 1, 0, true],
      ["Veggies", "Tomatoes", 10, 0, 2, 0, true],
      ["Veggies", "Onions", 10, 0, 2, 0],
      ["Veggies", "Pickles", 0, 0, 0, 0],
      ["Veggies", "Jalapenos", 5, 0, 1, 0],
      ["Sauce", "Mayonnaise", 100, 0, 0, 11],
      ["Sauce", "Sweet Onion Sauce", 40, 0, 9, 0],
      ["Sauce", "Chipotle Southwest", 100, 0, 1, 10],
    ],
  },
  {
    name: "Starbucks",
    slug: "starbucks",
    theme: { primary: "#00704A", secondary: "#004F34", accent: "#D4E9E2", surfaceTint: "#E7F1ED" },
    menu: [
      ["Drinks", "Caffe Latte Grande (2% milk)", 190, 13, 19, 7, 170],
      ["Drinks", "Caramel Macchiato Grande", 250, 10, 35, 7, 150],
      ["Drinks", "Cold Brew Black Grande", 5, 0, 0, 0, 15],
      ["Food", "Spinach Feta Egg White Wrap", 290, 20, 34, 8, 840],
      ["Food", "Turkey Bacon Egg White Sandwich", 230, 17, 28, 5, 560],
      ["Food", "Butter Croissant", 260, 5, 27, 15, 310],
    ],
  },
  {
    name: "Chipotle",
    slug: "chipotle",
    theme: { primary: "#A81612", secondary: "#7C100D", accent: "#F4C431", surfaceTint: "#F7E9E8" },
    menu: [
      ["Bowls", "Chicken Burrito Bowl (typical)", 665, 51, 66, 22, 1350],
      ["Bowls", "Steak Burrito Bowl (typical)", 650, 40, 67, 23, 1320],
      ["Burritos", "Chicken Burrito (typical)", 985, 57, 106, 36, 2020],
      ["Tacos", "3 Chicken Soft Tacos", 495, 39, 48, 16, 990],
    ],
    ingredients: [
      ["Base", "White Rice", 210, 4, 40, 4, true],
      ["Base", "Brown Rice", 210, 4, 36, 6],
      ["Base", "Flour Tortilla (burrito)", 320, 8, 50, 9],
      ["Protein", "Chicken", 180, 32, 0, 7, true],
      ["Protein", "Steak", 150, 21, 1, 6],
      ["Protein", "Barbacoa", 170, 24, 2, 7],
      ["Protein", "Sofritas", 150, 8, 9, 10],
      ["Beans", "Black Beans", 130, 8, 22, 1.5, true],
      ["Beans", "Pinto Beans", 130, 8, 21, 1.5],
      ["Toppings", "Fresh Tomato Salsa", 25, 0, 4, 0, true],
      ["Toppings", "Roasted Chili-Corn Salsa", 80, 3, 16, 1.5],
      ["Toppings", "Sour Cream", 110, 2, 2, 9],
      ["Toppings", "Cheese", 110, 6, 1, 8, true],
      ["Toppings", "Guacamole", 230, 2, 8, 22],
      ["Toppings", "Lettuce", 5, 0, 1, 0],
    ],
  },
  {
    name: "Chick-fil-A",
    slug: "chick-fil-a",
    theme: { primary: "#E51636", secondary: "#B01029", accent: "#FFB6C1", surfaceTint: "#FBE8EC" },
    menu: [
      ["Entrees", "Chicken Sandwich", 420, 28, 41, 18, 1400],
      ["Entrees", "Spicy Chicken Sandwich", 450, 28, 45, 19, 1730],
      ["Entrees", "12 pc Grilled Nuggets", 200, 38, 2, 4.5, 730],
      ["Sides", "Medium Waffle Fries", 420, 5, 45, 24, 240],
      ["Salads", "Cobb Salad with Grilled Chicken", 400, 38, 22, 20, 1350],
    ],
  },
  {
    name: "Taco Bell",
    slug: "taco-bell",
    theme: { primary: "#702082", secondary: "#4E1659", accent: "#FBBF15", surfaceTint: "#F1E8F3" },
    menu: [
      ["Tacos", "Crunchy Taco", 170, 8, 13, 10, 310],
      ["Tacos", "Soft Taco Supreme (beef)", 210, 9, 20, 10, 520],
      ["Burritos", "Bean Burrito", 350, 13, 54, 9, 1000],
      ["Burritos", "Burrito Supreme (beef)", 390, 16, 51, 14, 1110],
      ["Specialties", "Crunchwrap Supreme", 530, 16, 71, 21, 1200],
    ],
  },
  {
    name: "Dunkin'",
    slug: "dunkin",
    theme: { primary: "#381F00", secondary: "#241400", accent: "#FF671F", surfaceTint: "#F3EDE6", textOverride: "#FFFFFF" },
    menu: [
      ["Drinks", "Medium Iced Coffee (black)", 15, 1, 2, 0, 10],
      ["Drinks", "Medium Latte (whole milk)", 210, 10, 21, 10, 160],
      ["Food", "Bacon Egg and Cheese Croissant", 520, 18, 39, 33, 960],
      ["Food", "Glazed Donut", 240, 4, 33, 11, 330],
      ["Food", "Everything Bagel with Cream Cheese", 490, 15, 66, 18, 830],
    ],
  },
  {
    name: "Panera Bread",
    slug: "panera",
    theme: { primary: "#6A7F10", secondary: "#4C5B0B", accent: "#E8A33D", surfaceTint: "#EFF2E2" },
    menu: [
      ["Sandwiches", "Chipotle Chicken Avocado Melt", 850, 42, 66, 46, 1770],
      ["Salads", "Green Goddess Cobb with Chicken", 530, 41, 28, 29, 1210],
      ["Soups", "Broccoli Cheddar Soup (cup)", 240, 8, 17, 16, 720],
      ["Bowls", "Mediterranean Grain Bowl with Chicken", 620, 37, 65, 24, 1130],
    ],
  },
  {
    name: "Wendy's",
    slug: "wendys",
    theme: { primary: "#E2203D", secondary: "#B01730", accent: "#FFC72C", surfaceTint: "#FBE9EC" },
    menu: [
      ["Burgers", "Dave's Single", 590, 30, 39, 34, 1170],
      ["Burgers", "Jr. Bacon Cheeseburger", 380, 20, 27, 22, 720],
      ["Chicken", "Spicy Chicken Sandwich", 490, 27, 47, 21, 1200],
      ["Sides", "Medium Fries", 420, 5, 55, 19, 390],
      ["Sides", "Small Chili", 240, 15, 21, 11, 850],
    ],
  },
  {
    name: "Burger King",
    slug: "burger-king",
    theme: { primary: "#D62300", secondary: "#A31B00", accent: "#F5EBDC", surfaceTint: "#FBEAE5" },
    menu: [
      ["Burgers", "Whopper", 670, 31, 54, 40, 1000],
      ["Burgers", "Whopper Jr.", 330, 15, 27, 19, 500],
      ["Chicken", "Original Chicken Sandwich", 660, 23, 48, 40, 1170],
      ["Sides", "Medium Onion Rings", 410, 5, 46, 21, 1080],
    ],
  },
  {
    name: "MyProtein",
    slug: "myprotein",
    theme: { primary: "#0F1B5F", secondary: "#0A1240", accent: "#00C2CB", surfaceTint: "#E8EAF4" },
    menu: [
      ["Protein", "Impact Whey Protein (1 scoop)", 103, 21, 1.5, 1.9, 50],
      ["Protein", "Clear Whey Isolate (1 scoop)", 90, 20, 1, 0.3, 30],
      ["Snacks", "Protein Brownie", 287, 23, 28, 9.5, 190],
      ["Snacks", "Layered Protein Bar", 218, 20, 20, 7.5, 150],
    ],
    ingredients: [
      ["Powder", "Impact Whey (1 scoop)", 103, 21, 1.5, 1.9, true],
      ["Powder", "Creatine Monohydrate (5g)", 0, 0, 0, 0],
      ["Powder", "Instant Oats (50g)", 190, 6, 33, 3],
      ["Liquid", "Water", 0, 0, 0, 0, true],
      ["Liquid", "Whole Milk (250ml)", 160, 8, 12, 9],
      ["Liquid", "Semi-Skimmed Milk (250ml)", 120, 9, 12, 4.5],
      ["Extras", "Peanut Butter (1 tbsp)", 95, 4, 3, 8],
      ["Extras", "Banana", 105, 1.3, 27, 0.4],
    ],
  },
];

async function main() {
  const existing = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
  if (existing.length > 0) {
    console.log("Stores already seeded — skipping. Truncate tables to reseed.");
    return;
  }

  // Demo user (webhook-managed users are separate; this one owns sample data).
  const demoUserId = "user_demo_macromap";
  await db
    .insert(schema.users)
    .values({ id: demoUserId, email: "demo@macromap.local", displayName: "Demo User" })
    .onConflictDoNothing();
  await db
    .insert(schema.profiles)
    .values({ userId: demoUserId, timezone: "America/Chicago", unitSystem: "imperial", heightCm: 178 })
    .onConflictDoNothing();

  let subwayCustomOrder: { storeId: string; items: Array<{ foodId: string; qty: number }> } | null = null;

  for (const storeSeed of STORES) {
    const [store] = await db
      .insert(schema.stores)
      .values({ name: storeSeed.name, slug: storeSeed.slug, brandThemeKey: storeSeed.slug })
      .returning();

    await db.insert(schema.storeThemeTokens).values({
      storeId: store.id,
      primaryHex: storeSeed.theme.primary,
      secondaryHex: storeSeed.theme.secondary,
      accentHex: storeSeed.theme.accent,
      surfaceTintHex: storeSeed.theme.surfaceTint,
      textOverrideHex: storeSeed.theme.textOverride ?? null,
    });

    let order = 0;
    for (const [category, name, calories, protein, carbs, fat, sodium] of storeSeed.menu) {
      const [food] = await db
        .insert(schema.foods)
        .values({
          name,
          brandName: storeSeed.name,
          sourceType: "official_store",
          servingSizeValue: 1,
          servingSizeUnit: "item",
          calories,
          proteinG: protein,
          carbsG: carbs,
          fatG: fat,
          sodiumMg: sodium ?? null,
          isVerified: true,
        })
        .returning();
      await db.insert(schema.storeMenuItems).values({
        storeId: store.id,
        foodId: food.id,
        isDefaultVerified: true,
        menuCategory: category,
        displayOrder: order++,
      });
    }

    if (storeSeed.ingredients) {
      const ingredientFoods: Array<{ foodId: string; defaultSelected: boolean }> = [];
      for (const [group, name, calories, protein, carbs, fat, defaultSelected] of storeSeed.ingredients) {
        const [food] = await db
          .insert(schema.foods)
          .values({
            name,
            brandName: storeSeed.name,
            sourceType: "official_store",
            servingSizeValue: 1,
            servingSizeUnit: "portion",
            calories,
            proteinG: protein,
            carbsG: carbs,
            fatG: fat,
            isVerified: true,
          })
          .returning();
        await db.insert(schema.storeIngredients).values({
          storeId: store.id,
          foodId: food.id,
          ingredientGroup: group,
          isDefaultSelected: defaultSelected ?? false,
        });
        ingredientFoods.push({ foodId: food.id, defaultSelected: defaultSelected ?? false });
      }
      if (storeSeed.slug === "subway") {
        subwayCustomOrder = {
          storeId: store.id,
          items: ingredientFoods
            .filter((f) => f.defaultSelected)
            .map((f) => ({ foodId: f.foodId, qty: 1 })),
        };
      }
    }
    console.log(`Seeded ${storeSeed.name}`);
  }

  // A few generic shared foods for search demos.
  const generic: Array<[string, number, number, number, number, string, number]> = [
    ["Large Egg", 70, 6, 0.5, 5, "egg", 1],
    ["Banana", 105, 1.3, 27, 0.4, "medium", 1],
    ["Chicken Breast (cooked)", 165, 31, 0, 3.6, "100 g", 100],
    ["White Rice (cooked)", 130, 2.7, 28, 0.3, "100 g", 100],
    ["Greek Yogurt, plain nonfat", 59, 10, 3.6, 0.4, "100 g", 100],
  ];
  for (const [name, calories, protein, carbs, fat, unit, servingValue] of generic) {
    await db.insert(schema.foods).values({
      name,
      sourceType: "user_created",
      createdByUserId: demoUserId,
      servingSizeValue: servingValue,
      servingSizeUnit: unit,
      calories,
      proteinG: protein,
      carbsG: carbs,
      fatG: fat,
      isVerified: false,
    });
  }

  // Demo goal profile with weekday/weekend split.
  const [goalProfile] = await db
    .insert(schema.goalProfiles)
    .values({ userId: demoUserId, name: "Cutting Plan", isActive: true })
    .returning();
  await db.insert(schema.goalDays).values(
    Array.from({ length: 7 }, (_, dayOfWeek) => ({
      goalProfileId: goalProfile.id,
      dayOfWeek,
      calories: dayOfWeek === 0 || dayOfWeek === 6 ? 2300 : 2000,
      proteinG: 170,
      carbsG: dayOfWeek === 0 || dayOfWeek === 6 ? 230 : 190,
      fatG: 65,
      fiberG: 30,
      sodiumMgMax: 2300,
    })),
  );

  // Saved Subway custom order + nutrition snapshot.
  if (subwayCustomOrder) {
    const items = subwayCustomOrder.items;
    const foodsRows = await db.select().from(schema.foods).where(
      sql`${schema.foods.id} in ${items.map((i) => i.foodId)}`,
    );
    const totals = foodsRows.reduce(
      (acc, food) => ({
        calories: acc.calories + food.calories,
        proteinG: acc.proteinG + food.proteinG,
        carbsG: acc.carbsG + food.carbsG,
        fatG: acc.fatG + food.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );
    const [customOrder] = await db
      .insert(schema.customStoreOrders)
      .values({
        userId: demoUserId,
        storeId: subwayCustomOrder.storeId,
        name: "My usual turkey 6in",
        nutritionSnapshotJson: totals,
      })
      .returning();
    await db.insert(schema.customStoreOrderItems).values(
      items.map((item) => ({
        customStoreOrderId: customOrder.id,
        ingredientFoodId: item.foodId,
        quantity: item.qty,
      })),
    );
  }

  // 14 days of weight history + a couple of diary days.
  const today = new Date();
  const iso = (offset: number) => {
    const d = new Date(today.getTime() - offset * 86_400_000);
    return d.toISOString().slice(0, 10);
  };
  await db.insert(schema.weightLogs).values(
    Array.from({ length: 14 }, (_, i) => ({
      userId: demoUserId,
      date: iso(13 - i),
      weightValue: Math.round((185 - i * 0.35 + Math.sin(i) * 0.6) * 10) / 10,
    })),
  );
  await db.insert(schema.bodyMetricLogs).values([
    { userId: demoUserId, date: iso(10), bodyFatPct: 21.5, waistCm: 88 },
    { userId: demoUserId, date: iso(3), bodyFatPct: 21.1, waistCm: 87.2 },
  ]);

  const [egg] = await db
    .select()
    .from(schema.foods)
    .where(sql`${schema.foods.name} = 'Large Egg'`)
    .limit(1);
  for (const offset of [1, 0]) {
    const [day] = await db
      .insert(schema.diaryDays)
      .values({ userId: demoUserId, date: iso(offset), goalProfileId: goalProfile.id })
      .returning();
    const [breakfast] = await db
      .insert(schema.diaryMeals)
      .values({ diaryDayId: day.id, mealName: "Breakfast", displayOrder: 0 })
      .returning();
    await db.insert(schema.diaryEntries).values({
      diaryMealId: breakfast.id,
      foodId: egg.id,
      quantity: 3,
      servingMultiplier: 1,
      loggedVia: "search",
      nutritionSnapshotJson: {
        label: "Large Egg",
        calories: 210,
        proteinG: 18,
        carbsG: 1.5,
        fatG: 15,
      },
    });
  }

  // One completed fast.
  const fastStart = new Date(today.getTime() - 86_400_000);
  const fastEnd = new Date(fastStart.getTime() + 16 * 3_600_000);
  await db.insert(schema.fastingSessions).values({
    userId: demoUserId,
    startAt: fastStart,
    endAt: fastEnd,
    durationMinutes: 960,
  });

  console.log("Seed complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
