import { asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, parseBody, requireDbUser, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { goalDays, goalProfiles } from "@/lib/db/schema";
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
    const dayRows = profileRows.length
      ? await db
          .select()
          .from(goalDays)
          .where(
            inArray(
              goalDays.goalProfileId,
              profileRows.map((p) => p.id),
            ),
          )
          .orderBy(asc(goalDays.dayOfWeek))
      : [];
    return NextResponse.json({
      goalProfiles: profileRows.map((profile) => ({
        ...profile,
        days: dayRows.filter((day) => day.goalProfileId === profile.id),
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
