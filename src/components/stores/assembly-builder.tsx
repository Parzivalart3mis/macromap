"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client/fetcher";
import { defaultMealForNow } from "@/lib/store-theme";
import { todayISO } from "@/lib/dates";
import { isCountUnit } from "@/lib/units";
import { cn } from "@/lib/utils";
import type { CustomStoreOrderDTO, StoreIngredientDTO } from "@/types/api";

/** A guided assembly builder config for a size-free bowl/burrito store. */
export interface AssemblyConfig {
  /** Group render order (top → bottom of the line). */
  order: string[];
  /** Groups where exactly one option can be chosen (radio); others are multi. */
  single: string[];
  /** Short helper under each group heading. */
  hint: Record<string, string>;
  /** Ingredient name pre-selected on a new build (e.g. the default format). */
  defaultSelect?: string;
  /** Map an ingredient name to a short word for the auto-suggested build name. */
  formatShortNames?: Record<string, string>;
  /** How to auto-name a build: "<primary> <suffix>", e.g. "Chicken Bowl". */
  nameFrom: {
    primaryGroup: string;
    primaryFallback: string;
    /** If set, the selected item in this group supplies the suffix. */
    suffixGroup?: string;
    /** Fixed suffix when suffixGroup is unset. */
    suffix?: string;
  };
}

// Registry of stores that use the guided assembly builder (vs the flat one).
const CONFIGS: Record<string, AssemblyConfig> = {
  chipotle: {
    order: ["Format", "Rice", "Beans", "Protein", "Salsa", "Toppings"],
    single: ["Format", "Rice", "Beans", "Protein"],
    hint: {
      Format: "Pick a format",
      Rice: "Pick one · optional",
      Beans: "Pick one · optional",
      Protein: "Pick one · tap + for double · optional",
      Salsa: "Add any",
      Toppings: "Add any · tap + for extra",
    },
    defaultSelect: "Burrito Bowl (no tortilla)",
    formatShortNames: {
      "Burrito Bowl (no tortilla)": "Bowl",
      "Burrito (flour tortilla)": "Burrito",
      "3 Crispy Corn Tacos": "Tacos",
      "3 Soft Flour Tacos": "Tacos",
      "Salad (supergreens)": "Salad",
    },
    nameFrom: { primaryGroup: "Protein", primaryFallback: "Veggie", suffixGroup: "Format" },
  },
  subway: {
    order: ["Bread", "Protein", "Cheese", "Vegetables", "Sauces", "Seasonings"],
    single: ["Bread"],
    hint: {
      Bread: "Pick one",
      Protein: "Add any · tap + for double",
      Cheese: "Add any",
      Vegetables: "Add any",
      Sauces: "Add any",
      Seasonings: "Add any",
    },
    nameFrom: { primaryGroup: "Protein", primaryFallback: "Veggie", suffix: "Sub" },
  },
};

export function assemblyConfigFor(slug: string): AssemblyConfig | null {
  return CONFIGS[slug] ?? null;
}

interface Selection {
  quantity: number;
}

export function AssemblyBuilder({
  slug,
  config,
  mealName = defaultMealForNow(),
  date = todayISO(),
  ingredients,
  editOrder,
  onSaved,
  onCancelEdit,
}: {
  slug: string;
  config: AssemblyConfig;
  mealName?: string;
  date?: string;
  ingredients: StoreIngredientDTO[];
  editOrder?: CustomStoreOrderDTO | null;
  onSaved: (order: CustomStoreOrderDTO) => void;
  onCancelEdit?: () => void;
}) {
  const isEdit = Boolean(editOrder);

  // Ingredients grouped, then ordered per the config (unknown groups appended).
  const groups = useMemo(() => {
    const map = new Map<string, StoreIngredientDTO[]>();
    for (const ingredient of ingredients) {
      const list = map.get(ingredient.ingredientGroup) ?? [];
      list.push(ingredient);
      map.set(ingredient.ingredientGroup, list);
    }
    const ordered = config.order.filter((g) => map.has(g));
    for (const g of map.keys()) if (!ordered.includes(g)) ordered.push(g);
    return ordered.map((g) => [g, map.get(g)!] as const);
  }, [ingredients, config.order]);

  const groupOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const ing of ingredients) m.set(ing.food.id, ing.ingredientGroup);
    return m;
  }, [ingredients]);

  const [name, setName] = useState(editOrder?.name ?? "");
  const [selected, setSelected] = useState<Map<string, Selection>>(() => {
    const initial = new Map<string, Selection>();
    if (editOrder?.items) {
      const validIds = new Set(ingredients.map((i) => i.food.id));
      for (const item of editOrder.items) {
        if (validIds.has(item.ingredientFoodId)) {
          initial.set(item.ingredientFoodId, { quantity: item.quantity });
        }
      }
    } else if (config.defaultSelect) {
      const def = ingredients.find((i) => i.food.name === config.defaultSelect);
      if (def) initial.set(def.food.id, { quantity: 1 });
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [logAfterSave, setLogAfterSave] = useState(false);

  const totals = useMemo(() => {
    let calories = 0;
    let proteinG = 0;
    let carbsG = 0;
    let fatG = 0;
    for (const ingredient of ingredients) {
      const sel = selected.get(ingredient.food.id);
      if (!sel) continue;
      calories += ingredient.food.calories * sel.quantity;
      proteinG += ingredient.food.proteinG * sel.quantity;
      carbsG += ingredient.food.carbsG * sel.quantity;
      fatG += ingredient.food.fatG * sel.quantity;
    }
    return { calories, proteinG, carbsG, fatG };
  }, [ingredients, selected]);

  // Auto name: "<primary> <suffix>", e.g. "Chicken Bowl" or "Turkey Sub".
  const suggestedName = useMemo(() => {
    const firstIn = (group: string) =>
      ingredients.find((i) => groupOf.get(i.food.id) === group && selected.has(i.food.id));
    const { primaryGroup, primaryFallback, suffixGroup, suffix } = config.nameFrom;
    const primary = firstIn(primaryGroup)?.food.name ?? primaryFallback;
    let tail = suffix ?? "";
    if (suffixGroup) {
      const f = firstIn(suffixGroup);
      tail = f ? (config.formatShortNames?.[f.food.name] ?? f.food.name) : "";
    }
    return `${primary} ${tail}`.trim();
  }, [ingredients, groupOf, selected, config.nameFrom, config.formatShortNames]);

  function pick(group: string, foodId: string) {
    const isSingle = config.single.includes(group);
    setSelected((prev) => {
      const next = new Map(prev);
      if (isSingle) {
        const was = next.has(foodId);
        for (const ing of ingredients) {
          if (groupOf.get(ing.food.id) === group) next.delete(ing.food.id);
        }
        if (!was) next.set(foodId, { quantity: 1 });
      } else if (next.has(foodId)) {
        next.delete(foodId);
      } else {
        next.set(foodId, { quantity: 1 });
      }
      return next;
    });
  }

  function adjust(foodId: string, delta: number) {
    setSelected((prev) => {
      const current = prev.get(foodId);
      if (!current) return prev;
      const next = new Map(prev);
      const step = Math.abs(delta) || 0.5;
      const quantity = Math.round((current.quantity + delta) / step) * step;
      if (quantity <= 0) next.delete(foodId);
      else next.set(foodId, { quantity });
      return next;
    });
  }

  async function save(logNow: boolean) {
    if (selected.size === 0) {
      toast.error("Build something first");
      return;
    }
    setSaving(true);
    setLogAfterSave(logNow);
    try {
      const body = JSON.stringify({
        name: name.trim() || suggestedName,
        items: [...selected.entries()].map(([ingredientFoodId, sel]) => ({
          ingredientFoodId,
          quantity: sel.quantity,
        })),
      });
      const { order } = await apiFetch<{ order: CustomStoreOrderDTO }>(
        isEdit
          ? `/api/stores/${slug}/custom-orders/${editOrder!.id}`
          : `/api/stores/${slug}/custom-orders`,
        { method: isEdit ? "PATCH" : "POST", body },
      );
      if (logNow) {
        const eatenTime =
          date === todayISO()
            ? `${String(new Date().getHours()).padStart(2, "0")}:${String(
                new Date().getMinutes(),
              ).padStart(2, "0")}`
            : undefined;
        await apiFetch("/api/diary/entries", {
          method: "POST",
          body: JSON.stringify({
            date,
            mealName,
            customStoreOrderId: order.id,
            quantity: 1,
            servingMultiplier: 1,
            servingText: "1 order",
            eatenTime,
            loggedVia: "store_builder",
          }),
        });
        toast.success(`${isEdit ? "Updated" : "Saved"} and logged to ${mealName}`);
      } else {
        toast.success(isEdit ? "Build updated" : "Build saved");
      }
      if (!isEdit) setName("");
      onSaved(order);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-28">
      {isEdit ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium text-primary">Editing “{editOrder!.name}”</span>
          {onCancelEdit ? (
            <Button variant="ghost" size="xs" onClick={onCancelEdit}>
              Cancel
            </Button>
          ) : null}
        </div>
      ) : null}

      <Input
        placeholder={suggestedName}
        value={name}
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
      />

      {groups.map(([group, items]) => {
        const isSingle = config.single.includes(group);
        return (
          <section key={group}>
            <h3 className="mb-1.5 flex items-baseline gap-2 px-1">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group}
              </span>
              {config.hint[group] ? (
                <span className="text-[10px] text-muted-foreground/80">{config.hint[group]}</span>
              ) : null}
            </h3>
            <ul className="divide-y rounded-xl border bg-card">
              {items.map((ingredient) => {
                const selection = selected.get(ingredient.food.id);
                const step = isCountUnit(ingredient.food.servingSizeUnit) ? 1 : 0.5;
                return (
                  <li
                    key={ingredient.id}
                    className={cn(
                      "flex min-h-11 items-center gap-3 px-3 py-2",
                      selection && "bg-[var(--store-tint,var(--muted))]/40",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => pick(group, ingredient.food.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      aria-pressed={Boolean(selection)}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center border",
                          isSingle ? "rounded-full" : "rounded",
                          selection
                            ? "border-transparent bg-[var(--primary)] text-[var(--primary-foreground)]"
                            : "border-input",
                        )}
                      >
                        {selection ? <Check className="size-3.5" aria-hidden /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{ingredient.food.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(ingredient.food.calories)} kcal ·{" "}
                          {Math.round(ingredient.food.proteinG)}p
                        </span>
                      </span>
                    </button>
                    {selection ? (
                      <span className="stepper-controls flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon-xs"
                          aria-label={`Less ${ingredient.food.name}`}
                          onClick={() => adjust(ingredient.food.id, -step)}
                        >
                          <Minus aria-hidden />
                        </Button>
                        <span className="w-8 text-center text-sm tabular-nums">
                          {selection.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon-xs"
                          aria-label={`More ${ingredient.food.name}`}
                          onClick={() => adjust(ingredient.food.id, step)}
                        >
                          <Plus aria-hidden />
                        </Button>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <div
        className="fixed inset-x-0 z-30 mx-auto max-w-2xl px-4"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="nutrition-panel rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold tabular-nums">{Math.round(totals.calories)} kcal</span>
            <span className="text-xs text-muted-foreground">
              {Math.round(totals.proteinG)}p · {Math.round(totals.carbsG)}c ·{" "}
              {Math.round(totals.fatG)}f
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={saving}
              onClick={() => save(false)}
              variant="secondary"
            >
              {saving && !logAfterSave ? "Saving..." : isEdit ? "Update build" : "Save build"}
            </Button>
            <Button className="flex-1" disabled={saving} onClick={() => save(true)}>
              {saving && logAfterSave ? "Saving..." : isEdit ? "Update and log" : "Save and log"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
