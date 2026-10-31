import { and, desc, eq, gte, lt, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { addDaysISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { diaryDays, diaryEntries, diaryMeals, profiles } from "@/lib/db/schema";
import { ensureDaySummary } from "@/lib/diary/summary-service";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const recapSchema = z.object({
  today: z.string().regex(DATE, "Use YYYY-MM-DD"),
  timeZone: z.string().max(64).optional(),
});

/** How far back the first-open recap looks for the last logged day. */
const LOOKBACK_DAYS = 7;

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * The summary of the last logged day before `today`, for the app's first open
 * of the day. Generates it when the end-of-day cron hasn't (or the day changed
 * since), so the recap works even without the cron. Also keeps the profile's
 * timezone in step with the device, since that is what the cron runs on.
 */
export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    const { today, timeZone } = await parseBody(request, recapSchema);

    if (timeZone && isTimeZone(timeZone)) {
      await db
        .insert(profiles)
        .values({ userId, timezone: timeZone })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: { timezone: timeZone },
          setWhere: ne(profiles.timezone, timeZone),
        });
    }

    const [last] = await db
      .selectDistinct({ date: diaryDays.date })
      .from(diaryDays)
      .innerJoin(diaryMeals, eq(diaryMeals.diaryDayId, diaryDays.id))
      .innerJoin(diaryEntries, eq(diaryEntries.diaryMealId, diaryMeals.id))
      .where(
        and(
          eq(diaryDays.userId, userId),
          lt(diaryDays.date, today),
          gte(diaryDays.date, addDaysISO(today, -LOOKBACK_DAYS)),
        ),
      )
      .orderBy(desc(diaryDays.date))
      .limit(1);
    if (!last) return NextResponse.json({ date: null, summary: null });

    const summary = await ensureDaySummary(userId, last.date);
    return NextResponse.json({ date: last.date, summary });
  } catch (error) {
    return handleApiError(error);
  }
}
