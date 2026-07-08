"use client";

import { ArrowLeft, ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { ListSkeleton } from "@/components/async-states";
import { MealFoodPicker } from "@/components/diary/meal-food-picker";
import { VerifiedBadge } from "@/components/foods/verified-badge";
import { MacroRing, macroPctOfCalories } from "@/components/nutrition/macro-ring";
import { NutritionPanel } from "@/components/nutrition/nutrition-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client/fetcher";
import { roundNutrition, scaleNutrition, sumNutrition } from "@/lib/nutrition";
import { dtoNutrition } from "@/lib/units";
import type { FoodDTO, SavedMealDTO } from "@/types/api";

interface BuilderItem {
  food: FoodDTO;
  quantity: number;
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
            entriesSnapshotJson: { foodId?: string; quantity: number }[];
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
        setItems(
          foods
            .map((food, i) => (food ? { food, quantity: lines[i].quantity } : null))
            .filter((x): x is BuilderItem => x !== null),
        );
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
    sumNutrition(items.map((item) => scaleNutrition(dtoNutrition(item.food), item.quantity))),
  );

  function addFood(food: FoodDTO, quantity = 1) {
    setItems((prev) => {
      const existing = prev.find((item) => item.food.id === food.id);
      if (existing) {
        return prev.map((item) =>
          item.food.id === food.id ? { ...item, quantity: item.quantity + quantity } : item,
        );
      }
      return [...prev, { food, quantity }];
    });
    toast.success(`Added ${food.name}`);
  }

  function adjust(foodId: string, delta: number) {
    setItems((prev) =>
      prev.flatMap((item) => {
        if (item.food.id !== foodId) return [item];
        const quantity = Math.round((item.quantity + delta) * 4) / 4;
        return quantity <= 0 ? [] : [{ ...item, quantity }];
      }),
    );
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
        items: items.map((item) => ({ foodId: item.food.id, quantity: item.quantity })),
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
              {items.map((item) => (
                <div
                  key={item.food.id}
                  className="flex items-center gap-2 rounded-2xl border bg-card p-3 shadow-[var(--shadow-soft)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[15px] font-semibold">
                        {item.food.name}
                      </span>
                      {item.food.isVerified ? <VerifiedBadge /> : null}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {Math.round(item.food.calories * item.quantity)} cal ·{" "}
                      {item.food.servingSizeValue * item.quantity} {item.food.servingSizeUnit}
                    </span>
                  </span>
                  <span className="stepper-controls flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-xs"
                      aria-label={`Less ${item.food.name}`}
                      onClick={() => adjust(item.food.id, -0.25)}
                    >
                      <Minus aria-hidden />
                    </Button>
                    <span className="w-9 text-center text-sm tabular-nums">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      aria-label={`More ${item.food.name}`}
                      onClick={() => adjust(item.food.id, 0.25)}
                    >
                      <Plus aria-hidden />
                    </Button>
                  </span>
                </div>
              ))}
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
