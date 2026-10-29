import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { scanNutritionLabel } from "@/lib/ai/label-scanner";
import { enforceRateLimit } from "@/lib/rate-limit";

const imageSchema = z.object({
  // ~4 MB of base64 ≈ 3 MB image — plenty after the client-side downscale.
  data: z.string().min(100).max(4_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

/**
 * Accepts several photos of one package — front for the brand and name, back
 * for the panel, optionally a barcode close-up. `image`/`mimeType` is the older
 * single-photo shape, still accepted so an older client keeps working.
 */
const scanSchema = z
  .object({
    images: z.array(imageSchema).min(1).max(5).optional(),
    image: z.string().min(100).max(4_000_000).optional(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
  })
  .refine((v) => v.images?.length || (v.image && v.mimeType), {
    message: "Send images: [{ data, mimeType }]",
  });

/**
 * Reads photos of a package into Create-Food-wizard fields. Nothing is saved
 * here — the client prefills the wizard and the user reviews first.
 */
export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("aiParse", userId);
    const input = await parseBody(request, scanSchema);
    const images =
      input.images ?? [{ data: input.image!, mimeType: input.mimeType! }];
    const label = await scanNutritionLabel(images);
    return NextResponse.json({ label });
  } catch (error) {
    return handleApiError(error);
  }
}
