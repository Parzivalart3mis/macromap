import { desc, eq, gt, ilike, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  diaryDays,
  diaryEntries,
  diaryMeals,
  foodEditHistory,
  foods,
  type Food,
} from "@/lib/db/schema";

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

export async function searchFoods(
  query: string,
  userId: string | null = null,
  limit = 25,
): Promise<Food[]> {
  // MyFitnessPal-style relevance: a hit in the food's NAME beats a hit in its
  // brand ("bread" lists breads before every Panera Bread dish); within that,
  // the user's OWN foods (created or logged) come first, then globally popular
  // foods (log_count), then similarity, with the verified badge as final
  // tiebreak.
  // Typing a food's exact name ("banana", "coca cola") pins it to the top,
  // whether the match is the bare name or "name + brand".
  const exactMatch = sql<number>`case
    when lower(${foods.name}) = lower(${query}) then 2
    when lower(trim(${foods.name} || ' ' || coalesce(${foods.brandName}, ''))) = lower(${query})
      or lower(trim(coalesce(${foods.brandName}, '') || ' ' || ${foods.name})) = lower(${query})
      then 1
    else 0 end`;
  const nameMatch = sql<number>`case when ${foods.name} ilike ${"%" + query + "%"} then 1 else 0 end`;
  const substrMatch = sql<number>`case when ${searchTarget} ilike ${"%" + query + "%"} then 1 else 0 end`;
  const wordScore = sql<number>`word_similarity(${query}, ${searchTarget})`;
  // "Mine": a food I created, or one I have logged before — surfaces personal
  // recipes above generic USDA entries even before they're logged.
  const mine = userId
    ? sql<number>`case when ${foods.createdByUserId} = ${userId} or exists (
        select 1 from ${diaryEntries}
        join ${diaryMeals} on ${diaryMeals.id} = ${diaryEntries.diaryMealId}
        join ${diaryDays} on ${diaryDays.id} = ${diaryMeals.diaryDayId}
        where ${diaryEntries.foodId} = ${foods.id} and ${diaryDays.userId} = ${userId}
      ) then 1 else 0 end`
    : sql<number>`0`;
  const rows = await db
    .select()
    .from(foods)
    .where(
      or(
        ilike(sql`${searchTarget}`, `%${query}%`),
        gt(wordScore, SEARCH_WORD_SIMILARITY_THRESHOLD),
      ),
    )
    .orderBy(
      desc(exactMatch),
      desc(nameMatch),
      desc(mine),
      desc(foods.logCount),
      desc(substrMatch),
      desc(wordScore),
      desc(foods.isVerified),
      // Until popularity data accumulates, prefer simple generic entries
      // ("Apple, raw") over long specific ones.
      sql`length(${foods.name}) asc`,
    )
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
  "description",
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
  changes: Partial<Pick<Food, EditableFoodField | "alternateServings">>,
  editedByUserId: string,
): Promise<{ changedFields: string[] }> {
  const changedFields: string[] = [];
  const updates: Record<string, unknown> = {};
  const history: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

  for (const field of EDITABLE_FOOD_FIELDS) {
    if (!(field in changes)) continue;
    const next = changes[field];
    if (next === undefined || next === food[field]) continue;
    changedFields.push(field);
    updates[field] = next;
    history.push({
      field,
      oldValue: food[field] == null ? null : String(food[field]),
      newValue: next == null ? null : String(next),
    });
  }

  // Alternate servings is an array, tracked as one JSON history entry.
  const nextAlt = changes.alternateServings;
  if (nextAlt !== undefined && JSON.stringify(nextAlt) !== JSON.stringify(food.alternateServings)) {
    changedFields.push("alternateServings");
    updates.alternateServings = nextAlt;
    history.push({
      field: "alternateServings",
      oldValue: JSON.stringify(food.alternateServings),
      newValue: JSON.stringify(nextAlt),
    });
  }

  if (changedFields.length === 0) return { changedFields };

  await db
    .update(foods)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(foods.id, food.id));

  await db.insert(foodEditHistory).values(
    history.map((entry) => ({
      foodId: food.id,
      editedByUserId,
      fieldChanged: entry.field,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
    })),
  );

  return { changedFields };
}
