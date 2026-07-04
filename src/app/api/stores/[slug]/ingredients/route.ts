import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { foods, storeIngredients, stores } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireUserId();
    const { slug } = await params;
    const [store] = await db.select().from(stores).where(eq(stores.slug, slug)).limit(1);
    if (!store) throw new ApiError("not_found", "Store not found", 404);

    const rows = await db
      .select({ ingredient: storeIngredients, food: foods })
      .from(storeIngredients)
      .innerJoin(foods, eq(foods.id, storeIngredients.foodId))
      .where(eq(storeIngredients.storeId, store.id))
      .orderBy(asc(storeIngredients.ingredientGroup), asc(foods.name));

    return NextResponse.json({
      ingredients: rows.map(({ ingredient, food }) => ({
        id: ingredient.id,
        ingredientGroup: ingredient.ingredientGroup,
        isDefaultSelected: ingredient.isDefaultSelected,
        food,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
