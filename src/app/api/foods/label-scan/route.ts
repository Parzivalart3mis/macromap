import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { scanNutritionLabel } from "@/lib/ai/label-scanner";
import { enforceRateLimit } from "@/lib/rate-limit";

// ~4 MB of base64 ≈ 3 MB image — plenty after the client-side downscale.
const scanSchema = z.object({
  image: z.string().min(100).max(4_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

/**
 * Reads a Nutrition Facts photo into Create-Food-wizard fields. Nothing is
 * saved here — the client prefills the wizard and the user reviews first.
 */
export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("aiParse", userId);
    const input = await parseBody(request, scanSchema);
    const label = await scanNutritionLabel(input.image, input.mimeType);
    return NextResponse.json({ label });
  } catch (error) {
    return handleApiError(error);
  }
}
