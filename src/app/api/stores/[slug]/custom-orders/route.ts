import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, parseBody, requireDbUser, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import {
  customStoreOrderItems,
  customStoreOrders,
  foods,
  storeIngredients,
  stores,
} from "@/lib/db/schema";
import { foodToNutrition, roundNutrition, scaleNutrition, sumNutrition } from "@/lib/nutrition";
import { createCustomOrderSchema } from "@/lib/validations/stores";

async function getStore(slug: string) {
  const [store] = await db.select().from(stores).where(eq(stores.slug, slug)).limit(1);
  if (!store) throw new ApiError("not_found", "Store not found", 404);
  return store;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const userId = await requireUserId();
    const { slug } = await params;
    const store = await getStore(slug);
    const orders = await db
      .select()
      .from(customStoreOrders)
      .where(
        and(eq(customStoreOrders.userId, userId), eq(customStoreOrders.storeId, store.id)),
      )
      .orderBy(desc(customStoreOrders.createdAt));
    return NextResponse.json({ orders });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const userId = await requireDbUser();
    const { slug } = await params;
    const store = await getStore(slug);
    const input = await parseBody(request, createCustomOrderSchema);

    // Only ingredients that belong to this store may be used, and nutrition is
    // computed server-side so the snapshot can't be forged.
    const foodIds = [...new Set(input.items.map((item) => item.ingredientFoodId))];
    const validIngredients = await db
      .select({ foodId: storeIngredients.foodId, food: foods })
      .from(storeIngredients)
      .innerJoin(foods, eq(foods.id, storeIngredients.foodId))
      .where(
        and(eq(storeIngredients.storeId, store.id), inArray(storeIngredients.foodId, foodIds)),
      );
    const foodsById = new Map(validIngredients.map((row) => [row.foodId, row.food]));

    const snapshots = input.items.map((item) => {
      const food = foodsById.get(item.ingredientFoodId);
      if (!food) {
        throw new ApiError(
          "invalid_request",
          "One or more ingredients do not belong to this store",
          400,
        );
      }
      return scaleNutrition(foodToNutrition(food), item.quantity);
    });
    const nutritionSnapshotJson = roundNutrition(sumNutrition(snapshots));

    const [order] = await db
      .insert(customStoreOrders)
      .values({
        userId,
        storeId: store.id,
        name: input.name,
        baseMenuItemId: input.baseMenuItemId ?? null,
        nutritionSnapshotJson,
      })
      .returning();

    await db.insert(customStoreOrderItems).values(
      input.items.map((item) => ({
        customStoreOrderId: order.id,
        ingredientFoodId: item.ingredientFoodId,
        quantity: item.quantity,
      })),
    );

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
