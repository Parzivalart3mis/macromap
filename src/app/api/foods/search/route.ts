import { NextResponse, type NextRequest } from "next/server";

import { handleApiError, requireUserId } from "@/lib/api";
import { searchExternalFoods } from "@/lib/foods/external-search";
import { searchFoods } from "@/lib/foods/service";

export async function GET(request: NextRequest) {
  try {
    await requireUserId();
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) {
      return NextResponse.json({ foods: [], external: [] });
    }
    const foods = await searchFoods(query);

    // When the shared database comes up short, offer USDA / Open Food Facts
    // results the user can import with one tap.
    const external =
      foods.length < 5 && query.length >= 3 ? await searchExternalFoods(query) : [];

    return NextResponse.json({ foods, external });
  } catch (error) {
    return handleApiError(error);
  }
}
