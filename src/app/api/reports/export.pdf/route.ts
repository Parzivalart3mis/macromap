import type { NextRequest } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { getReportData } from "@/lib/reports/data";
import { generateReportPdf } from "@/lib/reports/pdf-generator";
import { parseRange } from "@/lib/reports/range";

// React-PDF needs the Node runtime.
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { from, to } = parseRange(request.nextUrl.searchParams);
    const data = await getReportData(userId, from, to);
    const pdf = await generateReportPdf(data);
    // Streamed directly behind auth — stricter than a shareable signed URL.
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="macromap-${from}-to-${to}.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
