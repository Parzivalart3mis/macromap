"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { ListSkeleton } from "@/components/async-states";
import { AnimatedNumber } from "@/components/diary/animated-number";
import { CalorieRing } from "@/components/diary/calorie-ring";
import { DayAdjustments } from "@/components/diary/day-adjustments";
import { MealCard } from "@/components/diary/meal-card";
import { DailyGoalBars } from "@/components/nutrition/goal-bars";
import { NutritionPanel } from "@/components/nutrition/nutrition-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DiaryMealDTO, DiaryPayloadDTO } from "@/types/api";
import type { NutritionSnapshot } from "@/types/nutrition";

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

/** The three macro-card views the ⇄ button cycles through. */
type MacroView = "consumed" | "remaining" | "percent";
const MACRO_VIEWS: MacroView[] = ["consumed", "remaining", "percent"];

const MACROS = [
  { label: "Carbs", key: "carbsG", colorVar: "--macro-carbs", perGram: 4 },
  { label: "Fat", key: "fatG", colorVar: "--macro-fat", perGram: 9 },
  { label: "Protein", key: "proteinG", colorVar: "--macro-protein", perGram: 4 },
] as const;

function MacroBar({
  label,
  value,
  target,
  colorVar,
  mode,
}: {
  label: string;
  value: number;
  target: number | null;
  colorVar: string;
  mode: "consumed" | "remaining";
}) {
  const reduce = useReducedMotion();
  const pct = target && target > 0 ? Math.min(1, value / target) : value > 0 ? 1 : 0;
  const over = target != null && target > 0 && value > target;
  const remaining = target != null ? Math.max(0, Math.round(target - value)) : null;
  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-lg font-bold tabular-nums">
        {mode === "remaining" && remaining != null ? (
          <>
            {remaining}g{" "}
            <span className="text-sm font-normal text-muted-foreground">left</span>
          </>
        ) : (
          <>
            {Math.round(value)}g
            {target ? (
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {Math.round(target)}
              </span>
            ) : null}
          </>
        )}
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

/** "Percent" view: each macro's share of total macro calories + one stacked bar. */
function MacroPercent({ totals }: { totals: NutritionSnapshot }) {
  const cals = MACROS.map((m) => (totals[m.key] ?? 0) * m.perGram);
  const total = cals.reduce((a, b) => a + b, 0) || 1;
  const pcts = cals.map((c) => Math.round((c / total) * 100));
  return (
    <div>
      <div className="flex gap-4">
        {MACROS.map((m, i) => (
          <div key={m.label} className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <span className="size-2 rounded-full" style={{ backgroundColor: `var(${m.colorVar})` }} />
              {m.label}
            </p>
            <p className="text-lg font-bold tabular-nums">{pcts[i]}%</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
        {MACROS.map((m, i) => (
          <div
            key={m.label}
            style={{ width: `${(cals[i] / total) * 100}%`, backgroundColor: `var(${m.colorVar})` }}
          />
        ))}
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
  onGoalChanged,
  onChanged,
  onComplete,
  onUncomplete,
  onViewAnalysis,
}: {
  date: string;
  payload: DiaryPayloadDTO | null;
  onAnalyze: () => void;
  onAddMeal: () => void;
  /** Refetch this day after an activity/exception write changes the goal. */
  onGoalChanged: () => void;
  /** Refetch this day after entries change in place (e.g. repeat last meal). */
  onChanged: () => void;
  /** Mark the day complete (and run/save the AI analysis). */
  onComplete: () => void;
  /** Mark a completed day incomplete again. */
  onUncomplete: () => void;
  /** Show the saved analysis for a completed day. */
  onViewAnalysis: () => void;
}) {
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  // Macro-card view (⇄), persisted; the card only renders after client data
  // loads, so reading localStorage on init causes no hydration mismatch.
  const [macroView, setMacroView] = useState<MacroView>(() => {
    if (typeof window === "undefined") return "consumed";
    const saved = window.localStorage.getItem("mm-macro-view");
    return saved === "remaining" || saved === "percent" ? saved : "consumed";
  });

  function cycleMacroView() {
    setMacroView((v) => {
      const next = MACRO_VIEWS[(MACRO_VIEWS.indexOf(v) + 1) % MACRO_VIEWS.length];
      window.localStorage.setItem("mm-macro-view", next);
      return next;
    });
  }

  if (!payload) {
    return <ListSkeleton rows={5} />;
  }

  const { goal, totals, goalBreakdown } = payload;
  const remaining = goal ? Math.round(goal.calories - totals.calories) : null;
  const over = remaining != null && remaining < 0;

  return (
    <div className="space-y-4 p-4 pb-28">
      {/* Calorie ring card */}
      <Card className="p-4">
        <div className="flex items-center gap-5">
          <CalorieRing
            consumed={totals.calories}
            goal={goal?.calories ?? 0}
            macros={{
              carbsG: totals.carbsG,
              fatG: totals.fatG,
              proteinG: totals.proteinG,
            }}
          >
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
            {goalBreakdown ? (
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-2"
                aria-expanded={breakdownOpen}
                onClick={() => setBreakdownOpen((open) => !open)}
              >
                <span className="flex items-center gap-1 text-muted-foreground">
                  Goal
                  {breakdownOpen ? (
                    <ChevronUp className="size-3.5" aria-hidden />
                  ) : (
                    <ChevronDown className="size-3.5" aria-hidden />
                  )}
                </span>
                <span className="font-semibold tabular-nums">
                  {goal ? goal.calories.toLocaleString() : "—"}
                </span>
              </button>
            ) : (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-muted-foreground">Goal</span>
                <span className="font-semibold tabular-nums">
                  {goal ? goal.calories.toLocaleString() : "—"}
                </span>
              </div>
            )}
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

        {/* "Why this number?" — base + each activity contributing to the goal */}
        {goalBreakdown && breakdownOpen ? (
          <div className="animate-fade-up mt-3 space-y-1 border-t pt-3 text-sm">
            {goalBreakdown.map((line, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-muted-foreground">{line.label}</span>
                <span className="shrink-0 tabular-nums">
                  {i === 0 ? "" : "+"}
                  {Math.round(line.calories).toLocaleString()} cal
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      {/* Per-date adjustments: skip / override activities, add one-offs */}
      {payload.goalProfileId ? (
        <Card className="p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm font-semibold"
            aria-expanded={adjustOpen}
            onClick={() => setAdjustOpen((open) => !open)}
          >
            Adjust this day
            <span className="flex items-center gap-1 font-semibold text-primary">
              {adjustOpen ? "Hide" : "Edit"}
              {adjustOpen ? (
                <ChevronUp className="size-4" aria-hidden />
              ) : (
                <ChevronDown className="size-4" aria-hidden />
              )}
            </span>
          </button>
          {adjustOpen ? (
            <div className="animate-fade-up pt-3">
              <DayAdjustments
                profileId={payload.goalProfileId}
                date={date}
                activities={payload.dayActivities ?? []}
                oneOffs={payload.dayOneOffs ?? []}
                onChanged={onGoalChanged}
              />
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* Macros card — ⇄ cycles consumed / remaining / percent */}
      <Card className="relative p-4">
        <button
          type="button"
          aria-label="Change macro view"
          onClick={cycleMacroView}
          className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftRight className="size-3.5" aria-hidden />
        </button>
        {macroView === "percent" ? (
          <MacroPercent totals={totals} />
        ) : (
          <div className="flex gap-4 pr-8">
            <MacroBar
              label="Carbs"
              value={totals.carbsG}
              target={goal?.carbsG ?? null}
              colorVar="--macro-carbs"
              mode={macroView}
            />
            <MacroBar
              label="Fat"
              value={totals.fatG}
              target={goal?.fatG ?? null}
              colorVar="--macro-fat"
              mode={macroView}
            />
            <MacroBar
              label="Protein"
              value={totals.proteinG}
              target={goal?.proteinG ?? null}
              colorVar="--macro-protein"
              mode={macroView}
            />
          </div>
        )}
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
        <MealCard key={meal.id} meal={meal} date={date} onRepeated={onChanged} />
      ))}
      <Button variant="outline" className="w-full" onClick={onAddMeal}>
        <Plus data-icon="inline-start" aria-hidden />
        Add meal bucket
      </Button>

      {/* Complete the day — logs stay editable; saves an AI analysis */}
      {payload.completedAt ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <CheckCircle2 className="size-4.5" aria-hidden />
            Day completed
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            You can still log — it stays complete. Re-analyze to refresh the report.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {payload.analysis?.length ? (
              <Button size="sm" variant="secondary" onClick={onViewAnalysis}>
                <Sparkles data-icon="inline-start" aria-hidden />
                View analysis
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={onComplete}>
              <RotateCcw data-icon="inline-start" aria-hidden />
              Re-analyze
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onUncomplete}>
              Mark incomplete
            </Button>
          </div>
        </div>
      ) : (
        <Button className="w-full" onClick={onComplete}>
          <CheckCircle2 data-icon="inline-start" aria-hidden />
          Complete diary
        </Button>
      )}
    </div>
  );
}
