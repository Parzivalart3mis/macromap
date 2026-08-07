import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { importRecipeFromUrl } from "@/lib/ai/recipe-importer";
import { db } from "@/lib/db";
import { foods } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({ url: z.string().min(4).max(2000) });

/**
 * Import a recipe from a web URL into the user's My Recipes as a per-serving
 * food. Macros are AI-estimated from the ingredients (flagged in the UI).
 */
export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("aiParse", userId);
    const { url } = await parseBody(request, schema);
    const recipe = await importRecipeFromUrl(url);
    const servings = Math.round(recipe.servings);

    const [food] = await db
      .insert(foods)
      .values({
        name: recipe.name,
        description: `Imported recipe · ${servings} serving${servings === 1 ? "" : "s"}`,
        sourceType: "user_created",
        createdByUserId: userId,
        isRecipe: true,
        isVerified: false,
        servingSizeValue: 1,
        servingSizeUnit: "serving",
        calories: recipe.perServing.calories,
        proteinG: recipe.perServing.proteinG,
        carbsG: recipe.perServing.carbsG,
        fatG: recipe.perServing.fatG,
        fiberG: recipe.perServing.fiberG ?? null,
        sugarG: recipe.perServing.sugarG ?? null,
        satFatG: recipe.perServing.satFatG ?? null,
        sodiumMg: recipe.perServing.sodiumMg ?? null,
      })
      .returning({ id: foods.id, name: foods.name });

    return NextResponse.json({ food, servings }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
