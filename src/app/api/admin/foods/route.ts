import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, parseBody, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { foods, storeIngredients, storeMenuItems, stores } from "@/lib/db/schema";
import { findSimilarFoods } from "@/lib/foods/service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { adminCreateFoodSchema } from "@/lib/validations/foods";

/**
 * Creates a catalogue entry: verified, and optionally placed on a chain store's
 * menu or in its build-your-own picker. The member route next door hardcodes
 * isVerified to false and cannot touch a store at all — this is the admin's
 * counterpart, which is why it is a separate route rather than a flag.
 */
export async function POST(request: Request) {
  try {
    const userId = await requireAdmin();
    await enforceRateLimit("foodCreate", userId);
    const input = await parseBody(request, adminCreateFoodSchema);

    // A barcode identifies a package exactly, so a clash is a duplicate even
    // when the names differ — checked before the fuzzy name match.
    if (input.barcode) {
      const [clash] = await db
        .select({ id: foods.id, name: foods.name, brandName: foods.brandName })
        .from(foods)
        .where(eq(foods.barcode, input.barcode))
        .limit(1);
      if (clash && !input.forceCreate) {
        return NextResponse.json({ status: "barcode_taken", existing: clash });
      }
    }

    if (!input.forceCreate) {
      const similarFoods = await findSimilarFoods(input.name, input.brandName);
      if (similarFoods.length > 0) {
        return NextResponse.json({ status: "duplicate_warning", similarFoods });
      }
    }

    const { forceCreate: _f, store, isVerified, ...foodFields } = input;

    if (store) {
      const [exists] = await db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.id, store.storeId))
        .limit(1);
      if (!exists) throw new ApiError("not_found", "No such store", 404);
    }

    const [created] = await db
      .insert(foods)
      .values({
        ...foodFields,
        // Catalogue entries are the store's or the brand's, not the admin's
        // own cooking, so they are not attributed to a user.
        sourceType: "official_store",
        createdByUserId: null,
        isVerified,
      })
      .returning({ id: foods.id });

    // neon-http has no transactions, so the placement follows the insert and
    // is reported separately rather than rolled back.
    if (store) {
      if (store.placement === "builder") {
        await db.insert(storeIngredients).values({
          storeId: store.storeId,
          foodId: created.id,
          ingredientGroup: store.ingredientGroup ?? store.menuCategory,
          isDefaultSelected: false,
        });
      } else {
        // Append to the end of the store's list.
        const [{ next }] = await db
          .select({ next: sql<number>`coalesce(max(${storeMenuItems.displayOrder}), -1) + 1` })
          .from(storeMenuItems)
          .where(eq(storeMenuItems.storeId, store.storeId));
        await db.insert(storeMenuItems).values({
          storeId: store.storeId,
          foodId: created.id,
          menuCategory: store.menuCategory,
          displayOrder: next,
          isDefaultVerified: true,
        });
      }
    }

    return NextResponse.json(
      { status: "created", foodId: created.id, placed: store?.placement ?? null },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/** Existing menu categories and ingredient groups, to steer the admin's picker. */
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const storeId = new URL(request.url).searchParams.get("storeId");
    if (!storeId) throw new ApiError("invalid_request", "storeId is required", 400);
    const [menu, builder] = await Promise.all([
      db
        .selectDistinct({ value: storeMenuItems.menuCategory })
        .from(storeMenuItems)
        .where(eq(storeMenuItems.storeId, storeId)),
      db
        .selectDistinct({ value: storeIngredients.ingredientGroup })
        .from(storeIngredients)
        .where(and(eq(storeIngredients.storeId, storeId))),
    ]);
    return NextResponse.json({
      menuCategories: menu.map((r) => r.value).sort(),
      ingredientGroups: builder.map((r) => r.value).sort(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
