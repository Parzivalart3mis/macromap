import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, parseBody, requireDbUser, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { foods } from "@/lib/db/schema";
import { applyFoodEdit, getFoodById } from "@/lib/foods/service";
import { updateFoodSchema } from "@/lib/validations/foods";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUserId();
    const { id } = await params;
    const food = await getFoodById(id);
    if (!food) throw new ApiError("not_found", "Food not found", 404);
    return NextResponse.json({ food });
  } catch (error) {
    return handleApiError(error);
  }
}

// Shared database is open-write: any signed-in user may edit, every change is
// recorded in food_edit_history.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireDbUser();
    const { id } = await params;
    const food = await getFoodById(id);
    if (!food) throw new ApiError("not_found", "Food not found", 404);
    const input = await parseBody(request, updateFoodSchema);
    const { changedFields } = await applyFoodEdit(food, input, userId);
    const updated = changedFields.length > 0 ? await getFoodById(id) : food;
    return NextResponse.json({ food: updated, changedFields });
  } catch (error) {
    return handleApiError(error);
  }
}

// Only the creator may delete their own food. Diary entries keep their
// immutable snapshots (food_id is set null); official store items have no
// creator and so can never be deleted here.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireDbUser();
    const { id } = await params;
    const food = await getFoodById(id);
    if (!food) throw new ApiError("not_found", "Food not found", 404);
    if (food.createdByUserId !== userId) {
      throw new ApiError("forbidden", "You can only delete foods you created", 403);
    }
    await db.delete(foods).where(eq(foods.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
