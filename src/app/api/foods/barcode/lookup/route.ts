import { NextResponse } from "next/server";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { hybridBarcodeLookup } from "@/lib/barcode/hybrid-lookup";
import { enforceRateLimit } from "@/lib/rate-limit";
import { barcodeLookupSchema } from "@/lib/validations/foods";

export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("barcodeLookup", userId);
    const { barcode } = await parseBody(request, barcodeLookupSchema);
    const result = await hybridBarcodeLookup(barcode);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
