import { and, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, handleApiError, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { diaryDays, goalProfiles } from "@/lib/db/schema";

// The client sends its own local date: diary days are keyed to the user's
// calendar, which the server cannot infer from a timestamp.
const activateSchema = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireDbUser();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { today } = activateSchema.parse(body ?? {});
    const [profile] = await db
      .select()
      .from(goalProfiles)
      .where(and(eq(goalProfiles.id, id), eq(goalProfiles.userId, userId)))
      .limit(1);
    if (!profile) throw new ApiError("not_found", "Goal profile not found", 404);

    await db
      .update(goalProfiles)
      .set({ isActive: false })
      .where(eq(goalProfiles.userId, userId));
    await db.update(goalProfiles).set({ isActive: true }).where(eq(goalProfiles.id, id));

    // A day pins its goal profile when first logged, so already-created days
    // would keep the old targets. Re-pin today and anything later; past days
    // keep the plan that was actually in effect, so history stays honest.
    let repinnedDays = 0;
    if (today) {
      const rows = await db
        .update(diaryDays)
        .set({ goalProfileId: id })
        .where(and(eq(diaryDays.userId, userId), gte(diaryDays.date, today)))
        .returning({ id: diaryDays.id });
      repinnedDays = rows.length;
    }

    return NextResponse.json({ ok: true, repinnedDays });
  } catch (error) {
    return handleApiError(error);
  }
}
