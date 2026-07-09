"use client";

import { ArrowLeft, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import { apiFetch } from "@/lib/client/fetcher";
import { todayISO } from "@/lib/dates";
import { roundNutrition, scaleNutrition, sumNutrition } from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import type { GoalDTO, SavedMealDTO } from "@/types/api";

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function AddMealView() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params.id;
  const date = (() => {
    const d = search.get("date");
    return d && DATE_RE.test(d) ? d : todayISO();
  })();

  const [meal, setMeal] = useState<SavedMealDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState<GoalDTO | null>(null);
  const [mealName, setMealName] = useState(() => {
    const m = search.get("meal");
    return m && m.length <= 40 ? m : "Breakfast";
  });
  const [servings, setServings] = useState("1");
  // Defaults to now only when logging for today; past dates start blank.
  const [eatenTime, setEatenTime] = useState(() => {
    if (date !== todayISO()) return "";
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  });
  const [factsOpen, setFactsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ savedMeal: SavedMealDTO }>(`/api/saved-meals/${id}`)
      .then((data) => {
        if (!cancelled) setMeal(data.savedMeal);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load meal");
      });
    apiFetch<{ goal: GoalDTO | null }>(`/api/diary?date=${date}`)
      .then((payload) => {
        if (!cancelled) setGoal(payload.goal);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id, date]);

  if (error) {
    return (
      <main>
        <ErrorState message={error} onRetry={() => router.back()} />
      </main>
    );
  }
  if (!meal) {
    return (
      <main>
        <ListSkeleton rows={5} />
      </main>
    );
  }

  const servingNum = Number(servings);
  const valid = Number.isFinite(servingNum) && servingNum > 0;
  const baseTotal = sumNutrition(meal.entriesSnapshotJson.map((line) => line.nutrition));
  const nutrition = roundNutrition(scaleNutrition(baseTotal, valid ? servingNum : 0));

  async function log() {
    if (!valid) {
      toast.error("Enter a number of servings");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/saved-meals/${id}/log`, {
        method: "POST",
        body: JSON.stringify({
          date,
          mealName,
          servings: servingNum,
          eatenTime: eatenTime || undefined,
        }),
      });
      toast.success(`Logged ${meal!.name} to ${mealName}`);
      // Replace so back from the diary skips this completed form.
      router.replace(date === todayISO() ? "/diary" : `/diary?date=${date}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logging failed");
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${meal!.name}"?`)) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/saved-meals/${id}`, { method: "DELETE" });
      toast.success(`Deleted ${meal!.name}`);
      router.replace("/more/foods?tab=meals");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <main className="pb-10">
      <header className="top-header app-chrome glass sticky top-0 z-30 border-b border-border/60 px-4 pb-3">
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="icon-sm" aria-label="Back" onClick={() => router.back()}>
            <ArrowLeft aria-hidden />
          </Button>
          <h1 className="text-lg font-bold">Add Meal</h1>
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
          <h2 className="text-2xl font-extrabold tracking-tight">{meal.name}</h2>
          <p className="text-sm text-muted-foreground">
            {meal.entriesSnapshotJson.length}{" "}
            {meal.entriesSnapshotJson.length === 1 ? "item" : "items"}
          </p>
        </div>

        {/* Fields */}
        <div className="divide-y rounded-2xl border bg-card text-sm">
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
                {MEALS.map((m) => (
                  <DropdownMenuItem key={m} onSelect={() => setMealName(m)}>
                    {m}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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

        {/* Nutrition facts */}
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

        {/* Meal items */}
        <section>
          <h3 className="mb-2 text-lg font-extrabold tracking-tight">Meal Items</h3>
          <div className="divide-y rounded-2xl border bg-card">
            {meal.entriesSnapshotJson.map((line, index) => (
              <div key={index} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate text-[14px] font-medium">{line.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {Math.round(line.nutrition.calories * (valid ? servingNum : 1))} cal
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Directions */}
        {meal.directions ? (
          <section className="rounded-2xl bg-muted/60 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Directions
            </p>
            <p className="whitespace-pre-wrap">{meal.directions}</p>
          </section>
        ) : null}

        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push(`/more/foods/new-meal?edit=${id}&from=meals`)}
        >
          <Pencil data-icon="inline-start" aria-hidden />
          Edit meal
        </Button>

        <Button variant="destructive" className="w-full" disabled={deleting} onClick={remove}>
          <Trash2 data-icon="inline-start" aria-hidden />
          {deleting ? "Deleting..." : "Delete meal"}
        </Button>
      </div>
    </main>
  );
}

export default function AddMealPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <AddMealView />
    </Suspense>
  );
}
