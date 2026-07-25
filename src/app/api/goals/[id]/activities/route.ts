import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { goalActivities, goalProfiles } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createGoalActivitySchema } from "@/lib/validations/goals";

/** Confirms the profile exists and belongs to the caller. */
async function requireOwnedProfile(userId: string, profileId: string) {
  const [row] = await db
    .select({ id: goalProfiles.id })
    .from(goalProfiles)
    .where(and(eq(goalProfiles.id, profileId), eq(goalProfiles.userId, userId)))
    .limit(1);
  if (!row) throw new ApiError("not_found", "Goal profile not found", 404);
}

/** Adds a recurring activity to a goal profile. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const { id } = await params;
    await requireOwnedProfile(userId, id);
    const input = await parseBody(request, createGoalActivitySchema);

    const [activity] = await db
      .insert(goalActivities)
      .values({ goalProfileId: id, ...input })
      .returning();
    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
