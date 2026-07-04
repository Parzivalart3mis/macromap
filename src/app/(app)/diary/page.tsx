"use client";

import { ChevronDown, Flame, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ErrorState, ListSkeleton } from "@/components/async-states";
import { MealCard } from "@/components/diary/meal-card";
import { WeekStrip } from "@/components/diary/week-strip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client/fetcher";
import { formatDisplayDate, todayISO } from "@/lib/dates";
import { defaultMealForNow } from "@/lib/store-theme";
import { cn } from "@/lib/utils";
import type { DiaryMealDTO, DiaryPayloadDTO, StreakDTO } from "@/types/api";

const DEFAULT_MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function MiniMacro({
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
  const pct = target && target > 0 ? Math.min(100, (value / target) * 100) : 0;
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
        <div
          className="h-full rounded-full transition-[width] duration-700 [transition-timing-function:var(--ease-out-expo)]"
          style={{
            width: `${target ? pct : value > 0 ? 100 : 0}%`,
            backgroundColor: over ? "var(--warning)" : `var(${colorVar})`,
          }}
        />
      </div>
    </div>
  );
}

function DiaryHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramDate = searchParams.get("date");
  const [date, setDate] = useState(() =>
    paramDate && DATE_RE.test(paramDate) ? paramDate : todayISO(),
  );
  const [payload, setPayload] = useState<DiaryPayloadDTO | null>(null);
  const [streak, setStreak] = useState<StreakDTO | null>(null);
  const [recentDates, setRecentDates] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newMealOpen, setNewMealOpen] = useState(false);
  const [newMealName, setNewMealName] = useState("");
  const [insights, setInsights] = useState<string[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (target: string) => {
    try {
      const [data, streakData] = await Promise.all([
        apiFetch<DiaryPayloadDTO>(`/api/diary?date=${target}`),
        apiFetch<{ streak: StreakDTO; recentDates: string[] }>(
          `/api/progress/streak?today=${todayISO()}`,
        ).catch(() => null),
      ]);
      setPayload(data);
      if (streakData) {
        setStreak(streakData.streak);
        setRecentDates(streakData.recentDates);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the diary");
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  // Keep the date in the URL so returning from the add-food page restores it.
  function switchDate(next: string) {
    setDate(next);
    router.replace(next === todayISO() ? "/diary" : `/diary?date=${next}`, {
      scroll: false,
    });
  }

  // Stale payload (from another date) renders as loading, no reset effect needed.
  const current = payload?.date === date ? payload : null;
  const goal = current?.goal ?? null;
  const totals = current?.totals ?? null;
  const remaining = goal && totals ? Math.round(goal.calories - totals.calories) : null;

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
      <header className="top-header app-chrome glass sticky top-0 z-30 border-b border-border/60 px-4 pb-1.5">
        <div className="flex items-center justify-between gap-3 pt-2">
          {/* Native date picker hides behind the title */}
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl text-2xl font-extrabold tracking-tight"
            onClick={() => {
              dateInputRef.current?.showPicker?.();
              dateInputRef.current?.click();
            }}
          >
            {formatDisplayDate(date)}
            <ChevronDown className="size-5 text-muted-foreground" aria-hidden />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={date}
            onChange={(event) => {
              if (DATE_RE.test(event.target.value)) switchDate(event.target.value);
            }}
            className="sr-only"
            aria-label="Pick a date"
            tabIndex={-1}
          />
          {streak ? (
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold",
                streak.todayLogged
                  ? "bg-cta/15 text-cta-foreground dark:text-cta"
                  : "bg-muted text-muted-foreground",
              )}
              title={
                streak.todayLogged
                  ? `Longest streak: ${streak.longest} days`
                  : "Log something today to keep the streak going"
              }
            >
              <Flame
                className={cn("size-4 text-cta", streak.todayLogged && "animate-flame")}
                fill={streak.todayLogged ? "currentColor" : "none"}
                aria-hidden
              />
              {streak.current}
            </span>
          ) : null}
        </div>
        <WeekStrip
          loggedDates={recentDates}
          selected={date}
          today={todayISO()}
          onSelect={switchDate}
        />
      </header>

      {error ? (
        <ErrorState message={error} onRetry={() => load(date)} />
      ) : !current || !totals ? (
        <ListSkeleton rows={5} />
      ) : (
        <div className="stagger-children space-y-4 p-4 pb-28">
          {/* Calories card */}
          <Card className="gap-0 p-4">
            <p className="text-sm font-medium">Calories</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <p className="text-3xl font-extrabold tracking-tight tabular-nums">
                {Math.round(totals.calories)}
                <span className="text-lg font-semibold"> cal</span>
                {goal ? (
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    / {goal.calories.toLocaleString()}
                  </span>
                ) : null}
              </p>
              {remaining != null ? (
                <p className="pb-0.5 text-right tabular-nums">
                  <span
                    className={cn(
                      "text-xl font-bold",
                      remaining < 0 && "text-destructive",
                    )}
                  >
                    {Math.abs(remaining).toLocaleString()}
                  </span>{" "}
                  <span className="text-sm text-muted-foreground">
                    {remaining >= 0 ? "left" : "over"}
                  </span>
                </p>
              ) : null}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-[image:var(--gradient-brand)] transition-[width] duration-700 [transition-timing-function:var(--ease-out-expo)]"
                style={{
                  width: goal
                    ? `${Math.min(100, (totals.calories / goal.calories) * 100)}%`
                    : totals.calories > 0
                      ? "100%"
                      : "0%",
                }}
              />
            </div>
          </Card>

          {/* Macros card */}
          <Card className="p-4">
            <div className="flex gap-4">
              <MiniMacro
                label="Carbs"
                value={totals.carbsG}
                target={goal?.carbsG ?? null}
                colorVar="--chart-2"
              />
              <MiniMacro
                label="Fat"
                value={totals.fatG}
                target={goal?.fatG ?? null}
                colorVar="--chart-3"
              />
              <MiniMacro
                label="Protein"
                value={totals.proteinG}
                target={goal?.proteinG ?? null}
                colorVar="--chart-1"
              />
            </div>
          </Card>

          {/* Diary */}
          <div className="flex items-center justify-between px-1 pt-1">
            <h2 className="text-xl font-extrabold tracking-tight">Diary</h2>
            <Button variant="ghost" size="sm" className="text-primary" onClick={analyze}>
              <Sparkles data-icon="inline-start" aria-hidden />
              Analyze
            </Button>
          </div>

          {mergedMeals(current).map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              date={date}
              onChanged={() => load(date)}
            />
          ))}
          <Button variant="outline" className="w-full" onClick={() => setNewMealOpen(true)}>
            <Plus data-icon="inline-start" aria-hidden />
            Add meal bucket
          </Button>
        </div>
      )}

      {/* Floating quick-log button */}
      <Button
        size="icon-lg"
        aria-label="Log food"
        className="fixed right-4 z-40 size-14 [&_svg]:size-6"
        style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
        asChild
      >
        <Link href={`/diary/add?date=${date}&meal=${encodeURIComponent(defaultMealForNow())}`}>
          <Plus aria-hidden />
        </Link>
      </Button>

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

export default function DiaryPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <DiaryHome />
    </Suspense>
  );
}
