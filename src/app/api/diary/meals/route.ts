import { NextResponse } from "next/server";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { getOrCreateDiaryDay, getOrCreateMeal } from "@/lib/diary/service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createDiaryMealSchema } from "@/lib/validations/diary";

/** Creates a custom meal bucket (e.g. "Pre-workout") for a given day. */
export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const input = await parseBody(request, createDiaryMealSchema);
    const day = await getOrCreateDiaryDay(userId, input.date);
    const meal = await getOrCreateMeal(day.id, input.mealName);
    return NextResponse.json({ meal }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
