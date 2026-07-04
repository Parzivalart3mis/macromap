import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { goalProfiles } from "@/lib/db/schema";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireDbUser();
    const { id } = await params;
    const [profile] = await db
      .select()
      .from(goalProfiles)
      .where(and(eq(goalProfiles.id, id), eq(goalProfiles.userId, userId)))
      .limit(1);
    if (!profile) throw new ApiError("not_found", "Goal profile not found", 404);

    await db
      .update(goalProfiles)
      .set({ isActive: false })
      .where(eq(goalProfiles.userId, userId));
    await db.update(goalProfiles).set({ isActive: true }).where(eq(goalProfiles.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
