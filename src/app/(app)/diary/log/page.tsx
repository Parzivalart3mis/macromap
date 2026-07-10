"use client";

import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { ErrorState, ListSkeleton } from "@/components/async-states";
import { DailyGoalBars } from "@/components/nutrition/goal-bars";
import { MacroRing, macroPctOfCalories } from "@/components/nutrition/macro-ring";
import { NutritionPanel } from "@/components/nutrition/nutrition-panel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiFetch } from "@/lib/client/fetcher";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { computeServing, formatNum, servingOptions, type UnitOption } from "@/lib/units";
import type { DiaryPayloadDTO, FoodDTO, GoalDTO } from "@/types/api";

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VIA_VALUES = ["search", "barcode", "voice", "natural_language", "store_builder"] as const;
type LoggedVia = (typeof VIA_VALUES)[number];

function LogFoodView() {
  const router = useRouter();
  const params = useSearchParams();
  const foodId = params.get("foodId") ?? "";
  const date = (() => {
    const d = params.get("date");
    return d && DATE_RE.test(d) ? d : todayISO();
  })();
  const via: LoggedVia = VIA_VALUES.includes(params.get("via") as LoggedVia)
    ? (params.get("via") as LoggedVia)
    : "search";

  const [food, setFood] = useState<FoodDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState<GoalDTO | null>(null);
  const [mealName, setMealName] = useState(() => {
    const m = params.get("meal");
    return m && m.length <= 40 ? m : "Snacks";
  });
  // Opening from History pre-fills the last-used serving count.
  const [servings, setServings] = useState(() => {
    const n = Number(params.get("servings"));
    return Number.isFinite(n) && n > 0 ? formatNum(n) : "1";
  });
  const [option, setOption] = useState<UnitOption | null>(null);
  const [unitSheetOpen, setUnitSheetOpen] = useState(false);
  const [factsOpen, setFactsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Wall-clock time eaten. Defaults to now only when logging for today —
  // backfilling a past date starts blank.
  const [eatenTime, setEatenTime] = useState(() => {
    if (date !== todayISO()) return "";
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  });

  useEffect(() => {
    if (!foodId) {
      setError("No food specified");
      return;
    }
    let cancelled = false;
    apiFetch<{ food: FoodDTO }>(`/api/foods/${foodId}`)
      .then((data) => {
        if (cancelled) return;
        setFood(data.food);
        setOption(servingOptions(data.food)[0] ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load food");
      });
    apiFetch<DiaryPayloadDTO>(`/api/diary?date=${date}`)
      .then((payload) => {
        if (!cancelled) setGoal(payload.goal);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [foodId, date]);

  if (error) {
    return (
      <main>
        <ErrorState message={error} onRetry={() => router.back()} />
      </main>
    );
  }
  if (!food || !option) {
    return (
      <main>
        <ListSkeleton rows={5} />
      </main>
    );
  }

  const options = servingOptions(food);
  const servingNum = Number(servings);
  const valid = Number.isFinite(servingNum) && servingNum > 0;
  const { quantity, servingMultiplier, servingText, nutrition } = computeServing(
    food,
    option,
    valid ? servingNum : 0,
  );

  async function log() {
    if (!valid) {
      toast.error("Enter a number of servings");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/diary/entries", {
        method: "POST",
        body: JSON.stringify({
          date,
          mealName,
          foodId,
          quantity,
          servingMultiplier,
          servingText,
          eatenTime: eatenTime || undefined,
          loggedVia: via,
        }),
      });
      toast.success(`Logged to ${mealName}`);
      // Return to the screen that opened this (the meal's Add Food search, or a
      // store menu) so the user can keep logging more.
      router.back();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logging failed");
      setBusy(false);
    }
  }

  return (
    <main className="pb-10">
      <header className="top-header app-chrome glass sticky top-0 z-30 border-b border-border/60 px-4 pb-3">
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back"
            onClick={() => router.back()}
          >
            <X aria-hidden />
          </Button>
          <h1 className="text-lg font-bold">Add Food</h1>
          <Button
            variant="ghost"
            size="sm"
            className="font-bold text-primary"
            disabled={busy || !valid}
            onClick={log}
          >
            {busy ? "..." : "Log"}
          </Button>
        </div>
      </header>

      <div className="space-y-5 p-4">
        <div>
          <h2 className="diary-entry-text text-2xl font-extrabold tracking-tight">
            {food.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {food.brandName ? `${food.brandName}, ` : ""}
            {food.servingSizeValue} {food.servingSizeUnit}
          </p>
          {food.description ? (
            <p className="diary-entry-text mt-2 rounded-xl bg-muted/60 px-3 py-2 text-sm text-foreground/80">
              {food.description}
            </p>
          ) : null}
        </div>

        {/* Fields */}
        <div className="divide-y rounded-2xl border bg-card text-sm">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            onClick={() => setUnitSheetOpen(true)}
          >
            <span className="font-medium">Serving Size</span>
            <span className="flex items-center gap-1 rounded-lg border px-3 py-1.5 font-semibold text-primary">
              {option.label}
              <ChevronDown className="size-3.5" aria-hidden />
            </span>
          </button>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <label htmlFor="servings" className="font-medium">
              Number of Servings
            </label>
            <Input
              id="servings"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={servings}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => {
                const raw = event.target.value.replace(/[^0-9.]/g, "");
                const parts = raw.split(".");
                setServings(parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : raw);
              }}
              className={cn(
                "h-9 w-24 text-right font-semibold",
                !valid && servings !== "" && "border-destructive",
              )}
            />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <label htmlFor="eaten-time" className="font-medium">
              Time
            </label>
            <input
              id="eaten-time"
              type="time"
              value={eatenTime}
              onChange={(event) => setEatenTime(event.target.value)}
              className="rounded-lg border bg-transparent px-3 py-1.5 font-semibold text-primary"
            />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="font-medium">Meal</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-lg border px-3 py-1.5 font-semibold text-primary"
                >
                  {mealName}
                  <ChevronDown className="size-3.5" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {MEALS.map((meal) => (
                  <DropdownMenuItem key={meal} onSelect={() => setMealName(meal)}>
                    {meal}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Macros */}
        <div className="flex items-center gap-4">
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
                ["Carbs", nutrition.carbsG, nutrition.carbsG * 4, "--macro-carbs"],
                ["Fat", nutrition.fatG, nutrition.fatG * 9, "--macro-fat"],
                ["Protein", nutrition.proteinG, nutrition.proteinG * 4, "--macro-protein"],
              ] as const
            ).map(([label, grams, cal, colorVar]) => (
              <div key={label}>
                <p
                  className="text-sm font-bold tabular-nums"
                  style={{ color: `var(${colorVar})` }}
                >
                  {macroPctOfCalories(cal, nutrition.carbsG, nutrition.fatG, nutrition.proteinG)}%
                </p>
                <p className="text-base font-bold tabular-nums">{Math.round(grams)} g</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {goal ? <DailyGoalBars nutrition={nutrition} goal={goal} /> : null}

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
      </div>

      {/* Unit selector */}
      <Sheet open={unitSheetOpen} onOpenChange={setUnitSheetOpen}>
        <SheetContent side="bottom" className="sheet-safe-bottom max-h-[70dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Select Unit</SheetTitle>
          </SheetHeader>
          <ul className="space-y-1 px-4 pb-6">
            {options.map((opt) => {
              const active = opt.label === option.label;
              return (
                <li key={opt.label}>
                  <button
                    type="button"
                    onClick={() => {
                      setOption(opt);
                      setUnitSheetOpen(false);
                    }}
                    className={cn(
                      "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 text-left font-medium",
                      active ? "border-primary bg-primary/5" : "bg-card",
                    )}
                  >
                    {opt.label}
                    {active ? <Check className="size-5 text-primary" aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </main>
  );
}

export default function LogFoodPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <LogFoodView />
    </Suspense>
  );
}
