import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { ApiError, handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { weightLogs } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import { pushToIronLog } from "@/lib/iron-log-sync";
import { logWeightSchema } from "@/lib/validations/progress";

export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const input = await parseBody(request, logWeightSchema);
    const [log] = await db
      .insert(weightLogs)
      .values({ userId, date: input.date, weightValue: input.weightValue })
      .onConflictDoUpdate({
        target: [weightLogs.userId, weightLogs.date],
        set: { weightValue: input.weightValue },
      })
      .returning();
    await pushToIronLog(userId, { date: input.date, weightKg: input.weightValue });
    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Removes one weigh-in. A mistyped reading used to be permanent — the trend
 * line is a smoothed average, so a single bad figure bends a fortnight of it
 * either side and there was no way to take it back out.
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const date = request.nextUrl.searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ApiError("invalid_request", "date must be YYYY-MM-DD", 400);
    }
    const [deleted] = await db
      .delete(weightLogs)
      .where(and(eq(weightLogs.userId, userId), eq(weightLogs.date, date)))
      .returning();
    if (!deleted) {
      throw new ApiError("not_found", "No weigh-in on that date", 404);
    }
    return NextResponse.json({ deleted });
  } catch (error) {
    return handleApiError(error);
  }
}
