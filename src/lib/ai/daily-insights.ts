import { GoogleGenAI } from "@google/genai";

import type { DiaryPayload } from "@/lib/diary/service";

/**
 * "Analyze my day" — uses Gemini when configured, otherwise falls back to
 * deterministic rule-based insights so the feature works without a key.
 */
export async function analyzeDiaryDay(payload: DiaryPayload): Promise<string[]> {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await aiInsights(payload);
    } catch {
      // Fall through to the deterministic path on any AI failure.
    }
  }
  return ruleBasedInsights(payload);
}

async function aiInsights(payload: DiaryPayload): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    contents: JSON.stringify({
      totals: payload.totals,
      goal: payload.goal,
      meals: payload.meals.map((meal) => ({
        name: meal.mealName,
        totals: meal.totals,
        items: meal.entries.map((entry) => entry.nutritionSnapshotJson.label),
      })),
    }),
    config: {
      systemInstruction:
        'You are a pragmatic nutrition coach. Given a day\'s diary totals, per-meal breakdown, and goals, return 3 to 5 short, specific, actionable observations. No exclamation marks. Respond with JSON only: {"insights": string[]}',
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });
  const parsed = JSON.parse(response.text ?? "{}") as { insights?: unknown };
  if (
    !Array.isArray(parsed.insights) ||
    !parsed.insights.every((i) => typeof i === "string")
  ) {
    throw new Error("Bad insights shape");
  }
  return parsed.insights.slice(0, 5);
}

export function ruleBasedInsights(payload: DiaryPayload): string[] {
  const insights: string[] = [];
  const { totals, goal, meals } = payload;

  if (goal) {
    const remaining = Math.round(goal.calories - totals.calories);
    if (remaining > 0) {
      insights.push(`You have ${remaining} calories left against today's target.`);
    } else {
      insights.push(`You are ${Math.abs(remaining)} calories over today's target.`);
    }
    const proteinGap = goal.proteinG - totals.proteinG;
    if (proteinGap > 5) {
      insights.push(
        `Protein is ${Math.round(proteinGap)} g short of goal — a high-protein snack would close it.`,
      );
    } else {
      insights.push("Protein is on track for today.");
    }
    if (goal.sodiumMgMax != null && (totals.sodiumMg ?? 0) > goal.sodiumMgMax) {
      insights.push(
        `Sodium is over your ${Math.round(goal.sodiumMgMax)} mg cap — watch salty items tomorrow.`,
      );
    }
    if (goal.sugarGMax != null && (totals.sugarG ?? 0) > goal.sugarGMax) {
      insights.push(`Sugar exceeded your ${Math.round(goal.sugarGMax)} g cap today.`);
    }
  } else {
    insights.push("Set a goal profile to get target-based analysis of your day.");
  }

  const loggedMeals = meals.filter((meal) => meal.entries.length > 0);
  if (loggedMeals.length > 0) {
    const biggest = loggedMeals.reduce((a, b) =>
      b.totals.calories > a.totals.calories ? b : a,
    );
    insights.push(
      `${biggest.mealName} was your largest meal at ${Math.round(biggest.totals.calories)} calories.`,
    );
  } else {
    insights.push("Nothing logged yet today.");
  }

  return insights.slice(0, 5);
}
