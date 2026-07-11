"use client";

import { ArrowLeft, ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { ListSkeleton } from "@/components/async-states";
import { MealFoodPicker } from "@/components/diary/meal-food-picker";
import { SwipeableRow } from "@/components/diary/swipeable-row";
import { VerifiedBadge } from "@/components/foods/verified-badge";
import { MacroRing, macroPctOfCalories } from "@/components/nutrition/macro-ring";
import { NutritionPanel } from "@/components/nutrition/nutrition-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client/fetcher";
import { roundNutrition, scaleNutrition, sumNutrition } from "@/lib/nutrition";
import {
  baseServingAmount,
  computeServing,
  dtoNutrition,
  formatNum,
  servingOptions,
  type UnitOption,
} from "@/lib/units";
import type { FoodDTO, SavedMealDTO } from "@/types/api";

/**
 * One meal line: N servings of a chosen serving option ("1.25 × large"), not a
 * folded native multiple — so the picked unit survives display, edit, and save.
 */
interface BuilderItem {
  food: FoodDTO;
  option: UnitOption;
  servings: number;
}

/** Stable identity for a line: same food in the same serving unit. */
function itemKey(item: Pick<BuilderItem, "food" | "option">): string {
  return `${item.food.id}:${Math.round(item.option.baseAmount * 1000) / 1000}`;
}

/** Multiple of the food's native serving this line represents. */
function itemFactor(item: BuilderItem): number {
  const base = baseServingAmount(item.food);
  return item.servings * (base > 0 ? item.option.baseAmount / base : 1);
}

// The library tab to return to after saving (defaults to Meals).
const LIBRARY_TABS = ["meals", "recipes", "foods"] as const;

function CreateMealView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const returnTab = LIBRARY_TABS.includes(fromParam as (typeof LIBRARY_TABS)[number])
    ? (fromParam as string)
    : "meals";
  const editId = searchParams.get("edit");
  const [name, setName] = useState("");
  const [directions, setDirections] = useState("");
  const [items, setItems] = useState<BuilderItem[]>([]);
  const [factsOpen, setFactsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // While an existing meal's items are being loaded for editing.
  const [loading, setLoading] = useState(Boolean(editId));
  // Saved items that could not be loaded for editing (deleted foods etc.).
  const [droppedItems, setDroppedItems] = useState(0);

  // Add-items full-screen picker
  const [pickerOpen, setPickerOpen] = useState(false);

  // Edit mode: load the saved meal + its foods and pre-fill the builder.
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      try {
        const { savedMeal } = await apiFetch<{
          savedMeal: Pick<SavedMealDTO, "name" | "directions"> & {
            entriesSnapshotJson: {
              foodId?: string;
              quantity: number;
              servingMultiplier?: number;
            }[];
          };
        }>(`/api/saved-meals/${editId}`);
        const lines = savedMeal.entriesSnapshotJson.filter((l) => l.foodId);
        const foods = await Promise.all(
          lines.map((l) =>
            apiFetch<{ food: FoodDTO }>(`/api/foods/${l.foodId}`)
              .then((r) => r.food)
              .catch(() => null),
          ),
        );
        if (cancelled) return;
        setName(savedMeal.name);
        setDirections(savedMeal.directions ?? "");
        const loaded = foods
          .map((food, i) => {
            if (!food) return null;
            // Recover the serving option from the stored multiplier; if it no
            // longer exists on the food (or the line predates units), fold the
            // amount back into native servings.
            const line = lines[i];
            const multiplier = line.servingMultiplier ?? 1;
            const base = baseServingAmount(food);
            const option = servingOptions(food).find(
              (o) => Math.abs(o.baseAmount - multiplier * base) <= base * 1e-6,
            );
            return option
              ? { food, option, servings: line.quantity }
              : {
                  food,
                  option: servingOptions(food)[0],
                  servings: line.quantity * multiplier,
                };
          })
          .filter((x): x is BuilderItem => x !== null);
        setItems(loaded);
        // Items whose food no longer exists (or that never had one, e.g. old
        // custom-build lines) can't be edited — warn before they get dropped.
        setDroppedItems(savedMeal.entriesSnapshotJson.length - loaded.length);
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not load meal");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId]);

  const totals = roundNutrition(
    sumNutrition(items.map((item) => scaleNutrition(dtoNutrition(item.food), itemFactor(item)))),
  );

  function addFood(food: FoodDTO, servings = 1, option?: UnitOption) {
    const picked = option ?? servingOptions(food)[0];
    const key = itemKey({ food, option: picked });
    setItems((prev) => {
      // Merge only into a line of the same food *and* unit; a different unit
      // gets its own line (2 large + 100 g must not collapse).
      const existing = prev.find((item) => itemKey(item) === key);
      if (existing) {
        return prev.map((item) =>
          itemKey(item) === key ? { ...item, servings: item.servings + servings } : item,
        );
      }
      return [...prev, { food, option: picked, servings }];
    });
    toast.success(`Added ${food.name}`);
  }

  function adjust(key: string, delta: number) {
    setItems((prev) =>
      prev.flatMap((item) => {
        if (itemKey(item) !== key) return [item];
        const servings = Math.round((item.servings + delta) * 4) / 4;
        return servings <= 0 ? [] : [{ ...item, servings }];
      }),
    );
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((item) => itemKey(item) !== key));
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Name your meal first");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one food");
      return;
    }
    setBusy(true);
    try {
      const body = JSON.stringify({
        name: name.trim(),
        directions: directions.trim() || undefined,
        items: items.map((item) => {
          const { servingMultiplier, servingText } = computeServing(
            item.food,
            item.option,
            item.servings,
          );
          return { foodId: item.food.id, quantity: item.servings, servingMultiplier, servingText };
        }),
      });
      if (editId) {
        await apiFetch(`/api/saved-meals/${editId}`, { method: "PATCH", body });
      } else {
        await apiFetch("/api/saved-meals/build", { method: "POST", body });
      }
      toast.success(editId ? "Meal updated" : "Meal saved");
      // Return to the originating library tab (fresh mount refetches the list).
      router.replace(`/more/foods?tab=${returnTab}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
      setBusy(false);
    }
  }

  const canSave = name.trim().length > 0 && items.length > 0;

  return (
    <main className="pb-40">
      <header className="top-header app-chrome glass sticky top-0 z-30 border-b border-border/60 px-4 pb-3">
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back"
            onClick={() => router.back()}
          >
            <ArrowLeft aria-hidden />
          </Button>
          <h1 className="text-lg font-bold">{editId ? "Edit a Meal" : "Create a Meal"}</h1>
          <Button
            variant="ghost"
            size="sm"
            className="font-bold text-primary"
            disabled={busy || !canSave}
            onClick={save}
          >
            {busy ? "..." : "Save"}
          </Button>
        </div>
      </header>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : (
      <>
      <div className="space-y-5 p-4">
        {droppedItems > 0 ? (
          <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            {droppedItems} saved {droppedItems === 1 ? "item is" : "items are"} no longer
            available and {droppedItems === 1 ? "was" : "were"} left out — saving will remove{" "}
            {droppedItems === 1 ? "it" : "them"} from this meal.
          </p>
        ) : null}
        <Input
          placeholder="Name Your Meal"
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          className="h-12 text-lg font-semibold"
        />

        {/* Running totals */}
        <div className="flex items-center gap-4">
          <MacroRing
            calories={totals.calories}
            carbsG={totals.carbsG}
            fatG={totals.fatG}
            proteinG={totals.proteinG}
            className="size-28"
          />
          <div className="flex flex-1 justify-around gap-2 text-center">
            {(
              [
                ["Carbs", totals.carbsG, totals.carbsG * 4, "--macro-carbs"],
                ["Fat", totals.fatG, totals.fatG * 9, "--macro-fat"],
                ["Protein", totals.proteinG, totals.proteinG * 4, "--macro-protein"],
              ] as const
            ).map(([label, grams, cal, colorVar]) => (
              <div key={label}>
                <p
                  className="text-sm font-bold tabular-nums"
                  style={{ color: `var(${colorVar})` }}
                >
                  {macroPctOfCalories(cal, totals.carbsG, totals.fatG, totals.proteinG)}%
                </p>
                <p className="text-base font-bold tabular-nums">{Math.round(grams)} g</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>

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
              <NutritionPanel nutrition={totals} showAll />
            </div>
          ) : null}
        </div>

        {/* Meal items */}
        <section>
          <h2 className="mb-2 text-lg font-extrabold tracking-tight">Meal Items</h2>
          {items.length === 0 ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="w-full rounded-2xl border border-dashed py-4 text-sm font-semibold text-primary"
            >
              Add items to this meal
            </button>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const key = itemKey(item);
                const { servingText, nutrition } = computeServing(
                  item.food,
                  item.option,
                  item.servings,
                );
                return (
                <SwipeableRow key={key} onDelete={() => removeItem(key)}>
                  <div className="flex items-center gap-2 rounded-2xl border bg-card p-3 shadow-[var(--shadow-soft)]">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[14px] font-semibold">
                          {item.food.name}
                        </span>
                        {item.food.isVerified ? <VerifiedBadge /> : null}
                      </span>
                      <span className="text-[12px] text-muted-foreground">
                        {Math.round(nutrition.calories)} cal · {servingText}
                      </span>
                    </span>
                    <span className="stepper-controls flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-xs"
                        aria-label={`Less ${item.food.name}`}
                        onClick={() => adjust(key, -0.25)}
                      >
                        <Minus aria-hidden />
                      </Button>
                      <span className="w-9 text-center text-sm tabular-nums">
                        {formatNum(item.servings)}
                      </span>
                      <Button
                        variant="outline"
                        size="icon-xs"
                        aria-label={`More ${item.food.name}`}
                        onClick={() => adjust(key, 0.25)}
                      >
                        <Plus aria-hidden />
                      </Button>
                    </span>
                  </div>
                </SwipeableRow>
                );
              })}
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="w-full py-2 text-sm font-semibold text-primary"
              >
                Add items to this meal
              </button>
            </div>
          )}
        </section>

        {/* Directions */}
        <section>
          <h2 className="mb-2 text-lg font-extrabold tracking-tight">Directions</h2>
          <Textarea
            placeholder="Add instructions for making this meal (optional)"
            value={directions}
            maxLength={2000}
            rows={3}
            onChange={(event) => setDirections(event.target.value)}
          />
        </section>
      </div>

      {/* Bottom add-food bar — floats above the fixed bottom nav */}
      <div
        className="fixed inset-x-0 z-30 mx-auto max-w-2xl px-4"
        style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      >
        <Button
          size="lg"
          className="w-full shadow-[var(--shadow-lift)]"
          onClick={() => setPickerOpen(true)}
        >
          <Plus data-icon="inline-start" aria-hidden />
          Add Food
        </Button>
      </div>

      {/* Full-screen food picker (search, history, recipes, foods, barcode, voice) */}
      {pickerOpen ? (
        <MealFoodPicker onAdd={addFood} onClose={() => setPickerOpen(false)} />
      ) : null}
      </>
      )}
    </main>
  );
}

export default function CreateMealPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <CreateMealView />
    </Suspense>
  );
}
