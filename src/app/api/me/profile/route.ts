import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { profiles, users } from "@/lib/db/schema";
import { updateProfileSchema } from "@/lib/validations/profile";

export async function PATCH(request: Request) {
  try {
    const userId = await requireDbUser();
    const input = await parseBody(request, updateProfileSchema);

    const { displayName, ...profileFields } = input;
    if (displayName !== undefined) {
      await db.update(users).set({ displayName }).where(eq(users.id, userId));
    }

    const [profile] = await db
      .insert(profiles)
      .values({ userId, ...profileFields })
      .onConflictDoUpdate({ target: profiles.userId, set: profileFields })
      .returning();

    return NextResponse.json({ profile });
  } catch (error) {
    return handleApiError(error);
  }
}
