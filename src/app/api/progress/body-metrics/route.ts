import { NextResponse } from "next/server";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { bodyMetricLogs } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import { pushToIronLog } from "@/lib/iron-log-sync";
import { logBodyMetricsSchema } from "@/lib/validations/progress";

export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const input = await parseBody(request, logBodyMetricsSchema);
    const [log] = await db
      .insert(bodyMetricLogs)
      .values({
        userId,
        date: input.date,
        bodyFatPct: input.bodyFatPct ?? null,
        waistCm: input.waistCm ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    // Iron Log has no waist field — only body fat and notes carry over.
    await pushToIronLog(userId, {
      date: input.date,
      bodyFatPct: input.bodyFatPct,
      notes: input.notes,
    });
    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
