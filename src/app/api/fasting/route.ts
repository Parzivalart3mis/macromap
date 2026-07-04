import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { fastingSessions } from "@/lib/db/schema";

export async function GET() {
  try {
    const userId = await requireUserId();
    const sessions = await db
      .select()
      .from(fastingSessions)
      .where(eq(fastingSessions.userId, userId))
      .orderBy(desc(fastingSessions.startAt))
      .limit(50);
    const active = sessions.find((session) => session.endAt === null) ?? null;
    return NextResponse.json({ active, sessions });
  } catch (error) {
    return handleApiError(error);
  }
}
