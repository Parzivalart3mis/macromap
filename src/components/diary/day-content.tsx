"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronUp, Plus, Sparkles } from "lucide-react";
import { useState } from "react";

import { ListSkeleton } from "@/components/async-states";
import { AnimatedNumber } from "@/components/diary/animated-number";
import { CalorieRing } from "@/components/diary/calorie-ring";
import { MealCard } from "@/components/diary/meal-card";
import { DailyGoalBars } from "@/components/nutrition/goal-bars";
import { NutritionPanel } from "@/components/nutrition/nutrition-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DiaryMealDTO, DiaryPayloadDTO } from "@/types/api";

const DEFAULT_MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];

/** Merge server meals with the default buckets so empty days still show them. */
function mergedMeals(payload: DiaryPayloadDTO): DiaryMealDTO[] {
  const existing = new Map(payload.meals.map((meal) => [meal.mealName, meal]));
  const defaults: DiaryMealDTO[] = DEFAULT_MEALS.map((name, index) => {
    return (
      existing.get(name) ?? {
        id: `virtual-${name}`,
        mealName: name,
        displayOrder: index,
        entries: [],
        totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      }
    );
  });
  const custom = payload.meals.filter((meal) => !DEFAULT_MEALS.includes(meal.mealName));
  return [...defaults, ...custom];
}

function MacroBar({
  label,
  value,
  target,
  colorVar,
}: {
  label: string;
  value: number;
  target: number | null;
  colorVar: string;
}) {
  const reduce = useReducedMotion();
  const pct = target && target > 0 ? Math.min(1, value / target) : value > 0 ? 1 : 0;
  const over = target != null && target > 0 && value > target;
  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-lg font-bold tabular-nums">
        {Math.round(value)}g
        {target ? (
          <span className="text-sm font-normal text-muted-foreground">
            {" "}
            / {Math.round(target)}
          </span>
        ) : null}
      </p>
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={target ? Math.round(target) : undefined}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <motion.div
          className="h-full w-full origin-left rounded-full"
          style={{ backgroundColor: over ? "var(--warning)" : `var(${colorVar})` }}
          initial={{ scaleX: reduce ? pct : 0 }}
          animate={{ scaleX: pct }}
          transition={reduce ? { duration: 0 } : { duration: 0.55, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/**
 * One day's diary body: calorie ring, macro bars, and the meal list. Rendered
 * inside the sliding pager, so it may mount without data yet (shows a
 * skeleton until its day's payload arrives).
 */
export function DiaryDayContent({
  date,
  payload,
  onAnalyze,
  onAddMeal,
}: {
  date: string;
  payload: DiaryPayloadDTO | null;
  onAnalyze: () => void;
  onAddMeal: () => void;
}) {
  const [nutritionOpen, setNutritionOpen] = useState(false);

  if (!payload) {
    return <ListSkeleton rows={5} />;
  }

  const { goal, totals } = payload;
  const remaining = goal ? Math.round(goal.calories - totals.calories) : null;
  const over = remaining != null && remaining < 0;

  return (
    <div className="space-y-4 p-4 pb-28">
      {/* Calorie ring card */}
      <Card className="p-4">
        <div className="flex items-center gap-5">
          <CalorieRing consumed={totals.calories} goal={goal?.calories ?? 0}>
            {remaining != null ? (
              <>
                <AnimatedNumber
                  value={Math.abs(remaining)}
                  className="text-2xl font-extrabold tracking-tight tabular-nums"
                />
                <span className="text-xs text-muted-foreground">
                  {over ? "over" : "left"}
                </span>
              </>
            ) : (
              <>
                <AnimatedNumber
                  value={Math.round(totals.calories)}
                  className="text-2xl font-extrabold tracking-tight tabular-nums"
                />
                <span className="text-xs text-muted-foreground">cal</span>
              </>
            )}
          </CalorieRing>

          <div className="flex-1 space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">Goal</span>
              <span className="font-semibold tabular-nums">
                {goal ? goal.calories.toLocaleString() : "—"}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">Food</span>
              <span className="font-semibold tabular-nums">
                {Math.round(totals.calories).toLocaleString()}
              </span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">{over ? "Over" : "Remaining"}</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  over ? "text-destructive" : "text-primary",
                )}
              >
                {remaining != null ? Math.abs(remaining).toLocaleString() : "—"}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Macros card */}
      <Card className="p-4">
        <div className="flex gap-4">
          <MacroBar
            label="Carbs"
            value={totals.carbsG}
            target={goal?.carbsG ?? null}
            colorVar="--macro-carbs"
          />
          <MacroBar
            label="Fat"
            value={totals.fatG}
            target={goal?.fatG ?? null}
            colorVar="--macro-fat"
          />
          <MacroBar
            label="Protein"
            value={totals.proteinG}
            target={goal?.proteinG ?? null}
            colorVar="--macro-protein"
          />
        </div>
      </Card>

      {/* Day nutrition report: full micro totals + optional micro goal bars */}
      <Card className="p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-sm font-semibold"
          aria-expanded={nutritionOpen}
          onClick={() => setNutritionOpen((open) => !open)}
        >
          Nutrition
          <span className="flex items-center gap-1 font-semibold text-primary">
            {nutritionOpen ? "Hide" : "Show"}
            {nutritionOpen ? (
              <ChevronUp className="size-4" aria-hidden />
            ) : (
              <ChevronDown className="size-4" aria-hidden />
            )}
          </span>
        </button>
        {nutritionOpen ? (
          <div className="animate-fade-up space-y-4 pt-3">
            {goal ? <DailyGoalBars nutrition={totals} goal={goal} /> : null}
            <NutritionPanel nutrition={totals} showAll />
          </div>
        ) : null}
      </Card>

      {/* Diary */}
      <div className="flex items-center justify-between px-1 pt-1">
        <h2 className="text-xl font-extrabold tracking-tight">Diary</h2>
        <Button variant="ghost" size="sm" className="text-primary" onClick={onAnalyze}>
          <Sparkles data-icon="inline-start" aria-hidden />
          Analyze
        </Button>
      </div>

      {mergedMeals(payload).map((meal) => (
        <MealCard key={meal.id} meal={meal} date={date} />
      ))}
      <Button variant="outline" className="w-full" onClick={onAddMeal}>
        <Plus data-icon="inline-start" aria-hidden />
        Add meal bucket
      </Button>
    </div>
  );
}
