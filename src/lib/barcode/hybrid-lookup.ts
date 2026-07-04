import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { barcodeIngestLogs, foods, type Food, type NewFood } from "@/lib/db/schema";

export type BarcodeLookupStatus =
  | "found_local"
  | "found_open_food_facts"
  | "found_commercial"
  | "not_found";

export interface BarcodeLookupResult {
  status: BarcodeLookupStatus;
  food: Food | null;
}

interface ExternalFood {
  name: string;
  brandName: string | null;
  servingSizeValue: number;
  servingSizeUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  satFatG?: number;
  sodiumMg?: number;
  cholesterolMg?: number;
  potassiumMg?: number;
}

/**
 * Resolution order: local DB -> Open Food Facts -> USDA FoodData Central
 * (enabled when BARCODE_API_KEY holds an api.data.gov key) -> not_found
 * (caller offers manual entry). External hits are persisted as shared foods.
 */
export async function hybridBarcodeLookup(barcode: string): Promise<BarcodeLookupResult> {
  const [local] = await db.select().from(foods).where(eq(foods.barcode, barcode)).limit(1);
  if (local) {
    await logIngest(barcode, local.id, "local", "found");
    return { status: "found_local", food: local };
  }

  const offFood = await lookupOpenFoodFacts(barcode);
  if (offFood) {
    const saved = await saveExternalFood(offFood, barcode, "open_food_facts");
    await logIngest(barcode, saved.id, "open_food_facts", "found");
    return { status: "found_open_food_facts", food: saved };
  }

  const commercialFood = await lookupCommercial(barcode);
  if (commercialFood) {
    const saved = await saveExternalFood(commercialFood, barcode, "barcode_api");
    await logIngest(barcode, saved.id, "commercial", "found");
    return { status: "found_commercial", food: saved };
  }

  await logIngest(barcode, null, "none", "not_found");
  return { status: "not_found", food: null };
}

async function logIngest(
  barcode: string,
  resolvedFoodId: string | null,
  sourceUsed: string,
  status: string,
) {
  await db.insert(barcodeIngestLogs).values({ barcode, resolvedFoodId, sourceUsed, status });
}

async function saveExternalFood(
  external: ExternalFood,
  barcode: string,
  sourceType: NewFood["sourceType"],
): Promise<Food> {
  const [inserted] = await db
    .insert(foods)
    .values({ ...external, barcode, sourceType, isVerified: false })
    .onConflictDoNothing()
    .returning();
  if (inserted) return inserted;
  // Concurrent lookup already saved it.
  const [existing] = await db.select().from(foods).where(eq(foods.barcode, barcode)).limit(1);
  return existing;
}

interface OffNutriments {
  [key: string]: number | undefined;
}

async function lookupOpenFoodFacts(barcode: string): Promise<ExternalFood | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,nutriments,serving_size,serving_quantity`,
      { headers: { "User-Agent": "MacroMap/1.0 (nutrition tracker)" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: number;
      product?: {
        product_name?: string;
        brands?: string;
        serving_size?: string;
        serving_quantity?: number | string;
        nutriments?: OffNutriments;
      };
    };
    if (data.status !== 1 || !data.product?.product_name || !data.product.nutriments) {
      return null;
    }
    const n = data.product.nutriments;
    // Prefer per-serving values; fall back to per-100g.
    const perServing = n["energy-kcal_serving"] != null;
    const suffix = perServing ? "_serving" : "_100g";
    const calories = n[`energy-kcal${suffix}`];
    if (calories == null) return null;

    const servingQuantity = Number(data.product.serving_quantity);
    const food: ExternalFood = {
      name: data.product.product_name,
      brandName: data.product.brands?.split(",")[0]?.trim() || null,
      servingSizeValue: perServing && servingQuantity > 0 ? servingQuantity : 100,
      servingSizeUnit: "g",
      calories,
      proteinG: n[`proteins${suffix}`] ?? 0,
      carbsG: n[`carbohydrates${suffix}`] ?? 0,
      fatG: n[`fat${suffix}`] ?? 0,
    };
    if (n[`fiber${suffix}`] != null) food.fiberG = n[`fiber${suffix}`];
    if (n[`sugars${suffix}`] != null) food.sugarG = n[`sugars${suffix}`];
    if (n[`saturated-fat${suffix}`] != null) food.satFatG = n[`saturated-fat${suffix}`];
    if (n[`sodium${suffix}`] != null) food.sodiumMg = (n[`sodium${suffix}`] ?? 0) * 1000;
    return food;
  } catch {
    return null;
  }
}

interface FdcSearchFood {
  description?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: Array<{
    nutrientName?: string;
    unitName?: string;
    value?: number;
  }>;
}

function fdcNutrient(food: FdcSearchFood, ...names: string[]): number | undefined {
  for (const name of names) {
    const hit = food.foodNutrients?.find(
      (n) => n.nutrientName?.toLowerCase() === name.toLowerCase() && n.value != null,
    );
    if (hit) return hit.value;
  }
  return undefined;
}

/** USDA FoodData Central branded-foods lookup by GTIN/UPC. Values are per 100g. */
async function lookupCommercial(barcode: string): Promise<ExternalFood | null> {
  const key = process.env.BARCODE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(barcode)}&dataType=Branded&pageSize=5`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { foods?: FdcSearchFood[] };
    // GTINs are zero-padded inconsistently across sources — compare trimmed.
    const normalized = barcode.replace(/^0+/, "");
    const item = data.foods?.find(
      (food) => food.gtinUpc?.replace(/^0+/, "") === normalized,
    );
    if (!item?.description) return null;
    const calories = fdcNutrient(item, "Energy");
    if (calories == null) return null;

    const food: ExternalFood = {
      name: item.description,
      brandName: item.brandName ?? item.brandOwner ?? null,
      servingSizeValue: 100,
      servingSizeUnit: "g",
      calories,
      proteinG: fdcNutrient(item, "Protein") ?? 0,
      carbsG: fdcNutrient(item, "Carbohydrate, by difference") ?? 0,
      fatG: fdcNutrient(item, "Total lipid (fat)") ?? 0,
    };
    const fiber = fdcNutrient(item, "Fiber, total dietary");
    if (fiber != null) food.fiberG = fiber;
    const sugar = fdcNutrient(item, "Sugars, total including NLEA", "Total Sugars");
    if (sugar != null) food.sugarG = sugar;
    const satFat = fdcNutrient(item, "Fatty acids, total saturated");
    if (satFat != null) food.satFatG = satFat;
    const sodium = fdcNutrient(item, "Sodium, Na");
    if (sodium != null) food.sodiumMg = sodium;
    const cholesterol = fdcNutrient(item, "Cholesterol");
    if (cholesterol != null) food.cholesterolMg = cholesterol;
    const potassium = fdcNutrient(item, "Potassium, K");
    if (potassium != null) food.potassiumMg = potassium;
    return food;
  } catch {
    return null;
  }
}
