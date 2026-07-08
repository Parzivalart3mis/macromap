import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, requireDbUser, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { savedMeals } from "@/lib/db/schema";

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
