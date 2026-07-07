"use client";

import { Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ListSkeleton } from "@/components/async-states";
import { SubHeader } from "@/components/more/sub-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/client/fetcher";
import type { FoodDTO, SavedMealDTO } from "@/types/api";

/** Standard food line: "Brand, serving size". */
function foodLine(food: FoodDTO): string {
  const serving = `${food.servingSizeValue} ${food.servingSizeUnit}`;
  return food.brandName ? `${food.brandName}, ${serving}` : serving;
}

function LibraryRow({
  title,
  subtitle,
  description,
  calories,
  onClick,
}: {
  title: string;
  subtitle: string;
  description?: string | null;
  calories: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b px-1 py-3 text-left hover:bg-muted/40"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{title}</span>
        <span className="block truncate text-[13px] text-muted-foreground">
          {subtitle}
        </span>
        {description ? (
          <span className="block truncate text-[13px] text-muted-foreground/80 italic">
            {description}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-lg font-semibold tabular-nums">
        {Math.round(calories).toLocaleString()}
      </span>
    </button>
  );
}

/** Saved-meal detail: items + delete. */
function MealDialog({
  meal,
  onOpenChange,
  onDeleted,
}: {
  meal: SavedMealDTO;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Delete "${meal.name}"?`)) return;
    setBusy(true);
    try {
      await apiFetch(`/api/saved-meals/${meal.id}`, { method: "DELETE" });
      toast.success(`Deleted ${meal.name}`);
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{meal.name}</DialogTitle>
          <DialogDescription>
            {meal.entriesSnapshotJson.length} items · log it from the diary&apos;s
            saved-meals tab
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-xl border text-sm">
          {meal.entriesSnapshotJson.map((line, index) => (
            <li key={index} className="flex justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate">{line.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {Math.round(line.nutrition.calories)} cal
              </span>
            </li>
          ))}
        </ul>
        {meal.directions ? (
          <div className="rounded-xl bg-muted/60 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Directions
            </p>
            <p className="whitespace-pre-wrap">{meal.directions}</p>
          </div>
        ) : null}
        <Button variant="destructive" disabled={busy} onClick={remove}>
          <Trash2 data-icon="inline-start" aria-hidden />
          {busy ? "Deleting..." : "Delete meal"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

const TAB_VALUES = ["recipes", "meals", "foods"] as const;

function MyMealsRecipesFoodsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [foods, setFoods] = useState<FoodDTO[] | null>(null);
  const [savedMeals, setSavedMeals] = useState<SavedMealDTO[] | null>(null);
  const [query, setQuery] = useState("");
  // Initial tab honours ?tab= so returning from a create flow lands correctly.
  const [tab, setTab] = useState(() => {
    const t = searchParams.get("tab");
    return TAB_VALUES.includes(t as (typeof TAB_VALUES)[number]) ? (t as string) : "recipes";
  });
  const [openMeal, setOpenMeal] = useState<SavedMealDTO | null>(null);

  function loadAll() {
    apiFetch<{ foods: FoodDTO[] }>("/api/foods/mine")
      .then((data) => setFoods(data.foods))
      .catch(() => setFoods([]));
    apiFetch<{ savedMeals: SavedMealDTO[] }>("/api/saved-meals")
      .then((data) => setSavedMeals(data.savedMeals))
      .catch(() => setSavedMeals([]));
  }
  const loadMeals = loadAll;

  useEffect(() => {
    loadAll();
    // Refresh when returning to the tab (e.g. after leaving the app or builder).
    const refresh = () => {
      if (document.visibilityState === "visible") loadAll();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  // Keep the tab in the URL so back-navigation restores the current tab.
  function changeTab(value: string) {
    setTab(value);
    router.replace(`/more/foods?tab=${value}`, { scroll: false });
  }

  const q = query.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);

  // "Recipes" = foods explicitly flagged as recipes; "Foods" = everything I created.
  const recipes = (foods ?? []).filter((food) => food.isRecipe && matches(food.name));
  const myFoods = (foods ?? []).filter((food) => matches(food.name));
  const meals = (savedMeals ?? []).filter((meal) => matches(meal.name));

  const CTA: Record<string, { label: string; onClick: () => void }> = {
    recipes: { label: "Create a Recipe", onClick: () => router.push("/foods/new") },
    meals: {
      label: "Create a Meal",
      onClick: () => router.push("/more/foods/new-meal?from=meals"),
    },
    foods: { label: "Create a Food", onClick: () => router.push("/foods/new") },
  };

  return (
    <main>
      <SubHeader title="Meals, Recipes & Foods" />
      <div className="space-y-3 p-4 pb-36">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            placeholder="Search for a food"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 rounded-full pl-10"
            autoComplete="off"
          />
        </div>

        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList variant="line" className="w-full justify-around">
            <TabsTrigger value="recipes">Recipes</TabsTrigger>
            <TabsTrigger value="meals">Meals</TabsTrigger>
            <TabsTrigger value="foods">Foods</TabsTrigger>
          </TabsList>

          <TabsContent value="recipes" className="pt-2">
            {foods === null ? (
              <ListSkeleton rows={4} />
            ) : recipes.length === 0 ? (
              <EmptyState
                title={q ? "No recipes match" : "No recipes yet"}
                body="Home dishes you create with a per-serving size show up here."
              />
            ) : (
              <div className="animate-fade-up">
                {recipes.map((food) => (
                  <LibraryRow
                    key={food.id}
                    title={food.name}
                    subtitle={foodLine(food)}
                    description={food.description}
                    calories={food.calories}
                    onClick={() => router.push(`/foods/${food.id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="meals" className="pt-2">
            {savedMeals === null ? (
              <ListSkeleton rows={3} />
            ) : meals.length === 0 ? (
              <EmptyState
                title={q ? "No meals match" : "No saved meals yet"}
                body="Save a logged meal as a template from its menu in the diary."
              />
            ) : (
              <div className="animate-fade-up">
                {meals.map((meal) => {
                  const totalCalories = meal.entriesSnapshotJson.reduce(
                    (sum, line) => sum + line.nutrition.calories,
                    0,
                  );
                  const count = meal.entriesSnapshotJson.length;
                  return (
                    <LibraryRow
                      key={meal.id}
                      title={meal.name}
                      subtitle={`${count} ${count === 1 ? "item" : "items"}`}
                      calories={totalCalories}
                      onClick={() => setOpenMeal(meal)}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="foods" className="pt-2">
            {foods === null ? (
              <ListSkeleton rows={4} />
            ) : myFoods.length === 0 ? (
              <EmptyState
                title={q ? "No foods match" : "No foods yet"}
                body="Foods you add to the shared database appear here."
                action={
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/foods/new">Create food</Link>
                  </Button>
                }
              />
            ) : (
              <div className="animate-fade-up">
                {myFoods.map((food) => (
                  <LibraryRow
                    key={food.id}
                    title={food.name}
                    subtitle={foodLine(food)}
                    description={food.description}
                    calories={food.calories}
                    onClick={() => router.push(`/foods/${food.id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Per-tab create action, floating above the bottom nav */}
      <div
        className="fixed inset-x-0 z-30 mx-auto max-w-2xl px-4"
        style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      >
        <Button size="lg" className="w-full shadow-[var(--shadow-lift)]" onClick={CTA[tab].onClick}>
          {CTA[tab].label}
        </Button>
      </div>

      {openMeal ? (
        <MealDialog
          meal={openMeal}
          onOpenChange={(open) => {
            if (!open) setOpenMeal(null);
          }}
          onDeleted={loadMeals}
        />
      ) : null}
    </main>
  );
}

export default function MyMealsRecipesFoodsPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <MyMealsRecipesFoodsView />
    </Suspense>
  );
}
