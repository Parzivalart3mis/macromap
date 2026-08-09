import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { db } from "@/lib/db";
import { activityPresets } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createActivityPresetSchema } from "@/lib/validations/goals";

/** List the user's global activity presets. */
export async function GET() {
  try {
    const userId = await requireDbUser();
    const rows = await db
      .select()
      .from(activityPresets)
      .where(eq(activityPresets.userId, userId))
      .orderBy(asc(activityPresets.displayOrder), asc(activityPresets.createdAt));
    return NextResponse.json({
      presets: rows.map((row) => ({
        id: row.id,
        name: row.name,
        deltaCarbsG: row.deltaCarbsG,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Create a global activity preset. */
export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("diaryWrite", userId);
    const input = await parseBody(request, createActivityPresetSchema);
    const [{ nextOrder }] = await db
      .select({ nextOrder: sql<number>`coalesce(max(${activityPresets.displayOrder}), -1) + 1` })
      .from(activityPresets)
      .where(eq(activityPresets.userId, userId));
    const [preset] = await db
      .insert(activityPresets)
      .values({ userId, name: input.name, deltaCarbsG: input.deltaCarbsG, displayOrder: nextOrder })
      .returning();
    return NextResponse.json(
      { preset: { id: preset.id, name: preset.name, deltaCarbsG: preset.deltaCarbsG } },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
