import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { storeMenuItems, storeThemeTokens, stores } from "@/lib/db/schema";

export async function GET() {
  try {
    await requireUserId();
    const [rows, counts] = await Promise.all([
      db
        .select({ store: stores, theme: storeThemeTokens })
        .from(stores)
        .leftJoin(storeThemeTokens, eq(storeThemeTokens.storeId, stores.id))
        .where(eq(stores.isActive, true))
        .orderBy(asc(stores.name)),
      db
        .select({
          storeId: storeMenuItems.storeId,
          count: sql<number>`count(*)::int`,
        })
        .from(storeMenuItems)
        .groupBy(storeMenuItems.storeId),
    ]);
    const countByStore = new Map(counts.map((row) => [row.storeId, row.count]));
    return NextResponse.json({
      stores: rows.map(({ store, theme }) => ({
        ...store,
        theme,
        menuItemCount: countByStore.get(store.id) ?? 0,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
