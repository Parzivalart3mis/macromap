"use client";

import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Copy,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, ListSkeleton } from "@/components/async-states";
import { EntryEditDialog } from "@/components/diary/entry-edit-dialog";
import { SwipeableRow } from "@/components/diary/swipeable-row";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client/fetcher";
import { addDaysISO, formatDisplayDate, todayISO } from "@/lib/dates";
import type { DiaryEntryDTO, DiaryMealDTO, DiaryPayloadDTO } from "@/types/api";

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Calorie donut: segments show each macro's share of the meal's calories
 * (carbs and protein 4 kcal/g, fat 9 kcal/g). Colors are reinforcement only —
 * the numbers next to it carry identity.
 */
function MacroRing({
  calories,
  carbsG,
  fatG,
  proteinG,
}: {
  calories: number;
  carbsG: number;
  fatG: number;
  proteinG: number;
}) {
  const carbsCal = carbsG * 4;
  const fatCal = fatG * 9;
  const proteinCal = proteinG * 4;
  const macroCal = carbsCal + fatCal + proteinCal;
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const segments =
    macroCal > 0
      ? [
          { color: "var(--chart-2)", fraction: carbsCal / macroCal },
          { color: "var(--chart-3)", fraction: fatCal / macroCal },
          { color: "var(--chart-1)", fraction: proteinCal / macroCal },
        ]
      : [];

  let offset = 0;
  return (
    <div className="relative size-32 shrink-0" role="img" aria-label={`${Math.round(calories)} calories`}>
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--muted)" strokeWidth="9" />
        {segments.map((segment, index) => {
          // 2px-equivalent gap between segments keeps them CVD-distinct.
          const gap = segments.length > 1 ? 2.5 : 0;
          const length = Math.max(0, segment.fraction * circumference - gap);
          const dashOffset = -offset;
          offset += segment.fraction * circumference;
          return (
            <circle
              key={index}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={segment.color}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dasharray,stroke-dashoffset] duration-700 [transition-timing-function:var(--ease-out-expo)]"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tracking-tight tabular-nums">
          {Math.round(calories)}
        </span>
        <span className="text-xs text-muted-foreground">cal</span>
      </div>
    </div>
  );
}

function macroPct(part: number, carbsG: number, fatG: number, proteinG: number): number {
  const total = carbsG * 4 + fatG * 9 + proteinG * 4;
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Copy this meal's items from / to another day. */
function CopyDialog({
  direction,
  meal,
  date,
  onOpenChange,
  onDone,
}: {
  direction: "from" | "to";
  meal: DiaryMealDTO;
  date: string;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [otherDate, setOtherDate] = useState(() => addDaysISO(date, -1));
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!DATE_RE.test(otherDate)) {
      toast.error("Pick a date");
      return;
    }
    setBusy(true);
    try {
      let source: DiaryEntryDTO[];
      let targetDate: string;
      if (direction === "from") {
        const payload = await apiFetch<DiaryPayloadDTO>(`/api/diary?date=${otherDate}`);
        source =
          payload.meals.find((m) => m.mealName === meal.mealName)?.entries ?? [];
        targetDate = date;
      } else {
        source = meal.entries;
        targetDate = otherDate;
      }
      const loggable = source.filter(
        (entry) => entry.foodId ?? entry.customStoreOrderId,
      );
      if (loggable.length === 0) {
        toast.error(
          direction === "from"
            ? `No ${meal.mealName.toLowerCase()} items on ${formatDisplayDate(otherDate)}`
            : "Nothing to copy",
        );
        return;
      }
      for (const entry of loggable) {
        await apiFetch("/api/diary/entries", {
          method: "POST",
          body: JSON.stringify({
            date: targetDate,
            mealName: meal.mealName,
            foodId: entry.foodId ?? undefined,
            customStoreOrderId: entry.customStoreOrderId ?? undefined,
            quantity: entry.quantity,
            servingMultiplier: entry.servingMultiplier,
            loggedVia: "saved_meal",
          }),
        });
      }
      toast.success(
        `Copied ${loggable.length} ${loggable.length === 1 ? "item" : "items"} ${
          direction === "from" ? "from" : "to"
        } ${formatDisplayDate(otherDate)}`,
      );
      onOpenChange(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copy failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {direction === "from" ? "Copy from another day" : "Copy to another day"}
          </DialogTitle>
          <DialogDescription>
            {direction === "from"
              ? `Bring that day's ${meal.mealName.toLowerCase()} items into ${formatDisplayDate(date)}`
              : `Send today's ${meal.mealName.toLowerCase()} items to another day`}
          </DialogDescription>
        </DialogHeader>
        <Input
          type="date"
          value={otherDate}
          onChange={(event) => setOtherDate(event.target.value)}
          aria-label="Other date"
        />
        <Button disabled={busy} onClick={run}>
          {busy ? "Copying..." : "Copy items"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function MealDetail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramDate = searchParams.get("date");
  const date = paramDate && DATE_RE.test(paramDate) ? paramDate : todayISO();
  const paramMeal = searchParams.get("meal");
  const mealName = paramMeal && paramMeal.length <= 40 ? paramMeal : "Breakfast";

  const [payload, setPayload] = useState<DiaryPayloadDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DiaryEntryDTO | null>(null);
  const [copying, setCopying] = useState<"from" | "to" | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<DiaryPayloadDTO>(`/api/diary?date=${date}`);
      setPayload(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this meal");
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const meal: DiaryMealDTO = payload?.meals.find((m) => m.mealName === mealName) ?? {
    id: `virtual-${mealName}`,
    mealName,
    displayOrder: 0,
    entries: [],
    totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  };
  const { totals } = meal;

  function switchMeal(next: string) {
    router.replace(`/diary/meal?date=${date}&meal=${encodeURIComponent(next)}`, {
      scroll: false,
    });
  }

  async function saveAsTemplate() {
    const name = window.prompt("Template name", meal.mealName);
    if (!name) return;
    try {
      await apiFetch("/api/saved-meals", {
        method: "POST",
        body: JSON.stringify({ name, date, mealName: meal.mealName }),
      });
      toast.success("Meal saved as template");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    }
  }

  async function deleteEntry(entry: DiaryEntryDTO) {
    // Hide immediately so the swipe-out is not undone by the reload.
    setHidden((prev) => new Set(prev).add(entry.id));
    try {
      await apiFetch(`/api/diary/entries/${entry.id}`, { method: "DELETE" });
      toast.success(`Removed ${entry.nutritionSnapshotJson.label}`, {
        action:
          entry.foodId || entry.customStoreOrderId
            ? {
                label: "Undo",
                onClick: async () => {
                  try {
                    await apiFetch("/api/diary/entries", {
                      method: "POST",
                      body: JSON.stringify({
                        date,
                        mealName: meal.mealName,
                        foodId: entry.foodId ?? undefined,
                        customStoreOrderId: entry.customStoreOrderId ?? undefined,
                        quantity: entry.quantity,
                        servingMultiplier: entry.servingMultiplier,
                        loggedVia: entry.loggedVia,
                      }),
                    });
                    load();
                  } catch {
                    toast.error("Could not restore the entry");
                  }
                },
              }
            : undefined,
      });
    } catch (error) {
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      load();
    }
  }

  return (
    <main>
      <header className="top-header app-chrome glass sticky top-0 z-30 border-b border-border/60 px-4 pb-3">
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to diary"
            onClick={() => router.back()}
          >
            <ArrowLeft aria-hidden />
          </Button>
          <div className="flex flex-1 justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-xl text-lg font-bold text-primary"
                >
                  {mealName}
                  <ChevronDown className="size-4" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {MEALS.map((name) => (
                  <DropdownMenuItem key={name} onSelect={() => switchMeal(name)}>
                    {name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <span className="size-9" aria-hidden />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {formatDisplayDate(date)}
        </p>
      </header>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !payload ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="stagger-children space-y-4 p-4 pb-10">
          {/* Summary: donut + macro columns */}
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <MacroRing
                calories={totals.calories}
                carbsG={totals.carbsG}
                fatG={totals.fatG}
                proteinG={totals.proteinG}
              />
              <div className="flex flex-1 justify-around gap-2 text-center">
                {(
                  [
                    ["Carbs", totals.carbsG, totals.carbsG * 4, "--chart-2"],
                    ["Fat", totals.fatG, totals.fatG * 9, "--chart-3"],
                    ["Protein", totals.proteinG, totals.proteinG * 4, "--chart-1"],
                  ] as const
                ).map(([label, grams, cal, colorVar]) => (
                  <div key={label}>
                    <p
                      className="text-sm font-bold tabular-nums"
                      style={{ color: `var(${colorVar})` }}
                    >
                      {macroPct(cal, totals.carbsG, totals.fatG, totals.proteinG)}%
                    </p>
                    <p className="text-lg font-bold tabular-nums">{Math.round(grams)} g</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setCopying("from")}
              className="card-lift flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-1 py-3 text-xs font-semibold text-primary shadow-[var(--shadow-soft)]"
            >
              <Copy className="size-5" aria-hidden />
              Copy from
            </button>
            <button
              type="button"
              onClick={() => setCopying("to")}
              disabled={meal.entries.length === 0}
              className="card-lift flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-1 py-3 text-xs font-semibold text-primary shadow-[var(--shadow-soft)] disabled:opacity-50"
            >
              <Copy className="size-5" aria-hidden />
              Copy to
            </button>
            <button
              type="button"
              onClick={saveAsTemplate}
              disabled={meal.entries.length === 0}
              className="card-lift flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-1 py-3 text-xs font-semibold text-primary shadow-[var(--shadow-soft)] disabled:opacity-50"
            >
              <Bookmark className="size-5" aria-hidden />
              Save meal
            </button>
          </div>

          {/* Logged items */}
          {meal.entries.length === 0 ? (
            <EmptyState
              title="Nothing logged in this meal"
              body="Add something with the button below."
            />
          ) : (
            <div className="stagger-children space-y-2">
              {meal.entries
                .filter((entry) => !hidden.has(entry.id))
                .map((entry) => (
                  <SwipeableRow key={entry.id} onDelete={() => deleteEntry(entry)}>
                    <button
                      type="button"
                      onClick={() => setEditing(entry)}
                      className="diary-row flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-[var(--shadow-soft)]"
                    >
                      <span className="diary-entry-text min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {entry.nutritionSnapshotJson.label}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {entry.quantity !== 1 ? `${entry.quantity} servings` : "1 serving"}
                        </span>
                        <span className="block text-sm tabular-nums text-muted-foreground">
                          {Math.round(entry.nutritionSnapshotJson.calories)} cal
                        </span>
                      </span>
                      <ChevronRight
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </button>
                  </SwipeableRow>
                ))}
            </div>
          )}
          {meal.entries.length > 0 ? (
            <p className="text-center text-xs text-muted-foreground">
              Swipe an item left or right to remove it
            </p>
          ) : null}

          <Button size="lg" className="w-full" asChild>
            <Link href={`/diary/add?date=${date}&meal=${encodeURIComponent(mealName)}`}>
              Log more
            </Link>
          </Button>
        </div>
      )}

      {editing ? (
        <EntryEditDialog
          entry={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onChanged={load}
        />
      ) : null}
      {copying ? (
        <CopyDialog
          direction={copying}
          meal={meal}
          date={date}
          onOpenChange={(open) => {
            if (!open) setCopying(null);
          }}
          onDone={load}
        />
      ) : null}
    </main>
  );
}

export default function MealDetailPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <MealDetail />
    </Suspense>
  );
}
