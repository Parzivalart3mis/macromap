import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { customStoreOrderItems, customStoreOrders, stores } from "@/lib/db/schema";
import { computeOrderSnapshot } from "@/lib/stores/order-nutrition";
import { createCustomOrderSchema } from "@/lib/validations/stores";

async function requireOwnedOrder(userId: string, slug: string, orderId: string) {
  const [store] = await db.select().from(stores).where(eq(stores.slug, slug)).limit(1);
  if (!store) throw new ApiError("not_found", "Store not found", 404);
  const [order] = await db
    .select()
    .from(customStoreOrders)
    .where(
      and(
        eq(customStoreOrders.id, orderId),
        eq(customStoreOrders.userId, userId),
        eq(customStoreOrders.storeId, store.id),
      ),
    )
    .limit(1);
  if (!order) throw new ApiError("not_found", "Saved build not found", 404);
  return { store, order };
}

/** Replace a saved build's name and ingredients (nutrition recomputed). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; orderId: string }> },
) {
  try {
    const userId = await requireDbUser();
    const { slug, orderId } = await params;
    const { store } = await requireOwnedOrder(userId, slug, orderId);
    const input = await parseBody(request, createCustomOrderSchema);

    const nutritionSnapshotJson = await computeOrderSnapshot(store.id, input.items);

    await db
      .update(customStoreOrders)
      .set({ name: input.name, nutritionSnapshotJson })
      .where(eq(customStoreOrders.id, orderId));

    // neon-http has no transactions; replace items as two sequential statements.
    await db
      .delete(customStoreOrderItems)
      .where(eq(customStoreOrderItems.customStoreOrderId, orderId));
    await db.insert(customStoreOrderItems).values(
      input.items.map((item) => ({
        customStoreOrderId: orderId,
        ingredientFoodId: item.ingredientFoodId,
        quantity: item.quantity,
      })),
    );

    const [order] = await db
      .select()
      .from(customStoreOrders)
      .where(eq(customStoreOrders.id, orderId))
      .limit(1);
    return NextResponse.json({ order });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; orderId: string }> },
) {
  try {
    const userId = await requireDbUser();
    const { slug, orderId } = await params;
    await requireOwnedOrder(userId, slug, orderId);
    await db.delete(customStoreOrders).where(eq(customStoreOrders.id, orderId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
