import { NextResponse, type NextRequest } from "next/server";

import { ApiError, handleApiError, requireUserId } from "@/lib/api";
import { getDiaryPayload } from "@/lib/diary/service";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const date = request.nextUrl.searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ApiError("invalid_request", "date must be YYYY-MM-DD", 400);
    }
    const payload = await getDiaryPayload(userId, date);
    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
