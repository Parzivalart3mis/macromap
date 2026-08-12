import { NextResponse } from "next/server";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
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
