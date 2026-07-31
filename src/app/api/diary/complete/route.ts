import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { analyzeDiaryDay } from "@/lib/ai/daily-insights";
import { db } from "@/lib/db";
import { diaryDays } from "@/lib/db/schema";
import { getDiaryPayload, getOrCreateDiaryDay } from "@/lib/diary/service";
import { enforceRateLimit } from "@/lib/rate-limit";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const completeSchema = z.object({ date: z.string().regex(DATE, "Use YYYY-MM-DD") });

/**
 * Mark a day "complete" and generate + save its AI analysis. Idempotent — a
 * re-run refreshes the analysis but keeps the original completion time.
 */
export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("aiParse", userId);
    const { date } = await parseBody(request, completeSchema);

    const day = await getOrCreateDiaryDay(userId, date);
    const payload = await getDiaryPayload(userId, date);
    const insights = await analyzeDiaryDay(payload);

    await db
      .update(diaryDays)
      .set({ analysisJson: insights, completedAt: day.completedAt ?? new Date() })
      .where(eq(diaryDays.id, day.id));

    return NextResponse.json({ insights });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Mark a day incomplete again (keeps the last saved analysis, just hidden). */
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
