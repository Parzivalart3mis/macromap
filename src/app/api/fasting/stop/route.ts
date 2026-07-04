import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { fastingSessions } from "@/lib/db/schema";

export async function POST() {
  try {
    const userId = await requireDbUser();
    const [active] = await db
      .select()
      .from(fastingSessions)
      .where(and(eq(fastingSessions.userId, userId), isNull(fastingSessions.endAt)))
      .limit(1);
    if (!active) {
      throw new ApiError("not_found", "No fast in progress", 404);
    }
    const endAt = new Date();
    const durationMinutes = Math.max(
      0,
      Math.round((endAt.getTime() - active.startAt.getTime()) / 60_000),
    );
    const [session] = await db
      .update(fastingSessions)
      .set({ endAt, durationMinutes })
      .where(eq(fastingSessions.id, active.id))
      .returning();
    return NextResponse.json({ session });
  } catch (error) {
    return handleApiError(error);
  }
}
