"use client";

import {
  BookmarkPlus,
  ChevronRight,
  Coffee,
  Cookie,
  MoreHorizontal,
  Sandwich,
  Soup,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { VerifiedBadge } from "@/components/foods/verified-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/client/fetcher";
import type { DiaryMealDTO } from "@/types/api";

export const MEAL_ICONS: Record<string, typeof Coffee> = {
  Breakfast: Coffee,
  Lunch: Sandwich,
  Dinner: Soup,
  Snacks: Cookie,
};

export function MealCard({ meal, date }: { meal: DiaryMealDTO; date: string }) {
  const Icon = MEAL_ICONS[meal.mealName] ?? UtensilsCrossed;
  const detailHref = `/diary/meal?date=${date}&meal=${encodeURIComponent(meal.mealName)}`;
  const first = meal.entries[0];

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

      {/* Tap the body to open the full item list */}
      <Link href={detailHref} className="flex items-start gap-3 px-4 pt-1 pb-3 hover:bg-muted/40">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          {meal.entries.length === 0 ? (
            <span className="block py-1.5 text-sm text-muted-foreground">
              Nothing logged yet
            </span>
          ) : (
            <>
              <span className="diary-entry-text flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">
                  {first.nutritionSnapshotJson.label}
                  {meal.entries.length > 1
                    ? ` and ${meal.entries.length - 1} more`
                    : ""}
                </span>
                {first.verified ? <VerifiedBadge /> : null}
              </span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {Math.round(meal.totals.calories)} cal
              </span>
            </>
          )}
        </span>
        <ChevronRight
          className="mt-2 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </Link>
    </Card>
  );
}
