"use client";

import type { GoalDTO } from "@/types/api";
import type { NutritionSnapshot } from "@/types/nutrition";

function GoalBar({
  label,
  value,
  goal,
  warnOver = false,
}: {
  label: string;
  value: number;
  goal: number | null;
  /** Ceiling-type goal (sugar/sodium): color the bar when the max is exceeded. */
  warnOver?: boolean;
}) {
  const pct = goal && goal > 0 ? Math.round((value / goal) * 100) : null;
  const over = warnOver && pct != null && pct > 100;
  return (
    <div className="min-w-0 flex-1 text-center">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={
            over
              ? "h-full rounded-full bg-destructive transition-[width] duration-500 [transition-timing-function:var(--ease-out-expo)]"
              : "h-full rounded-full bg-primary transition-[width] duration-500 [transition-timing-function:var(--ease-out-expo)]"
          }
          style={{ width: `${Math.min(100, pct ?? 0)}%` }}
        />
      </div>
      <p
        className={
          over
            ? "mt-1.5 text-sm font-semibold text-destructive tabular-nums"
            : "mt-1.5 text-sm font-semibold tabular-nums"
        }
      >
        {pct == null ? "–" : `${pct}%`}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** "Percent of Daily Goals" bar rows for an entry's or a day's nutrition. */
export function DailyGoalBars({
  nutrition,
  goal,
}: {
  nutrition: NutritionSnapshot;
  goal: GoalDTO;
}) {
  // Optional micro targets appear as a second row only when the goal sets them.
  const microBars = [
    goal.fiberG != null && (
      <GoalBar key="fiber" label="Fiber" value={nutrition.fiberG ?? 0} goal={goal.fiberG} />
    ),
    goal.sugarGMax != null && (
      <GoalBar
        key="sugar"
        label="Sugar"
        value={nutrition.sugarG ?? 0}
        goal={goal.sugarGMax}
        warnOver
      />
    ),
    goal.sodiumMgMax != null && (
      <GoalBar
        key="sodium"
        label="Sodium"
        value={nutrition.sodiumMg ?? 0}
        goal={goal.sodiumMgMax}
        warnOver
      />
    ),
    goal.satFatGMax != null && (
      <GoalBar
        key="satfat"
        label="Sat Fat"
        value={nutrition.satFatG ?? 0}
        goal={goal.satFatGMax}
        warnOver
      />
    ),
  ].filter(Boolean);

  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Percent of Daily Goals</p>
      <div className="flex gap-3">
        <GoalBar label="Calories" value={nutrition.calories} goal={goal.calories} />
        <GoalBar label="Carbs" value={nutrition.carbsG} goal={goal.carbsG} />
        <GoalBar label="Fat" value={nutrition.fatG} goal={goal.fatG} />
        <GoalBar label="Protein" value={nutrition.proteinG} goal={goal.proteinG} />
      </div>
      {microBars.length > 0 ? <div className="mt-3 flex gap-3">{microBars}</div> : null}
    </div>
  );
}
