import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { profiles, users } from "@/lib/db/schema";

export async function GET() {
  try {
    const userId = await requireUserId();
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    return NextResponse.json({
      user: user ?? { id: userId, email: null, displayName: null },
      profile: profile ?? {
        userId,
        timezone: "UTC",
        unitSystem: "metric",
        heightCm: null,
        startingWeightKg: null,
        dateOfBirth: null,
        sex: null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
