import { desc, eq, gt, ilike, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { foodEditHistory, foods, type Food } from "@/lib/db/schema";

export const DUPLICATE_SIMILARITY_THRESHOLD = 0.4;
export const SEARCH_SIMILARITY_THRESHOLD = 0.15;

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
  const score = sql<number>`similarity(${searchTarget}, ${query})`;
  const rows = await db
    .select()
    .from(foods)
    .where(
      or(
        ilike(sql`${searchTarget}`, `%${query}%`),
        gt(score, SEARCH_SIMILARITY_THRESHOLD),
      ),
    )
    .orderBy(desc(foods.isVerified), desc(score))
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
