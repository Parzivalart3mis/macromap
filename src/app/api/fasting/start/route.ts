import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { fastingSessions } from "@/lib/db/schema";

export async function POST() {
  try {
    const userId = await requireDbUser();
    const [active] = await db
      .select({ id: fastingSessions.id })
      .from(fastingSessions)
      .where(and(eq(fastingSessions.userId, userId), isNull(fastingSessions.endAt)))
      .limit(1);
    if (active) {
      throw new ApiError("conflict", "A fast is already in progress", 409);
    }
    const [session] = await db
      .insert(fastingSessions)
      .values({ userId, startAt: new Date() })
      .returning();
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
