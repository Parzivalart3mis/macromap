"use client";

import { Flame, Sparkles } from "lucide-react";

import { MacroMeter } from "@/components/nutrition/macro-meter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {streak && streak.current > 0 ? (
          <div
            className="flex items-center gap-1.5 text-sm font-medium"
            title={
              streak.todayLogged
                ? `Longest streak: ${streak.longest} days`
                : "Log something today to keep the streak going"
            }
          >
            <Flame
              className={cn(
                "size-4",
                streak.todayLogged ? "text-cta" : "text-muted-foreground",
              )}
              fill={streak.todayLogged ? "currentColor" : "none"}
              aria-hidden
            />
            <span>
              {streak.current} day{streak.current === 1 ? "" : "s"} streak
            </span>
            {!streak.todayLogged ? (
              <span className="text-xs font-normal text-muted-foreground">
                — log today to keep it
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Calories</p>
            <p className="text-3xl font-bold tabular-nums">
              {Math.round(totals.calories)}
              {goal ? (
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  / {goal.calories}
                </span>
              ) : null}
            </p>
            {remaining != null ? (
              <p
                className={cn(
                  "text-xs",
                  remaining < 0 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {remaining >= 0
                  ? `${remaining} remaining`
                  : `${Math.abs(remaining)} over goal`}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">No goal set for this day</p>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={onAnalyze}>
            <Sparkles data-icon="inline-start" aria-hidden />
            Analyze
          </Button>
        </div>

        <div className="grid gap-3">
          <MacroMeter
            label="Protein"
            value={totals.proteinG}
            target={goal?.proteinG ?? null}
            colorVar="--chart-1"
          />
          <MacroMeter
            label="Carbs"
            value={totals.carbsG}
            target={goal?.carbsG ?? null}
            colorVar="--chart-2"
          />
          <MacroMeter
            label="Fat"
            value={totals.fatG}
            target={goal?.fatG ?? null}
            colorVar="--chart-3"
          />
        </div>
      </CardContent>
    </Card>
  );
}
