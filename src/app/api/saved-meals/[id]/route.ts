import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, parseBody, requireDbUser, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { savedMeals } from "@/lib/db/schema";
import { buildMealSnapshot } from "@/lib/meals/snapshot";
import { enforceRateLimit } from "@/lib/rate-limit";
import { buildSavedMealSchema } from "@/lib/validations/diary";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const [savedMeal] = await db
      .select()
      .from(savedMeals)
      .where(and(eq(savedMeals.id, id), eq(savedMeals.userId, userId)))
      .limit(1);
    if (!savedMeal) throw new ApiError("not_found", "Saved meal not found", 404);
    return NextResponse.json({ savedMeal });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Replaces a saved meal's name, directions, and items (the edit flow). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const { id } = await params;
    const input = await parseBody(request, buildSavedMealSchema);

    const [existing] = await db
      .select({ id: savedMeals.id })
      .from(savedMeals)
      .where(and(eq(savedMeals.id, id), eq(savedMeals.userId, userId)))
      .limit(1);
    if (!existing) throw new ApiError("not_found", "Saved meal not found", 404);

    const snapshot = await buildMealSnapshot(input.items);
    await db
      .update(savedMeals)
      .set({
        name: input.name,
        directions: input.directions?.trim() || null,
        entriesSnapshotJson: snapshot,
      })
      .where(eq(savedMeals.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireDbUser();
    const { id } = await params;
    const [deleted] = await db
      .delete(savedMeals)
      .where(and(eq(savedMeals.id, id), eq(savedMeals.userId, userId)))
      .returning({ id: savedMeals.id });
    if (!deleted) throw new ApiError("not_found", "Saved meal not found", 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
