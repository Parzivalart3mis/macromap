import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { customStoreOrders, stores } from "@/lib/db/schema";
import { computePizzaSnapshot } from "@/lib/stores/pizza-nutrition";
import { buildPizzaOrderSchema } from "@/lib/validations/stores";

/**
 * Save a built pizza as a custom store order. The snapshot is the WHOLE pizza,
 * computed server-side from the config + selections; the caller logs a slice
 * fraction of it via /api/diary/entries (servingMultiplier = 1 / slicesPerPizza).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const userId = await requireDbUser();
    const { slug } = await params;
    const [store] = await db.select().from(stores).where(eq(stores.slug, slug)).limit(1);
    if (!store) throw new ApiError("not_found", "Store not found", 404);

    const input = await parseBody(request, buildPizzaOrderSchema);
    const { snapshot, slicesPerPizza } = await computePizzaSnapshot(store.id, input);

    const [order] = await db
      .insert(customStoreOrders)
      .values({
        userId,
        storeId: store.id,
        name: input.name,
        baseMenuItemId: null,
        nutritionSnapshotJson: snapshot,
      })
      .returning();

    return NextResponse.json({ order, slicesPerPizza }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
