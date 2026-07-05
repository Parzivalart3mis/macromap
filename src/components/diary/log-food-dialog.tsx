"use client";

import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";

import { DailyGoalBars } from "@/components/nutrition/goal-bars";
import { MacroRing, macroPctOfCalories } from "@/components/nutrition/macro-ring";
import { NutritionPanel } from "@/components/nutrition/nutrition-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client/fetcher";
import { cn } from "@/lib/utils";
import type { DiaryPayloadDTO, FoodDTO, GoalDTO } from "@/types/api";
import type { NutritionSnapshot } from "@/types/nutrition";
import { NUTRITION_KEYS } from "@/types/nutrition";

function scaleFood(food: FoodDTO, factor: number): NutritionSnapshot {
  const snapshot: NutritionSnapshot = {
    calories: food.calories * factor,
    proteinG: food.proteinG * factor,
    carbsG: food.carbsG * factor,
    fatG: food.fatG * factor,
  };
  for (const key of NUTRITION_KEYS) {
    if (key in snapshot) continue;
    const value = food[key as keyof FoodDTO];
    if (typeof value === "number") snapshot[key] = value * factor;
  }
  return snapshot;
}

/* State lives in the body, which Radix unmounts on close — every open starts
   fresh without reset effects. */
function LogFoodBody({
  food,
  mealName,
  date,
  onConfirm,
  busy,
}: {
  food: FoodDTO;
  mealName?: string;
  date?: string;
  onConfirm: (quantity: number) => void;
  busy: boolean;
}) {
  // Free-text decimal entry ("1.5") — iOS shows the decimal numpad.
  const [servings, setServings] = useState("1");
  const [factsOpen, setFactsOpen] = useState(false);
  const [goal, setGoal] = useState<GoalDTO | null>(null);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    apiFetch<DiaryPayloadDTO>(`/api/diary?date=${date}`)
      .then((payload) => {
        if (!cancelled) setGoal(payload.goal);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [date]);

  const quantity = Number(servings);
  const valid = Number.isFinite(quantity) && quantity > 0;
  const nutrition = scaleFood(food, valid ? quantity : 0);

  return (
    <>
      {/* Fields */}
      <div className="divide-y rounded-xl border bg-card text-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="font-medium">Serving Size</span>
          <span className="rounded-lg border px-3 py-1.5 font-semibold text-primary">
            {food.servingSizeValue} {food.servingSizeUnit}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <label htmlFor="servings-input" className="font-medium">
            Number of Servings
          </label>
          <Input
            id="servings-input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={servings}
            onChange={(event) => {
              // Digits plus at most one decimal point.
              const raw = event.target.value.replace(/[^0-9.]/g, "");
              const parts = raw.split(".");
              setServings(
                parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : raw,
              );
            }}
            className={cn(
              "h-9 w-24 text-right font-semibold",
              !valid && servings !== "" && "border-destructive",
            )}
          />
        </div>
        {mealName ? (
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="font-medium">Meal</span>
            <span className="rounded-lg border px-3 py-1.5 font-semibold text-primary">
              {mealName}
            </span>
          </div>
        ) : null}
      </div>

      {/* Macros */}
      <div className="flex items-center gap-4 py-1">
        <MacroRing
          calories={nutrition.calories}
          carbsG={nutrition.carbsG}
          fatG={nutrition.fatG}
          proteinG={nutrition.proteinG}
          className="size-28"
        />
        <div className="flex flex-1 justify-around gap-2 text-center">
          {(
            [
              ["Carbs", nutrition.carbsG, nutrition.carbsG * 4, "--chart-2"],
              ["Fat", nutrition.fatG, nutrition.fatG * 9, "--chart-3"],
              ["Protein", nutrition.proteinG, nutrition.proteinG * 4, "--chart-1"],
            ] as const
          ).map(([label, grams, cal, colorVar]) => (
            <div key={label}>
              <p
                className="text-sm font-bold tabular-nums"
                style={{ color: `var(${colorVar})` }}
              >
                {macroPctOfCalories(cal, nutrition.carbsG, nutrition.fatG, nutrition.proteinG)}
                %
              </p>
              <p className="text-base font-bold tabular-nums">{Math.round(grams)} g</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Percent of daily goals */}
      {goal ? <DailyGoalBars nutrition={nutrition} goal={goal} /> : null}

      {/* Collapsible full label */}
      <div>
        <button
          type="button"
          className="flex w-full items-center justify-between py-1 text-sm font-semibold"
          aria-expanded={factsOpen}
          onClick={() => setFactsOpen((open) => !open)}
        >
          Nutrition Facts
          <span className="flex items-center gap-1 font-semibold text-primary">
            {factsOpen ? "Hide" : "Show"}
            {factsOpen ? (
              <ChevronUp className="size-4" aria-hidden />
            ) : (
              <ChevronDown className="size-4" aria-hidden />
            )}
          </span>
        </button>
        {factsOpen ? (
          <div className="animate-fade-up pt-1">
            <NutritionPanel nutrition={nutrition} showAll />
          </div>
        ) : null}
      </div>

      <Button size="lg" disabled={busy || !valid} onClick={() => onConfirm(quantity)}>
        <Check data-icon="inline-start" aria-hidden />
        {busy ? "Logging..." : "Log food"}
      </Button>
    </>
  );
}

export function LogFoodDialog({
  food,
  open,
  onOpenChange,
  onConfirm,
  busy = false,
  mealName,
  date,
}: {
  food: FoodDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (quantity: number) => void;
  busy?: boolean;
  mealName?: string;
  date?: string;
}) {
  if (!food) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="diary-entry-text pr-6 text-lg leading-snug">
            {food.name}
          </DialogTitle>
          <DialogDescription>{food.brandName ?? "Generic"}</DialogDescription>
        </DialogHeader>
        <LogFoodBody
          key={food.id}
          food={food}
          mealName={mealName}
          date={date}
          onConfirm={onConfirm}
          busy={busy}
        />
      </DialogContent>
    </Dialog>
  );
}
