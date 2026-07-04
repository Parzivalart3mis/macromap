import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { analyzeDiaryDay } from "@/lib/ai/daily-insights";
import { getDiaryPayload } from "@/lib/diary/service";
import { enforceRateLimit } from "@/lib/rate-limit";

const analyzeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
});

export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("aiParse", userId);
    const { date } = await parseBody(request, analyzeSchema);
    const payload = await getDiaryPayload(userId, date);
    const insights = await analyzeDiaryDay(payload);
    return NextResponse.json({ insights });
  } catch (error) {
    return handleApiError(error);
  }
}
