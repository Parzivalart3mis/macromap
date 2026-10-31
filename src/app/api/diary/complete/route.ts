import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { diaryDays } from "@/lib/db/schema";
import { ensureDaySummary } from "@/lib/diary/summary-service";
import { enforceRateLimit } from "@/lib/rate-limit";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const completeSchema = z.object({ date: z.string().regex(DATE, "Use YYYY-MM-DD") });

/**
 * Mark a day "complete" and generate + save its summary. Idempotent — a re-run
 * refreshes the summary but keeps the original completion time.
 */
export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("aiParse", userId);
    const { date } = await parseBody(request, completeSchema);

    const summary = await ensureDaySummary(userId, date, { force: true });
    return NextResponse.json({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Mark a day incomplete again (keeps the last saved summary, just hidden). */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireDbUser();
    const date = request.nextUrl.searchParams.get("date") ?? "";
    if (!DATE.test(date)) return NextResponse.json({ ok: true });
    await db
      .update(diaryDays)
      .set({ completedAt: null })
      .where(and(eq(diaryDays.userId, userId), eq(diaryDays.date, date)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
