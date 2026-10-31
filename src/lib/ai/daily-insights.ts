import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import {
  EMPTY_CONTEXT,
  buildDaySummary,
  shortLabel,
  type SummaryContext,
} from "@/lib/diary/day-summary";
import type { DiaryPayload } from "@/lib/diary/service";
import type { DaySummary } from "@/types/summary";

/**
 * The end-of-day summary. The rules engine computes every figure and finds the
 * foods behind each one; Gemini, when configured, rewrites that draft into
 * tighter coaching. Any AI failure keeps the rules version, so the feature
 * works without a key.
 */
export async function summarizeDay(
  payload: DiaryPayload,
  context: SummaryContext = EMPTY_CONTEXT,
): Promise<DaySummary> {
  const draft = buildDaySummary(payload, context);
  const logged = payload.meals.some((meal) => meal.entries.length > 0);
  if (process.env.GEMINI_API_KEY && logged && payload.goal) {
    try {
      return { ...draft, ...(await aiRewrite(payload, context, draft)), source: "ai" };
    } catch {
      // Fall through to the deterministic draft on any AI failure.
    }
  }
  return draft;
}

const line = z.string().trim().min(1).max(280);
const rewriteSchema = z.object({
  headline: line,
  wins: z.array(line).max(3),
  improve: z.array(line).max(3),
  tomorrow: z.array(line).min(1).max(3),
});

const SYSTEM = `You are a sharp, practical nutrition coach writing a user's end-of-day recap.
You get the day's diary (every item with its nutrition and the meal it was in), the targets, recent history, foods the user often logs, and a DRAFT recap computed from that data.

Rewrite the draft into a recap that is genuinely useful:
- headline: one sentence verdict on the day, leading with what mattered most.
- wins: up to 3 specific things that went well. Omit rather than pad.
- improve: up to 3 problems, most important first, each naming the foods or meal responsible and by how much.
- tomorrow: 1 to 3 concrete actions for tomorrow. Prefer foods from "oftenLogged" with their numbers, or a specific portion change to a food eaten today. Never generic advice like "eat more vegetables" or "stay hydrated".

Rules:
- Use only numbers that appear in the input or simple sums/differences of them. Never invent foods or values.
- Keep the draft's findings unless the data shows they are wrong; you may add a finding the data clearly supports, such as meal timing or a protein-poor meal.
- Under 30 words per line. Plain sentences, no exclamation marks, no emoji, no markdown.
Respond with JSON only: {"headline": string, "wins": string[], "improve": string[], "tomorrow": string[]}`;

async function aiRewrite(
  payload: DiaryPayload,
  context: SummaryContext,
  draft: DaySummary,
): Promise<z.infer<typeof rewriteSchema>> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    contents: JSON.stringify({
      date: payload.date,
      phase: payload.goalPhase,
      targets: payload.goal,
      totals: payload.totals,
      meals: payload.meals
        .filter((meal) => meal.entries.length > 0)
        .map((meal) => ({
          name: meal.mealName,
          totals: meal.totals,
          items: meal.entries.map((entry) => {
            const s = entry.nutritionSnapshotJson;
            return {
              food: shortLabel(s.label),
              serving: s.serving,
              time: entry.eatenTime,
              calories: s.calories,
              proteinG: s.proteinG,
              carbsG: s.carbsG,
              fatG: s.fatG,
              fiberG: s.fiberG,
              sugarG: s.sugarG,
              sodiumMg: s.sodiumMg,
            };
          }),
        })),
      recentDays: context.recentDays,
      oftenLogged: context.recentFoods.slice(0, 15),
      draft: {
        headline: draft.headline,
        score: draft.score,
        trend: draft.trend,
        wins: draft.wins,
        improve: draft.improve,
        tomorrow: draft.tomorrow,
      },
    }),
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });
  return rewriteSchema.parse(JSON.parse(response.text ?? "{}"));
}
