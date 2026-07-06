"use client";

import { ArrowLeft, ChevronDown, ChevronUp, Minus, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ListSkeleton } from "@/components/async-states";
import { VerifiedBadge } from "@/components/foods/verified-badge";
import { MacroRing, macroPctOfCalories } from "@/components/nutrition/macro-ring";
import { NutritionPanel } from "@/components/nutrition/nutrition-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client/fetcher";
import { roundNutrition, scaleNutrition, sumNutrition } from "@/lib/nutrition";
import { dtoNutrition } from "@/lib/units";
import type { FoodDTO } from "@/types/api";

interface BuilderItem {
  food: FoodDTO;
  quantity: number;
}

export default function CreateMealPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [directions, setDirections] = useState("");
  const [items, setItems] = useState<BuilderItem[]>([]);
  const [factsOpen, setFactsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Add-items search sheet
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodDTO[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totals = roundNutrition(
    sumNutrition(items.map((item) => scaleNutrition(dtoNutrition(item.food), item.quantity))),
  );

  function runSearch(value: string) {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiFetch<{ foods: FoodDTO[] }>(
          `/api/foods/search?q=${encodeURIComponent(value.trim())}`,
        );
        setResults(data.foods);
      } catch {
        toast.error("Search failed");
      } finally {
        setSearching(false);
      }
    }, 250);
  }

  function addFood(food: FoodDTO) {
    setItems((prev) => {
      const existing = prev.find((item) => item.food.id === food.id);
      if (existing) {
        return prev.map((item) =>
          item.food.id === food.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { food, quantity: 1 }];
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
      await apiFetch("/api/saved-meals/build", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          directions: directions.trim() || undefined,
          items: items.map((item) => ({ foodId: item.food.id, quantity: item.quantity })),
        }),
      });
      toast.success("Meal saved");
      router.back();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
      setBusy(false);
    }
  }

  const canSave = name.trim().length > 0 && items.length > 0;

  return (
    <main className="pb-28">
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
          <h1 className="text-lg font-bold">Create a Meal</h1>
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

      {/* Bottom add-food bar */}
      <div
        className="fixed inset-x-0 z-30 mx-auto max-w-2xl px-4"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
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

      {/* Food picker */}
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent
          side="bottom"
          className="sheet-safe-bottom max-h-[85dvh] overflow-y-auto rounded-t-2xl"
        >
          <SheetHeader>
            <SheetTitle>Add Food</SheetTitle>
            <SheetDescription>Tap a food to add it to the meal</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-6">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                placeholder="Search foods, brands, flavors..."
                value={query}
                onChange={(event) => runSearch(event.target.value)}
                autoComplete="off"
                className="h-11 rounded-full pl-10"
              />
            </div>
            {searching ? (
              <ListSkeleton rows={4} />
            ) : results.length > 0 ? (
              <div className="stagger-children space-y-2">
                {results.map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    onClick={() => addFood(food)}
                    className="flex w-full items-center gap-2 rounded-2xl border bg-card p-3 text-left hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[15px] font-semibold">{food.name}</span>
                        {food.isVerified ? <VerifiedBadge /> : null}
                      </span>
                      <span className="text-[13px] text-muted-foreground">
                        {food.brandName ? `${food.brandName}, ` : ""}
                        {food.servingSizeValue} {food.servingSizeUnit} ·{" "}
                        {Math.round(food.calories)} cal
                      </span>
                    </span>
                    <Plus className="size-5 shrink-0 text-primary" aria-hidden />
                  </button>
                ))}
              </div>
            ) : query.trim().length >= 2 ? (
              <EmptyState title="No matches" />
            ) : (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                Search for foods to add to this meal
              </p>
            )}
            <Button variant="outline" className="w-full" onClick={() => setPickerOpen(false)}>
              <X data-icon="inline-start" aria-hidden />
              Done
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
