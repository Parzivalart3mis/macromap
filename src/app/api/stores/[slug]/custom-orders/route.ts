import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, parseBody, requireDbUser, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { customStoreOrderItems, customStoreOrders, stores } from "@/lib/db/schema";
import { computeOrderSnapshot } from "@/lib/stores/order-nutrition";
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

    // Attach each order's items so the builder can reload a saved build.
    const itemRows = orders.length
      ? await db
          .select()
          .from(customStoreOrderItems)
          .where(
            inArray(
              customStoreOrderItems.customStoreOrderId,
              orders.map((order) => order.id),
            ),
          )
      : [];

    return NextResponse.json({
      orders: orders.map((order) => ({
        ...order,
        items: itemRows
          .filter((item) => item.customStoreOrderId === order.id)
          .map((item) => ({
            ingredientFoodId: item.ingredientFoodId,
            quantity: item.quantity,
          })),
      })),
    });
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

    const nutritionSnapshotJson = await computeOrderSnapshot(store.id, input.items);

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
