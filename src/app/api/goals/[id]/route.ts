import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { goalDays, goalProfiles } from "@/lib/db/schema";
import { updateGoalProfileSchema } from "@/lib/validations/goals";

async function requireOwnedProfile(userId: string, id: string) {
  const [profile] = await db
    .select()
    .from(goalProfiles)
    .where(and(eq(goalProfiles.id, id), eq(goalProfiles.userId, userId)))
    .limit(1);
  if (!profile) throw new ApiError("not_found", "Goal profile not found", 404);
  return profile;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireDbUser();
    const { id } = await params;
    const profile = await requireOwnedProfile(userId, id);
    const input = await parseBody(request, updateGoalProfileSchema);

    if (input.name && input.name !== profile.name) {
      await db
        .update(goalProfiles)
        .set({ name: input.name })
        .where(eq(goalProfiles.id, id));
    }

    if (input.days) {
      const seenDays = new Set(input.days.map((day) => day.dayOfWeek));
      if (seenDays.size !== 7) {
        throw new ApiError("invalid_request", "days must cover all 7 days of week", 400);
      }
      const phase = input.phase ?? "maintenance";
      // neon-http has no transactions; replace is two sequential statements.
      // Scoped to the one phase — an unscoped delete would wipe the other three.
      await db
        .delete(goalDays)
        .where(and(eq(goalDays.goalProfileId, id), eq(goalDays.phase, phase)));
      await db
        .insert(goalDays)
        .values(input.days.map((day) => ({ goalProfileId: id, phase, ...day })));
    }

    if (input.activePhase && input.activePhase !== profile.activePhase) {
      // Refuse to switch into a phase with no table behind it, which would
      // leave the diary with no targets at all.
      const [row] = await db
        .select({ id: goalDays.id })
        .from(goalDays)
        .where(and(eq(goalDays.goalProfileId, id), eq(goalDays.phase, input.activePhase)))
        .limit(1);
      if (!row) {
        throw new ApiError(
          "invalid_request",
          "That phase has no targets set up yet. Add its 7 days first.",
          400,
        );
      }
      await db
        .update(goalProfiles)
        .set({ activePhase: input.activePhase })
        .where(eq(goalProfiles.id, id));
    }

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
    await requireOwnedProfile(userId, id);
    await db.delete(goalProfiles).where(eq(goalProfiles.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
