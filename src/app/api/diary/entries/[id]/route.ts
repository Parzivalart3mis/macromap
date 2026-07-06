import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { diaryDays, diaryEntries, diaryMeals } from "@/lib/db/schema";
import { getOrCreateMeal } from "@/lib/diary/service";
import { roundNutrition, scaleNutrition } from "@/lib/nutrition";
import { enforceRateLimit } from "@/lib/rate-limit";
import { updateDiaryEntrySchema } from "@/lib/validations/diary";
import type { NutritionSnapshot } from "@/types/nutrition";

async function requireOwnedEntry(userId: string, entryId: string) {
  const [row] = await db
    .select({ entry: diaryEntries, meal: diaryMeals, day: diaryDays })
    .from(diaryEntries)
    .innerJoin(diaryMeals, eq(diaryMeals.id, diaryEntries.diaryMealId))
    .innerJoin(diaryDays, eq(diaryDays.id, diaryMeals.diaryDayId))
    .where(and(eq(diaryEntries.id, entryId), eq(diaryDays.userId, userId)))
    .limit(1);
  if (!row) throw new ApiError("not_found", "Diary entry not found", 404);
  return row;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const { id } = await params;
    const input = await parseBody(request, updateDiaryEntrySchema);
    const { entry, day } = await requireOwnedEntry(userId, id);

    const quantity = input.quantity ?? entry.quantity;
    const servingMultiplier = input.servingMultiplier ?? entry.servingMultiplier;
    const updates: Partial<typeof diaryEntries.$inferInsert> = {
      quantity,
      servingMultiplier,
    };

    if (input.eatenTime !== undefined) updates.eatenTime = input.eatenTime;

    if (input.quantity != null || input.servingMultiplier != null) {
      // Rescale from the stored snapshot so history stays immutable even if
      // the underlying shared food was edited since logging.
      const oldFactor = entry.quantity * entry.servingMultiplier;
      const newFactor = quantity * servingMultiplier;
      const ratio = newFactor / oldFactor;
      const { label, serving, ...nutrition } = entry.nutritionSnapshotJson;
      const rescaled = roundNutrition(
        scaleNutrition(nutrition as NutritionSnapshot, ratio),
      );
      // Scale the "2 ml"-style serving text's amount to match the new quantity.
      const nextServing = serving?.replace(
        /^\s*([\d.]+)/,
        (_, num: string) => `${Math.round(Number(num) * ratio * 100) / 100}`,
      );
      updates.nutritionSnapshotJson = { ...rescaled, label, serving: nextServing };
    }

    if (input.mealName) {
      const meal = await getOrCreateMeal(day.id, input.mealName);
      updates.diaryMealId = meal.id;
    }

    const [updated] = await db
      .update(diaryEntries)
      .set(updates)
      .where(eq(diaryEntries.id, id))
      .returning();
    return NextResponse.json({ entry: updated });
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
    await requireOwnedEntry(userId, id);
    await db.delete(diaryEntries).where(eq(diaryEntries.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
