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
 * Resolution order: local DB -> Open Food Facts -> commercial API (Nutritionix,
 * enabled when BARCODE_API_KEY is "appId:appKey") -> not_found (caller offers
 * manual entry). External hits are persisted as shared foods.
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

async function lookupCommercial(barcode: string): Promise<ExternalFood | null> {
  const key = process.env.BARCODE_API_KEY;
  if (!key || !key.includes(":")) return null;
  const [appId, appKey] = key.split(":");
  try {
    const res = await fetch(
      `https://trackapi.nutritionix.com/v2/search/item?upc=${encodeURIComponent(barcode)}`,
      { headers: { "x-app-id": appId, "x-app-key": appKey } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      foods?: Array<{
        food_name?: string;
        brand_name?: string;
        serving_qty?: number;
        serving_unit?: string;
        nf_calories?: number;
        nf_protein?: number;
        nf_total_carbohydrate?: number;
        nf_total_fat?: number;
        nf_dietary_fiber?: number;
        nf_sugars?: number;
        nf_saturated_fat?: number;
        nf_sodium?: number;
        nf_cholesterol?: number;
        nf_potassium?: number;
      }>;
    };
    const item = data.foods?.[0];
    if (!item?.food_name || item.nf_calories == null) return null;
    const food: ExternalFood = {
      name: item.food_name,
      brandName: item.brand_name ?? null,
      servingSizeValue: item.serving_qty ?? 1,
      servingSizeUnit: item.serving_unit ?? "serving",
      calories: item.nf_calories,
      proteinG: item.nf_protein ?? 0,
      carbsG: item.nf_total_carbohydrate ?? 0,
      fatG: item.nf_total_fat ?? 0,
    };
    if (item.nf_dietary_fiber != null) food.fiberG = item.nf_dietary_fiber;
    if (item.nf_sugars != null) food.sugarG = item.nf_sugars;
    if (item.nf_saturated_fat != null) food.satFatG = item.nf_saturated_fat;
    if (item.nf_sodium != null) food.sodiumMg = item.nf_sodium;
    if (item.nf_cholesterol != null) food.cholesterolMg = item.nf_cholesterol;
    if (item.nf_potassium != null) food.potassiumMg = item.nf_potassium;
    return food;
  } catch {
    return null;
  }
}
