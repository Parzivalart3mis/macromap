import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { foods, storeMenuItems, stores } from "@/lib/db/schema";

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
      .select({ menuItem: storeMenuItems, food: foods })
      .from(storeMenuItems)
      .innerJoin(foods, eq(foods.id, storeMenuItems.foodId))
      .where(eq(storeMenuItems.storeId, store.id))
      .orderBy(
        asc(storeMenuItems.menuCategory),
        asc(storeMenuItems.displayOrder),
        asc(foods.name),
      );

    return NextResponse.json({
      menu: rows.map(({ menuItem, food }) => ({
        id: menuItem.id,
        menuCategory: menuItem.menuCategory,
        isDefaultVerified: menuItem.isDefaultVerified,
        food,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
