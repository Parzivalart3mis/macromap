import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { foodEditHistory, users } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUserId();
    const { id } = await params;
    const history = await db
      .select({
        id: foodEditHistory.id,
        fieldChanged: foodEditHistory.fieldChanged,
        oldValue: foodEditHistory.oldValue,
        newValue: foodEditHistory.newValue,
        editedAt: foodEditHistory.editedAt,
        editedBy: users.displayName,
      })
      .from(foodEditHistory)
      .leftJoin(users, eq(users.id, foodEditHistory.editedByUserId))
      .where(eq(foodEditHistory.foodId, id))
      .orderBy(desc(foodEditHistory.editedAt))
      .limit(100);
    return NextResponse.json({ history });
  } catch (error) {
    return handleApiError(error);
  }
}
