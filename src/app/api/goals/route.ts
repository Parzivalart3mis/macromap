import { asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, parseBody, requireDbUser, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { goalActivities, goalDays, goalProfiles, profiles } from "@/lib/db/schema";
import { todayInTimeZone } from "@/lib/dates";
import { currentActivities } from "@/lib/goals/activities";
import { createGoalProfileSchema } from "@/lib/validations/goals";

const DEFAULT_DAY = { calories: 2000, proteinG: 150, carbsG: 200, fatG: 70 };

export async function GET() {
  try {
    const userId = await requireUserId();
    const profileRows = await db
      .select()
      .from(goalProfiles)
      .where(eq(goalProfiles.userId, userId))
      .orderBy(asc(goalProfiles.createdAt));
    const profileIds = profileRows.map((p) => p.id);
    const [dayRows, activityRows] = profileRows.length
      ? await Promise.all([
          db
            .select()
            .from(goalDays)
            .where(inArray(goalDays.goalProfileId, profileIds))
            .orderBy(asc(goalDays.dayOfWeek)),
          db
            .select()
            .from(goalActivities)
            .where(inArray(goalActivities.goalProfileId, profileIds))
            .orderBy(asc(goalActivities.displayOrder)),
        ])
      : [[], []];
    // Retired activities stay in the table for history; the editor lists only
    // what applies from today on the user's own calendar.
    const [profile] = await db
      .select({ timezone: profiles.timezone })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    const today = todayInTimeZone(profile?.timezone ?? "UTC");
    const liveActivities = currentActivities(activityRows, today);
    return NextResponse.json({
      goalProfiles: profileRows.map((profile) => ({
        ...profile,
        days: dayRows.filter((day) => day.goalProfileId === profile.id),
        activities: liveActivities.filter((a) => a.goalProfileId === profile.id),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    const input = await parseBody(request, createGoalProfileSchema);

    const existing = await db
      .select({ id: goalProfiles.id })
      .from(goalProfiles)
      .where(eq(goalProfiles.userId, userId))
      .limit(1);

    const [profile] = await db
      .insert(goalProfiles)
      .values({ userId, name: input.name, isActive: existing.length === 0 })
      .returning();

    await db.insert(goalDays).values(
      Array.from({ length: 7 }, (_, dayOfWeek) => ({
        goalProfileId: profile.id,
        dayOfWeek,
        ...DEFAULT_DAY,
      })),
    );

    return NextResponse.json({ goalProfile: profile }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
