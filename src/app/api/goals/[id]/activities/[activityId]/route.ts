import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { goalActivities, goalProfiles } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import { updateGoalActivitySchema } from "@/lib/validations/goals";

/** Confirms the activity belongs to a profile the caller owns. */
async function requireOwnedActivity(userId: string, profileId: string, activityId: string) {
  const [row] = await db
    .select({ id: goalActivities.id })
    .from(goalActivities)
    .innerJoin(goalProfiles, eq(goalProfiles.id, goalActivities.goalProfileId))
    .where(
      and(
        eq(goalActivities.id, activityId),
        eq(goalActivities.goalProfileId, profileId),
        eq(goalProfiles.userId, userId),
      ),
    )
    .limit(1);
  if (!row) throw new ApiError("not_found", "Activity not found", 404);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> },
) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const { id, activityId } = await params;
    await requireOwnedActivity(userId, id, activityId);
    const input = await parseBody(request, updateGoalActivitySchema);

    const [activity] = await db
      .update(goalActivities)
      .set(input)
      .where(eq(goalActivities.id, activityId))
      .returning();
    return NextResponse.json({ activity });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> },
) {
  try {
    const userId = await requireDbUser();
    const { id, activityId } = await params;
    await requireOwnedActivity(userId, id, activityId);
    await db.delete(goalActivities).where(eq(goalActivities.id, activityId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
