"use client";

import type { GoalDTO } from "@/types/api";
import type { NutritionSnapshot } from "@/types/nutrition";

function GoalBar({
  label,
  value,
  goal,
}: {
  label: string;
  value: number;
  goal: number | null;
}) {
  const pct = goal && goal > 0 ? Math.round((value / goal) * 100) : null;
  return (
    <div className="min-w-0 flex-1 text-center">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 [transition-timing-function:var(--ease-out-expo)]"
          style={{ width: `${Math.min(100, pct ?? 0)}%` }}
        />
      </div>
      <p className="mt-1.5 text-sm font-semibold tabular-nums">
        {pct == null ? "–" : `${pct}%`}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** "Percent of Daily Goals" bar row for one entry's nutrition. */
export function DailyGoalBars({
  nutrition,
  goal,
}: {
  nutrition: NutritionSnapshot;
  goal: GoalDTO;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Percent of Daily Goals</p>
      <div className="flex gap-3">
        <GoalBar label="Calories" value={nutrition.calories} goal={goal.calories} />
        <GoalBar label="Carbs" value={nutrition.carbsG} goal={goal.carbsG} />
        <GoalBar label="Fat" value={nutrition.fatG} goal={goal.fatG} />
        <GoalBar label="Protein" value={nutrition.proteinG} goal={goal.proteinG} />
      </div>
    </div>
  );
}
