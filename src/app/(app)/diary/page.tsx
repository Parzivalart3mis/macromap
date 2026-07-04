"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ErrorState, ListSkeleton } from "@/components/async-states";
import { AddFoodSheet } from "@/components/diary/add-food-sheet";
import { DaySummary } from "@/components/diary/day-summary";
import { MealCard } from "@/components/diary/meal-card";
import { PageHeader } from "@/components/shell/page-header";
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
import { addDaysISO, formatDisplayDate, todayISO } from "@/lib/dates";
import type { DiaryMealDTO, DiaryPayloadDTO, StreakDTO } from "@/types/api";

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

export default function DiaryPage() {
  const [date, setDate] = useState(todayISO());
  const [payload, setPayload] = useState<DiaryPayloadDTO | null>(null);
  const [streak, setStreak] = useState<StreakDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addTarget, setAddTarget] = useState<string | null>(null);
  const [newMealOpen, setNewMealOpen] = useState(false);
  const [newMealName, setNewMealName] = useState("");
  const [insights, setInsights] = useState<string[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(async (target: string) => {
    try {
      const [data, streakData] = await Promise.all([
        apiFetch<DiaryPayloadDTO>(`/api/diary?date=${target}`),
        apiFetch<{ streak: StreakDTO }>(`/api/progress/streak?today=${todayISO()}`).catch(
          () => null,
        ),
      ]);
      setPayload(data);
      if (streakData) setStreak(streakData.streak);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the diary");
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  // Stale payload (from another date) renders as loading, no reset effect needed.
  const current = payload?.date === date ? payload : null;

  async function addCustomMeal() {
    const name = newMealName.trim();
    if (!name) return;
    try {
      await apiFetch("/api/diary/meals", {
        method: "POST",
        body: JSON.stringify({ date, mealName: name }),
      });
      setNewMealOpen(false);
      setNewMealName("");
      load(date);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add meal");
    }
  }

  async function analyze() {
    setAnalyzing(true);
    try {
      const data = await apiFetch<{ insights: string[] }>("/api/diary/analyze", {
        method: "POST",
        body: JSON.stringify({ date }),
      });
      setInsights(data.insights);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <main>
      <PageHeader
        title="Diary"
        action={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous day"
              onClick={() => setDate((d) => addDaysISO(d, -1))}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <button
              type="button"
              className="min-w-24 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
              onClick={() => setDate(todayISO())}
              title="Jump to today"
            >
              {formatDisplayDate(date)}
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next day"
              onClick={() => setDate((d) => addDaysISO(d, 1))}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={() => load(date)} />
      ) : !current ? (
        <ListSkeleton rows={5} />
      ) : (
        <div className="stagger-children space-y-4 p-4">
          <DaySummary payload={current} streak={streak} onAnalyze={analyze} />
          {mergedMeals(current).map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              date={date}
              onAddFood={(mealName) => setAddTarget(mealName)}
              onChanged={() => load(date)}
            />
          ))}
          <Button variant="outline" className="w-full" onClick={() => setNewMealOpen(true)}>
            <Plus data-icon="inline-start" aria-hidden />
            Add meal bucket
          </Button>
        </div>
      )}

      <AddFoodSheet
        open={addTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAddTarget(null);
        }}
        date={date}
        mealName={addTarget ?? "Snacks"}
        onLogged={() => load(date)}
      />

      <Dialog open={newMealOpen} onOpenChange={setNewMealOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New meal bucket</DialogTitle>
            <DialogDescription>
              Add a custom meal like Pre-workout or Late snack for this day
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Meal name"
            value={newMealName}
            maxLength={40}
            onChange={(event) => setNewMealName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addCustomMeal();
            }}
          />
          <Button onClick={addCustomMeal} disabled={!newMealName.trim()}>
            Add meal
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={insights !== null || analyzing}
        onOpenChange={(open) => {
          if (!open) {
            setInsights(null);
            setAnalyzing(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Day analysis</DialogTitle>
            <DialogDescription>{formatDisplayDate(date)}</DialogDescription>
          </DialogHeader>
          {analyzing ? (
            <p className="py-4 text-sm text-muted-foreground">Analyzing your day...</p>
          ) : (
            <ul className="space-y-2 py-2">
              {insights?.map((insight, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <span className="text-primary" aria-hidden>
                    •
                  </span>
                  {insight}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
