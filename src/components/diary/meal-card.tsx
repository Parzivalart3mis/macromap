"use client";

import {
  BookmarkPlus,
  ChevronRight,
  Coffee,
  Cookie,
  MoreHorizontal,
  RotateCcw,
  Sandwich,
  Soup,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { VerifiedBadge } from "@/components/foods/verified-badge";
import { SwipeToRepeat } from "@/components/diary/swipe-to-repeat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/client/fetcher";
import { formatDisplayDate, todayISO } from "@/lib/dates";
import { haptic } from "@/lib/client/haptics";
import type { DiaryMealDTO } from "@/types/api";

/** Current wall-clock "HH:MM", but only when the meal's date is today. */
function currentTimeIfToday(date: string): string | undefined {
  if (date !== todayISO()) return undefined;
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export const MEAL_ICONS: Record<string, typeof Coffee> = {
  Breakfast: Coffee,
  Lunch: Sandwich,
  Dinner: Soup,
  Snacks: Cookie,
};

export function MealCard({
  meal,
  date,
  onRepeated,
}: {
  meal: DiaryMealDTO;
  date: string;
  /** Refetch the day after "repeat last meal" copies entries in. */
  onRepeated: () => void;
}) {
  const Icon = MEAL_ICONS[meal.mealName] ?? UtensilsCrossed;
  const detailHref = `/diary/meal?date=${date}&meal=${encodeURIComponent(meal.mealName)}`;
  const first = meal.entries[0];
  const [repeating, setRepeating] = useState(false);

  async function repeatLast() {
    if (repeating) return;
    setRepeating(true);
    try {
      const res = await apiFetch<{ copied: number; sourceDate: string | null }>(
        "/api/diary/meals/repeat",
        {
          method: "POST",
          body: JSON.stringify({
            date,
            mealName: meal.mealName,
            eatenTime: currentTimeIfToday(date),
          }),
        },
      );
      if (res.copied === 0) {
        toast(`No earlier ${meal.mealName} to repeat`);
        return;
      }
      haptic("success");
      toast.success(
        `Repeated ${meal.mealName}${res.sourceDate ? ` from ${formatDisplayDate(res.sourceDate)}` : ""}`,
      );
      onRepeated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not repeat that meal");
    } finally {
      setRepeating(false);
    }
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

  return (
    <Card className="card-lift gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <Link href={detailHref} className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold">{meal.mealName}</h2>
        </Link>
        {meal.entries.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Meal options">
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={saveAsTemplate}>
                <BookmarkPlus aria-hidden />
                Save as template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Button size="sm" variant="secondary" className="font-bold" asChild>
          <Link
            href={`/diary/add?date=${date}&meal=${encodeURIComponent(meal.mealName)}`}
          >
            Log
          </Link>
        </Button>
      </div>

      {meal.entries.length === 0 ? (
        // Swipe right (or tap Repeat) to copy your last logged version of this meal.
        <SwipeToRepeat onRepeat={repeatLast} disabled={repeating}>
          <div className="flex items-center gap-3 px-4 pt-1 pb-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-4.5" aria-hidden />
            </span>
            <span className="flex-1 text-sm text-muted-foreground">Nothing logged yet</span>
            <Button
              size="sm"
              variant="ghost"
              className="text-primary"
              onClick={repeatLast}
              disabled={repeating}
            >
              <RotateCcw data-icon="inline-start" aria-hidden />
              Repeat
            </Button>
          </div>
        </SwipeToRepeat>
      ) : (
        // Tap the body to open the full item list
        <Link href={detailHref} className="flex items-start gap-3 px-4 pt-1 pb-3 hover:bg-muted/40">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4.5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="diary-entry-text flex items-center gap-1.5">
              <span className="truncate text-sm font-medium">
                {first.nutritionSnapshotJson.label}
                {meal.entries.length > 1 ? ` and ${meal.entries.length - 1} more` : ""}
              </span>
              {first.verified ? <VerifiedBadge /> : null}
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {Math.round(meal.totals.calories)} cal
            </span>
          </span>
          <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      )}
    </Card>
  );
}
