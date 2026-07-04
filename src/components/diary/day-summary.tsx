"use client";

import { Flame, Sparkles } from "lucide-react";

import { MacroMeter } from "@/components/nutrition/macro-meter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DiaryPayloadDTO, StreakDTO } from "@/types/api";

export function DaySummary({
  payload,
  streak,
  onAnalyze,
}: {
  payload: DiaryPayloadDTO;
  streak: StreakDTO | null;
  onAnalyze: () => void;
}) {
  const { totals, goal } = payload;
  const remaining = goal ? Math.round(goal.calories - totals.calories) : null;
  const pctOfGoal = goal ? Math.min(1, totals.calories / goal.calories) : 0;

  return (
    <section
      aria-label="Day summary"
      className="animate-scale-in relative overflow-hidden rounded-3xl bg-[image:var(--gradient-brand)] p-5 text-white shadow-[var(--shadow-glow)]"
    >
      {/* Ambient blobs */}
      <div
        aria-hidden
        className="animate-blob pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-12 size-56 rounded-full bg-black/10 blur-3xl"
      />

      <div className="relative space-y-4">
        {streak && streak.current > 0 ? (
          <div
            className="flex items-center gap-1.5 text-sm font-semibold"
            title={
              streak.todayLogged
                ? `Longest streak: ${streak.longest} days`
                : "Log something today to keep the streak going"
            }
          >
            <Flame
              className={cn(
                "size-4 text-cta drop-shadow",
                streak.todayLogged && "animate-flame",
              )}
              fill={streak.todayLogged ? "currentColor" : "none"}
              aria-hidden
            />
            <span>
              {streak.current} day{streak.current === 1 ? "" : "s"} streak
            </span>
            {!streak.todayLogged ? (
              <span className="text-xs font-normal text-white/70">
                — log today to keep it
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-white/70 uppercase">
              Calories
            </p>
            <p className="text-4xl font-extrabold tracking-tight tabular-nums">
              {Math.round(totals.calories)}
              {goal ? (
                <span className="text-lg font-medium text-white/60">
                  {" "}
                  / {goal.calories}
                </span>
              ) : null}
            </p>
            {remaining != null ? (
              <p className={cn("text-xs", remaining < 0 ? "font-semibold text-cta" : "text-white/75")}>
                {remaining >= 0
                  ? `${remaining} remaining`
                  : `${Math.abs(remaining)} over goal`}
              </p>
            ) : (
              <p className="text-xs text-white/75">No goal set for this day</p>
            )}
          </div>
          <Button
            size="sm"
            onClick={onAnalyze}
            className="border-white/20 bg-white/15 text-white shadow-none backdrop-blur hover:bg-white/25 hover:brightness-100"
          >
            <Sparkles data-icon="inline-start" aria-hidden />
            Analyze
          </Button>
        </div>

        {/* Day progress hairline */}
        {goal ? (
          <div className="h-1 overflow-hidden rounded-full bg-white/15" aria-hidden>
            <div
              className="h-full rounded-full bg-white/80 transition-[width] duration-700 [transition-timing-function:var(--ease-out-expo)]"
              style={{ width: `${pctOfGoal * 100}%` }}
            />
          </div>
        ) : null}

        <div className="grid gap-3">
          <MacroMeter
            label="Protein"
            value={totals.proteinG}
            target={goal?.proteinG ?? null}
            colorVar="--chart-1"
            tone="hero"
          />
          <MacroMeter
            label="Carbs"
            value={totals.carbsG}
            target={goal?.carbsG ?? null}
            colorVar="--chart-2"
            tone="hero"
          />
          <MacroMeter
            label="Fat"
            value={totals.fatG}
            target={goal?.fatG ?? null}
            colorVar="--chart-3"
            tone="hero"
          />
        </div>
      </div>
    </section>
  );
}
