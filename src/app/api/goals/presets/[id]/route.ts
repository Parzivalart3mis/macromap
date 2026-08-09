import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { activityPresets } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import { updateActivityPresetSchema } from "@/lib/validations/goals";

/** Edit a global activity preset. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const { id } = await params;
    const input = await parseBody(request, updateActivityPresetSchema);
    const [preset] = await db
      .update(activityPresets)
      .set(input)
      .where(and(eq(activityPresets.id, id), eq(activityPresets.userId, userId)))
      .returning();
    if (!preset) throw new ApiError("not_found", "Preset not found", 404);
    return NextResponse.json({
      preset: { id: preset.id, name: preset.name, deltaCarbsG: preset.deltaCarbsG },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Delete a global activity preset. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireDbUser();
    const { id } = await params;
    const [preset] = await db
      .delete(activityPresets)
      .where(and(eq(activityPresets.id, id), eq(activityPresets.userId, userId)))
      .returning({ id: activityPresets.id });
    if (!preset) throw new ApiError("not_found", "Preset not found", 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
