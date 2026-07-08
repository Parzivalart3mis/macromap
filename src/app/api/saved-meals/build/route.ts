import { NextResponse } from "next/server";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { savedMeals } from "@/lib/db/schema";
import { buildMealSnapshot } from "@/lib/meals/snapshot";
import { enforceRateLimit } from "@/lib/rate-limit";
import { buildSavedMealSchema } from "@/lib/validations/diary";

/** Creates a saved meal from picked foods (the Create-a-Meal builder). */
export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const input = await parseBody(request, buildSavedMealSchema);

    const snapshot = await buildMealSnapshot(input.items);

    const [saved] = await db
      .insert(savedMeals)
      .values({
        userId,
        name: input.name,
        directions: input.directions?.trim() || null,
        entriesSnapshotJson: snapshot,
      })
      .returning();
    return NextResponse.json({ savedMeal: saved }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
