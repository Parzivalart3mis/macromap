import { NextResponse, type NextRequest } from "next/server";

import { ApiError, handleApiError, requireUserId } from "@/lib/api";
import { buildWeeklySummary, getReportData } from "@/lib/reports/data";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const weekStart = request.nextUrl.searchParams.get("weekStart");
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      throw new ApiError("invalid_request", "weekStart must be YYYY-MM-DD", 400);
    }
    const end = new Date(`${weekStart}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    const weekEnd = end.toISOString().slice(0, 10);
    const data = await getReportData(userId, weekStart, weekEnd);
    return NextResponse.json({ summary: buildWeeklySummary(data) });
  } catch (error) {
    return handleApiError(error);
  }
}
