import { NextResponse } from "next/server";

import { handleApiError, requireAdmin } from "@/lib/api";
import { getAdminOverview } from "@/lib/admin/overview";

/** The same figures the admin page renders, for anything that wants them as JSON. */
export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await getAdminOverview());
  } catch (error) {
    return handleApiError(error);
  }
}
