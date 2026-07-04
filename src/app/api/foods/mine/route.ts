import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { foods } from "@/lib/db/schema";

/** Foods this user added to the shared database ("My Foods" tab). */
export async function GET() {
  try {
    const userId = await requireUserId();
    const rows = await db
      .select()
      .from(foods)
      .where(eq(foods.createdByUserId, userId))
      .orderBy(desc(foods.createdAt))
      .limit(100);
    return NextResponse.json({ foods: rows });
  } catch (error) {
    return handleApiError(error);
  }
}
