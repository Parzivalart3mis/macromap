import { NextResponse } from "next/server";

import { ApiError, handleApiError, parseBody, requireDbUser, requireUserId } from "@/lib/api";
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
