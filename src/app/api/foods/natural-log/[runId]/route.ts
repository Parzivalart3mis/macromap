import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { aiLoggingRuns } from "@/lib/db/schema";

/** Marks a natural-language run as accepted once the user logs its suggestions. */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const userId = await requireUserId();
    const { runId } = await params;
    await db
      .update(aiLoggingRuns)
      .set({ accepted: true })
      .where(and(eq(aiLoggingRuns.id, runId), eq(aiLoggingRuns.userId, userId)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
