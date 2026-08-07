import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { scanMeal } from "@/lib/ai/meal-scanner";
import { enforceRateLimit } from "@/lib/rate-limit";

const scanSchema = z.object({
  image: z.string().min(100).max(4_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

/**
 * Reads a meal photo into a list of estimated foods for the user to review.
 * Nothing is saved here — the client shows the items and the user confirms
 * (each logs as a Quick-Add estimate).
 */
export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("aiParse", userId);
    const input = await parseBody(request, scanSchema);
    const items = await scanMeal(input.image, input.mimeType);
    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
