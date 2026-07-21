"use client";

import { ArrowLeft, Check, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { VerifiedBadge } from "@/components/foods/verified-badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client/fetcher";
import { nativeServingLabel, scaleServingText } from "@/lib/units";
import { cn } from "@/lib/utils";
import type { DiaryEntryDTO, FoodDTO, GoalDTO } from "@/types/api";
import { NUTRITION_KEYS, type NutritionSnapshot } from "@/types/nutrition";

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];

function scaleSnapshot(
  snapshot: NutritionSnapshot,
  factor: number,
): NutritionSnapshot {
  const scaled: NutritionSnapshot = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const key of NUTRITION_KEYS) {
    const value = snapshot[key];
    if (value != null) scaled[key] = value * factor;
  }
  return scaled;
}

/**
 * Full "Edit Entry" view for an already-logged item: servings (decimal
 * numpad), meal switcher, macro ring, percent of daily goals, and the full
 * collapsible label. Mounted only while editing, so state initializes fresh.
 */
export function EntryEditDialog({
  entry,
  mealName,
  goal = null,
  onOpenChange,
  onChanged,
}: {
  entry: DiaryEntryDTO;
  mealName: string;
  goal?: GoalDTO | null;
  onOpenChange: (open: boolean) => void;
  /**
   * Fires after a successful save/delete. Receives the updated entry (same
   * meal), or null when the entry left this meal (moved or deleted) so the
   * caller can update its list without waiting for a refetch.
   */
  onChanged: (updated?: DiaryEntryDTO | null) => void;
}) {
  const [servings, setServings] = useState<string>(() => String(entry.quantity));
  const [targetMeal, setTargetMeal] = useState(mealName);
  const [eatenTime, setEatenTime] = useState(entry.eatenTime ?? "");
  const [factsOpen, setFactsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [food, setFood] = useState<FoodDTO | null>(null);

  const entryFoodId = entry.foodId;
  useEffect(() => {
    if (!entryFoodId) return;
    let cancelled = false;
    apiFetch<{ food: FoodDTO }>(`/api/foods/${entryFoodId}`)
      .then((data) => {
        if (!cancelled) setFood(data.food);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [entryFoodId]);

  const quantity = Number(servings);
  const valid = Number.isFinite(quantity) && quantity > 0;
  const { label, ...snapshot } = entry.nutritionSnapshotJson;
  // Rescale the stored snapshot — same math the PATCH endpoint applies.
  const nutrition = scaleSnapshot(
    snapshot as NutritionSnapshot,
    valid ? quantity / entry.quantity : 0,
  );

  // The entry's own serving text ("1 large (136 g)") is the truth about what
  // was logged; the live food's native serving is only a fallback for old
  // entries that never captured one. The stored text is the TOTAL amount, so
  // divide by the quantity to show the per-unit size next to the servings
  // count ("4 slices" over 2 servings reads "2 slices"). Brand prefers the
  // live food (renames).
  const brand = food?.brandName ?? snapshot.brand ?? null;
  const servingText = snapshot.serving
    ? scaleServingText(snapshot.serving, 1 / entry.quantity)
    : food
      ? nativeServingLabel(food)
      : null;
  const sourceLine =
    [brand, servingText].filter(Boolean).join(", ") ||
    (entry.customStoreOrderId ? "Custom build" : "Generic");

  async function save() {
    if (!valid) {
      toast.error("Servings must be a positive number");
      return;
    }
    setBusy(true);
    try {
      const changes: Record<string, unknown> = {};
      if (quantity !== entry.quantity) changes.quantity = quantity;
      if (targetMeal !== mealName) changes.mealName = targetMeal;
      if (eatenTime !== (entry.eatenTime ?? "")) changes.eatenTime = eatenTime || null;
      let updated: DiaryEntryDTO | null | undefined;
      if (Object.keys(changes).length > 0) {
        const response = await apiFetch<{ entry: DiaryEntryDTO }>(
          `/api/diary/entries/${entry.id}`,
          { method: "PATCH", body: JSON.stringify(changes) },
        );
        // Moved entries leave this meal's list.
        updated = targetMeal !== mealName ? null : response.entry;
        toast.success(
          targetMeal !== mealName ? `Moved to ${targetMeal}` : "Entry updated",
        );
      }
      onOpenChange(false);
      onChanged(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await apiFetch(`/api/diary/entries/${entry.id}`, { method: "DELETE" });
      onOpenChange(false);
      onChanged(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[92dvh] gap-4 overflow-y-auto"
      >
        {/* MFP-style bar: back to dismiss (left), save (right) — one of each. */}
        <div className="-mx-2 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close without saving"
            onClick={() => onOpenChange(false)}
          >
            <ArrowLeft aria-hidden />
          </Button>
          <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Edit Entry
          </p>
          <Button
            size="icon-sm"
            aria-label="Save changes"
            disabled={busy || !valid}
            onClick={save}
          >
            <Check aria-hidden />
          </Button>
        </div>
        <DialogHeader className="space-y-0">
          <DialogTitle className="diary-entry-text flex items-center gap-1.5 text-lg leading-snug">
            <span className="min-w-0">{label}</span>
            {(food?.isVerified ?? entry.verified) ? <VerifiedBadge /> : null}
          </DialogTitle>
          <DialogDescription>{sourceLine}</DialogDescription>
          {food?.description ? (
            <p className="diary-entry-text rounded-xl bg-muted/60 px-3 py-2 text-left text-sm text-foreground/80">
              {food.description}
            </p>
          ) : null}
        </DialogHeader>

        {/* Fields */}
        <div className="divide-y rounded-xl border bg-card text-sm">
          {servingText ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-medium">Serving Size</span>
              <span className="rounded-lg border px-3 py-1.5 font-semibold text-primary">
                {servingText}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <label htmlFor="edit-servings-input" className="font-medium">
              Number of Servings
            </label>
            <Input
              id="edit-servings-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={servings}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => {
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
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <label htmlFor="edit-eaten-time" className="font-medium">
              Time
            </label>
            <input
              id="edit-eaten-time"
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
                  {targetMeal}
                  <ChevronDown className="size-3.5" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {MEALS.map((meal) => (
                  <DropdownMenuItem key={meal} onSelect={() => setTargetMeal(meal)}>
                    {meal}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
                ["Carbs", nutrition.carbsG, nutrition.carbsG * 4, "--macro-carbs"],
                ["Fat", nutrition.fatG, nutrition.fatG * 9, "--macro-fat"],
                ["Protein", nutrition.proteinG, nutrition.proteinG * 4, "--macro-protein"],
              ] as const
            ).map(([macroLabel, grams, cal, colorVar]) => (
              <div key={macroLabel}>
                <p
                  className="text-sm font-bold tabular-nums"
                  style={{ color: `var(${colorVar})` }}
                >
                  {macroPctOfCalories(
                    cal,
                    nutrition.carbsG,
                    nutrition.fatG,
                    nutrition.proteinG,
                  )}
                  %
                </p>
                <p className="text-base font-bold tabular-nums">{Math.round(grams)} g</p>
                <p className="text-xs text-muted-foreground">{macroLabel}</p>
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

        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy || !valid} onClick={save}>
            <Check data-icon="inline-start" aria-hidden />
            {busy ? "Saving..." : "Save"}
          </Button>
          <Button variant="destructive" disabled={busy} onClick={remove}>
            <Trash2 data-icon="inline-start" aria-hidden />
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
