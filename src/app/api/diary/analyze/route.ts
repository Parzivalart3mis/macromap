import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { previewDaySummary } from "@/lib/diary/summary-service";
import { enforceRateLimit } from "@/lib/rate-limit";

const analyzeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
});

export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("aiParse", userId);
    const { date } = await parseBody(request, analyzeSchema);
    const summary = await previewDaySummary(userId, date);
    return NextResponse.json({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
