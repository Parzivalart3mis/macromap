import type { NextRequest } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { reportToCsv } from "@/lib/reports/csv-generator";
import { getReportData } from "@/lib/reports/data";
import { parseRange } from "@/lib/reports/range";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { from, to } = parseRange(request.nextUrl.searchParams);
    const data = await getReportData(userId, from, to);
    const csv = reportToCsv(data);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="macromap-${from}-to-${to}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
