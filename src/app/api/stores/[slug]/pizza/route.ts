import { asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ApiError, handleApiError, requireUserId } from "@/lib/api";
import { db } from "@/lib/db";
import { pizzaComponents, pizzaConfigs, stores } from "@/lib/db/schema";
import { pizzaRowToNutrition } from "@/lib/stores/pizza-nutrition";

/** Build-your-own pizza configs + components for a size-scaled store (Domino's). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireUserId();
    const { slug } = await params;
    const [store] = await db.select().from(stores).where(eq(stores.slug, slug)).limit(1);
    if (!store) throw new ApiError("not_found", "Store not found", 404);

    const configs = await db
      .select()
      .from(pizzaConfigs)
      .where(eq(pizzaConfigs.storeId, store.id))
      .orderBy(asc(pizzaConfigs.displayOrder));

    const comps = configs.length
      ? await db
          .select()
          .from(pizzaComponents)
          .where(
            inArray(
              pizzaComponents.configId,
              configs.map((c) => c.id),
            ),
          )
          .orderBy(asc(pizzaComponents.componentGroup), asc(pizzaComponents.displayOrder))
      : [];

    return NextResponse.json({
      configs: configs.map((c) => ({
        id: c.id,
        size: c.size,
        crust: c.crust,
        label: c.label,
        slicesPerPizza: c.slicesPerPizza,
        crustNutrition: pizzaRowToNutrition(c),
        components: comps
          .filter((k) => k.configId === c.id)
          .map((k) => ({
            id: k.id,
            group: k.componentGroup,
            name: k.name,
            variant: k.variant,
            selectMarket: k.selectMarket,
            nutrition: pizzaRowToNutrition(k),
          })),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
