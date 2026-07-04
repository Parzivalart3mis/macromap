import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { storeThemeTokens, stores } from "@/lib/db/schema";

export async function GET() {
  try {
    await requireUserId();
    const rows = await db
      .select({ store: stores, theme: storeThemeTokens })
      .from(stores)
      .leftJoin(storeThemeTokens, eq(storeThemeTokens.storeId, stores.id))
      .where(eq(stores.isActive, true))
      .orderBy(asc(stores.name));
    return NextResponse.json({
      stores: rows.map(({ store, theme }) => ({ ...store, theme })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
