/**
 * Free-text food search against external sources — USDA FoodData Central
 * (when BARCODE_API_KEY is set) and Open Food Facts. Used as a fallback when
 * the local shared database has few matches; results are transient until the
 * user imports one via POST /api/foods/import.
 */

export interface ExternalFoodResult {
  source: "usda" | "open_food_facts";
  name: string;
  brandName: string | null;
  barcode: string | null;
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
  transFatG?: number;
}

const FETCH_TIMEOUT_MS = 4_000;

export async function searchExternalFoods(
  query: string,
  limit = 8,
): Promise<ExternalFoodResult[]> {
  const [usda, off] = await Promise.all([
    searchUsda(query, limit).catch(() => []),
    searchOpenFoodFacts(query, limit).catch(() => []),
  ]);

  // USDA first (label-accurate US data), then OFF; drop duplicate barcodes.
  const seen = new Set<string>();
  const merged: ExternalFoodResult[] = [];
  for (const item of [...usda, ...off]) {
    const key = item.barcode ?? `${item.source}:${item.name}:${item.brandName ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged;
}

interface FdcSearchFood {
  description?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: Array<{ nutrientName?: string; value?: number }>;
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

async function searchUsda(query: string, limit: number): Promise<ExternalFoodResult[]> {
  const key = process.env.BARCODE_API_KEY;
  if (!key) return [];
  const res = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}&dataType=Branded&pageSize=${limit}`,
    { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { foods?: FdcSearchFood[] };
  const results: ExternalFoodResult[] = [];
  for (const item of data.foods ?? []) {
    const calories = fdcNutrient(item, "Energy");
    if (!item.description || calories == null) continue;
    const result: ExternalFoodResult = {
      source: "usda",
      name: titleCase(item.description),
      brandName: item.brandName ?? item.brandOwner ?? null,
      barcode: item.gtinUpc ?? null,
      // FDC search nutrients are per 100 g.
      servingSizeValue: 100,
      servingSizeUnit: "g",
      calories,
      proteinG: fdcNutrient(item, "Protein") ?? 0,
      carbsG: fdcNutrient(item, "Carbohydrate, by difference") ?? 0,
      fatG: fdcNutrient(item, "Total lipid (fat)") ?? 0,
    };
    assignIfPresent(result, "fiberG", fdcNutrient(item, "Fiber, total dietary"));
    assignIfPresent(
      result,
      "sugarG",
      fdcNutrient(item, "Sugars, total including NLEA", "Total Sugars"),
    );
    assignIfPresent(result, "satFatG", fdcNutrient(item, "Fatty acids, total saturated"));
    assignIfPresent(result, "transFatG", fdcNutrient(item, "Fatty acids, total trans"));
    assignIfPresent(result, "sodiumMg", fdcNutrient(item, "Sodium, Na"));
    assignIfPresent(result, "cholesterolMg", fdcNutrient(item, "Cholesterol"));
    assignIfPresent(result, "potassiumMg", fdcNutrient(item, "Potassium, K"));
    results.push(result);
  }
  return results;
}

interface OffProduct {
  product_name?: string;
  brands?: string;
  code?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | undefined>;
}

async function searchOpenFoodFacts(
  query: string,
  limit: number,
): Promise<ExternalFoodResult[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: String(limit),
    fields: "product_name,brands,code,nutriments,serving_quantity",
  });
  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, {
    headers: { "User-Agent": "MacroMap/1.0 (nutrition tracker)" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { products?: OffProduct[] };
  const results: ExternalFoodResult[] = [];
  for (const product of data.products ?? []) {
    const n = product.nutriments ?? {};
    const perServing = n["energy-kcal_serving"] != null;
    const suffix = perServing ? "_serving" : "_100g";
    const calories = n[`energy-kcal${suffix}`];
    if (!product.product_name || calories == null) continue;
    const servingQuantity = Number(product.serving_quantity);
    const result: ExternalFoodResult = {
      source: "open_food_facts",
      name: product.product_name,
      brandName: product.brands?.split(",")[0]?.trim() || null,
      barcode: product.code ?? null,
      servingSizeValue: perServing && servingQuantity > 0 ? servingQuantity : 100,
      servingSizeUnit: "g",
      calories,
      proteinG: n[`proteins${suffix}`] ?? 0,
      carbsG: n[`carbohydrates${suffix}`] ?? 0,
      fatG: n[`fat${suffix}`] ?? 0,
    };
    assignIfPresent(result, "fiberG", n[`fiber${suffix}`]);
    assignIfPresent(result, "sugarG", n[`sugars${suffix}`]);
    assignIfPresent(result, "satFatG", n[`saturated-fat${suffix}`]);
    const sodium = n[`sodium${suffix}`];
    if (sodium != null) result.sodiumMg = sodium * 1000;
    results.push(result);
  }
  return results;
}

type OptionalNutrient = NonNullable<
  {
    [K in keyof ExternalFoodResult]: ExternalFoodResult[K] extends number | undefined
      ? K
      : never;
  }[keyof ExternalFoodResult]
>;

function assignIfPresent(
  target: ExternalFoodResult,
  key: OptionalNutrient,
  value: number | undefined,
) {
  if (value != null) target[key] = value;
}

/** USDA descriptions are SHOUTED ("JEWEL OSCO, WHEAT BREAD") — soften them. */
function titleCase(text: string): string {
  if (text !== text.toUpperCase()) return text;
  return text
    .toLowerCase()
    .replace(/(^|[\s\-(,/])[a-z]/g, (match) => match.toUpperCase());
}
