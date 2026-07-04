import { NextResponse } from "next/server";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { foods } from "@/lib/db/schema";
import { findSimilarFoods } from "@/lib/foods/service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createFoodSchema } from "@/lib/validations/foods";

export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("foodCreate", userId);
    const input = await parseBody(request, createFoodSchema);

    if (!input.forceCreate) {
      const similarFoods = await findSimilarFoods(input.name, input.brandName);
      if (similarFoods.length > 0) {
        return NextResponse.json({ status: "duplicate_warning", similarFoods });
      }
    }

    const { forceCreate: _forceCreate, ...foodFields } = input;
    const [created] = await db
      .insert(foods)
      .values({
        ...foodFields,
        sourceType: "user_created",
        createdByUserId: userId,
        isVerified: false,
      })
      .returning({ id: foods.id });

    return NextResponse.json({ status: "created", foodId: created.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
