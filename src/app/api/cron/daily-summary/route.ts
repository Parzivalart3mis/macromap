import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { addDaysISO, zonedDateHour } from "@/lib/dates";
import { db } from "@/lib/db";
import { profiles, users } from "@/lib/db/schema";
import { ensureDaySummary } from "@/lib/diary/summary-service";

export const maxDuration = 60;

// Hourly cron (cron-job.org): writes each user's end-of-day summary so it is
// waiting by midnight. In the user's 11 PM hour it summarizes the day that is
// ending; every run also re-checks yesterday, which picks up anything logged
// after the 11 PM pass (or a missed run). Unchanged days cost no AI call —
// ensureDaySummary compares the diary against the saved fingerprint.
// Authenticated by CRON_SECRET via the Authorization header.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({ userId: users.id, timezone: profiles.timezone })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id));

  const now = new Date();
  let summarized = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    const { date, hour } = zonedDateHour(row.timezone ?? "UTC", now);
    const dates = hour === 23 ? [date, addDaysISO(date, -1)] : [addDaysISO(date, -1)];
    for (const target of dates) {
      try {
        if (await ensureDaySummary(row.userId, target)) summarized += 1;
        else skipped += 1;
      } catch (error) {
        failed += 1;
        console.error("daily-summary", target, error);
      }
    }
  }

  return NextResponse.json({ ok: true, users: rows.length, summarized, skipped, failed });
}
