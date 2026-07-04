import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { foods } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import { nutritionFieldsSchema } from "@/lib/validations/foods";

const importFoodSchema = nutritionFieldsSchema.extend({
  source: z.enum(["usda", "open_food_facts"]),
  name: z.string().min(1).max(200),
  brandName: z.string().max(100).nullish(),
  barcode: z.string().min(8).max(32).nullish(),
  servingSizeValue: z.number().positive(),
  servingSizeUnit: z.string().min(1).max(20),
});

/**
 * Persists an external search result (USDA / Open Food Facts) into the shared
 * food database so it can be logged and reused by everyone.
 */
export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("foodCreate", userId);
    const input = await parseBody(request, importFoodSchema);

    // Same barcode already imported (possibly by someone else)? Reuse it.
    if (input.barcode) {
      const [existing] = await db
        .select()
        .from(foods)
        .where(eq(foods.barcode, input.barcode))
        .limit(1);
      if (existing) {
        return NextResponse.json({ food: existing, existed: true });
      }
    }

    const { source, barcode, brandName, ...fields } = input;
    const [created] = await db
      .insert(foods)
      .values({
        ...fields,
        brandName: brandName ?? null,
        barcode: barcode ?? null,
        sourceType: source === "usda" ? "barcode_api" : "open_food_facts",
        createdByUserId: userId,
        isVerified: false,
      })
      .returning();

    return NextResponse.json({ food: created, existed: false }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
