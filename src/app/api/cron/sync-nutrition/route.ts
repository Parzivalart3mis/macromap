import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { getDiaryPayload } from "@/lib/diary/service";
import { pushNutritionToIronLog } from "@/lib/iron-log-sync";
import { addDaysISO } from "@/lib/dates";

// Daily cron (cron-job.org): pushes the previous day's finalized macro totals to
// Iron Log. Runs once each morning so the numbers are stable, not mid-day
// partials. Authenticated by CRON_SECRET via the Authorization header.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = process.env.IRON_LOG_SYNC_USER_ID;
  if (!userId) {
    return NextResponse.json({ error: "Sync not configured" }, { status: 500 });
  }

  // "Yesterday" in the user's own timezone — the diary is keyed by their local day.
  const [profile] = await db
    .select({ timezone: profiles.timezone })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  const tz = profile?.timezone ?? "UTC";
  const todayLocal = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const yesterday = addDaysISO(todayLocal, -1);

  const { totals } = await getDiaryPayload(userId, yesterday);
  if (
    totals.calories === 0 &&
    totals.proteinG === 0 &&
    totals.carbsG === 0 &&
    totals.fatG === 0
  ) {
    return NextResponse.json({ ok: true, date: yesterday, skipped: "no logged food" });
  }

  await pushNutritionToIronLog(userId, {
    date: yesterday,
    calories: totals.calories,
    proteinG: totals.proteinG,
    carbsG: totals.carbsG,
    fatG: totals.fatG,
  });

  return NextResponse.json({
    ok: true,
    date: yesterday,
    totals: {
      calories: totals.calories,
      proteinG: totals.proteinG,
      carbsG: totals.carbsG,
      fatG: totals.fatG,
    },
  });
}
