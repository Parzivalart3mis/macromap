import { NextResponse } from "next/server";

import { handleApiError, parseBody, requireDbUser } from "@/lib/api";
import { buildSuggestions, parseNaturalLogText } from "@/lib/ai/natural-language-parser";
import { db } from "@/lib/db";
import { aiLoggingRuns } from "@/lib/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
import { naturalLogSchema } from "@/lib/validations/foods";

/**
 * Parses free text ("2 eggs and a Subway footlong") into food suggestions.
 * Nothing is logged here — the client confirms each suggestion and then posts
 * to /api/diary/entries.
 */
export async function POST(request: Request) {
  try {
    const userId = await requireDbUser();
    await enforceRateLimit("aiParse", userId);
    const input = await parseBody(request, naturalLogSchema);

    const items = await parseNaturalLogText(input.text);
    const suggestions = await buildSuggestions(items);

    const [run] = await db
      .insert(aiLoggingRuns)
      .values({ userId, inputText: input.text, parsedJson: items })
      .returning({ id: aiLoggingRuns.id });

    return NextResponse.json({
      runId: run.id,
      date: input.date,
      mealName: input.mealName,
      suggestions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
