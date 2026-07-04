import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { storeMenuItems, storeThemeTokens, stores } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireUserId();
    const { slug } = await params;
    const [store] = await db.select().from(stores).where(eq(stores.slug, slug)).limit(1);
    if (!store || !store.isActive) {
      throw new ApiError("not_found", "Store not found", 404);
    }
    const [theme] = await db
      .select()
      .from(storeThemeTokens)
      .where(eq(storeThemeTokens.storeId, store.id))
      .limit(1);
    const categoryRows = await db
      .selectDistinct({ menuCategory: storeMenuItems.menuCategory })
      .from(storeMenuItems)
      .where(eq(storeMenuItems.storeId, store.id))
      .orderBy(asc(storeMenuItems.menuCategory));
    return NextResponse.json({
      store,
      theme: theme ?? null,
      categories: categoryRows.map((row) => row.menuCategory),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
