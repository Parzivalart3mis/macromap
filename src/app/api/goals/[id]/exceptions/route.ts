import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { goalActivities, goalActivityExceptions, goalProfiles } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createGoalExceptionSchema } from "@/lib/validations/goals";

async function requireOwnedProfile(userId: string, profileId: string) {
  const [row] = await db
    .select({ id: goalProfiles.id })
    .from(goalProfiles)
    .where(and(eq(goalProfiles.id, profileId), eq(goalProfiles.userId, userId)))
    .limit(1);
  if (!row) throw new ApiError("not_found", "Goal profile not found", 404);
}

/**
 * Create a date-specific exception. skip/override target one activity for one
 * date (replacing any existing exception on that activity+date); oneoff adds an
 * ad-hoc adjustment.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const { id } = await params;
    await requireOwnedProfile(userId, id);
    const input = await parseBody(request, createGoalExceptionSchema);

    if (input.activityId) {
      // Confirm the activity belongs to this profile.
      const [activity] = await db
        .select({ id: goalActivities.id })
        .from(goalActivities)
        .where(
          and(eq(goalActivities.id, input.activityId), eq(goalActivities.goalProfileId, id)),
        )
        .limit(1);
      if (!activity) throw new ApiError("not_found", "Activity not found", 404);
      // One exception per activity+date — replace whatever was there.
      await db
        .delete(goalActivityExceptions)
        .where(
          and(
            eq(goalActivityExceptions.activityId, input.activityId),
            eq(goalActivityExceptions.date, input.date),
          ),
        );
    }

    const [exception] = await db
      .insert(goalActivityExceptions)
      .values({
        goalProfileId: id,
        activityId: input.activityId ?? null,
        date: input.date,
        kind: input.kind,
        label: input.label ?? null,
        deltaCarbsG: input.deltaCarbsG ?? null,
        deltaProteinG: input.deltaProteinG ?? null,
        deltaFatG: input.deltaFatG ?? null,
      })
      .returning();
    return NextResponse.json({ exception }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
