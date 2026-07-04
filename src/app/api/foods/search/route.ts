import { NextResponse, type NextRequest } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { searchFoods } from "@/lib/foods/service";

export async function GET(request: NextRequest) {
  try {
    await requireUserId();
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) {
      return NextResponse.json({ foods: [] });
    }
    const foods = await searchFoods(query);
    return NextResponse.json({ foods });
  } catch (error) {
    return handleApiError(error);
  }
}
