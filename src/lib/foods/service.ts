import { desc, eq, gt, ilike, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { foodEditHistory, foods, type Food } from "@/lib/db/schema";

export const DUPLICATE_SIMILARITY_THRESHOLD = 0.4;
/**
 * word_similarity cutoff for fuzzy fallback matches. High on purpose: at 0.15
 * a search for "bread" surfaced "Chicken Breast" (they share most trigrams).
 * 0.55 still catches typos ("chiken" -> "chicken") without cross-word noise.
 */
export const SEARCH_WORD_SIMILARITY_THRESHOLD = 0.55;

const searchTarget = sql`(${foods.name} || ' ' || coalesce(${foods.brandName}, ''))`;

export interface SimilarFood {
  id: string;
  name: string;
  brandName: string | null;
  similarityScore: number;
}

export async function findSimilarFoods(
  name: string,
  brandName?: string | null,
): Promise<SimilarFood[]> {
  const query = brandName ? `${name} ${brandName}` : name;
  const score = sql<number>`similarity(${searchTarget}, ${query})`;
  const rows = await db
    .select({
      id: foods.id,
      name: foods.name,
      brandName: foods.brandName,
      similarityScore: score,
    })
    .from(foods)
    .where(gt(score, DUPLICATE_SIMILARITY_THRESHOLD))
    .orderBy(desc(score))
    .limit(5);
  return rows;
}

export async function searchFoods(query: string, limit = 25): Promise<Food[]> {
  // Relevance first: a hit in the food's NAME beats a hit in its brand
  // ("bread" should list breads before every Panera Bread dish), literal
  // substrings beat fuzzy ones, and the verified badge only breaks ties.
  const nameMatch = sql<number>`case when ${foods.name} ilike ${"%" + query + "%"} then 1 else 0 end`;
  const substrMatch = sql<number>`case when ${searchTarget} ilike ${"%" + query + "%"} then 1 else 0 end`;
  const wordScore = sql<number>`word_similarity(${query}, ${searchTarget})`;
  const rows = await db
    .select()
    .from(foods)
    .where(
      or(
        ilike(sql`${searchTarget}`, `%${query}%`),
        gt(wordScore, SEARCH_WORD_SIMILARITY_THRESHOLD),
      ),
    )
    .orderBy(desc(nameMatch), desc(substrMatch), desc(wordScore), desc(foods.isVerified))
    .limit(limit);
  return rows;
}

export async function getFoodById(id: string): Promise<Food | undefined> {
  const [row] = await db.select().from(foods).where(eq(foods.id, id)).limit(1);
  return row;
}

/** Fields users may edit on a shared food; every change is written to history. */
export const EDITABLE_FOOD_FIELDS = [
  "name",
  "brandName",
  "servingSizeValue",
  "servingSizeUnit",
  "calories",
  "proteinG",
  "carbsG",
  "fatG",
  "fiberG",
  "sugarG",
  "satFatG",
  "sodiumMg",
  "cholesterolMg",
  "potassiumMg",
  "transFatG",
  "polyUnsatFatG",
  "monoUnsatFatG",
  "addedSugarsG",
  "sugarAlcoholsG",
  "vitaminAPct",
  "vitaminCPct",
  "calciumPct",
  "ironPct",
  "vitaminDPct",
] as const;

export type EditableFoodField = (typeof EDITABLE_FOOD_FIELDS)[number];

export async function applyFoodEdit(
  food: Food,
  changes: Partial<Pick<Food, EditableFoodField>>,
  editedByUserId: string,
): Promise<{ changedFields: EditableFoodField[] }> {
  const changedFields: EditableFoodField[] = [];
  const updates: Record<string, unknown> = {};

  for (const field of EDITABLE_FOOD_FIELDS) {
    if (!(field in changes)) continue;
    const next = changes[field];
    if (next === undefined || next === food[field]) continue;
    changedFields.push(field);
    updates[field] = next;
  }

  if (changedFields.length === 0) return { changedFields };

  await db
    .update(foods)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(foods.id, food.id));

  await db.insert(foodEditHistory).values(
    changedFields.map((field) => ({
      foodId: food.id,
      editedByUserId,
      fieldChanged: field,
      oldValue: food[field] == null ? null : String(food[field]),
      newValue: changes[field] == null ? null : String(changes[field]),
    })),
  );

  return { changedFields };
}
