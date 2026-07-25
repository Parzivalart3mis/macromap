import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { goalActivityExceptions, goalProfiles } from "@/lib/db/schema";

/** Remove an exception (un-skip, drop an override, or delete a one-off). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; exceptionId: string }> },
) {
  try {
    const userId = await requireDbUser();
    const { id, exceptionId } = await params;
    const [row] = await db
      .select({ id: goalActivityExceptions.id })
      .from(goalActivityExceptions)
      .innerJoin(goalProfiles, eq(goalProfiles.id, goalActivityExceptions.goalProfileId))
      .where(
        and(
          eq(goalActivityExceptions.id, exceptionId),
          eq(goalActivityExceptions.goalProfileId, id),
          eq(goalProfiles.userId, userId),
        ),
      )
      .limit(1);
    if (!row) throw new ApiError("not_found", "Exception not found", 404);
    await db.delete(goalActivityExceptions).where(eq(goalActivityExceptions.id, exceptionId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
