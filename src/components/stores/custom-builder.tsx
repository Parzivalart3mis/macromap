"use client";

import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client/fetcher";
import { defaultMealForNow } from "@/lib/store-theme";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { CustomStoreOrderDTO, StoreIngredientDTO } from "@/types/api";

interface Selection {
  quantity: number;
}

export function CustomBuilder({
  slug,
  ingredients,
  editOrder,
  onSaved,
  onCancelEdit,
}: {
  slug: string;
  ingredients: StoreIngredientDTO[];
  editOrder?: CustomStoreOrderDTO | null;
  onSaved: (order: CustomStoreOrderDTO) => void;
  onCancelEdit?: () => void;
}) {
  const [name, setName] = useState(editOrder?.name ?? "");
  const [selected, setSelected] = useState<Map<string, Selection>>(() => {
    const initial = new Map<string, Selection>();
    // Reload a saved build's exact selections, skipping any ingredient that no
    // longer exists (e.g. a menu that was re-seeded). New builds start empty.
    if (editOrder?.items) {
      const validIds = new Set(ingredients.map((ingredient) => ingredient.food.id));
      for (const item of editOrder.items) {
        if (validIds.has(item.ingredientFoodId)) {
          initial.set(item.ingredientFoodId, { quantity: item.quantity });
        }
      }
    }
    return initial;
  });
  // How many saved ingredients could not be restored (menu changed since saving).
  const droppedCount = useMemo(() => {
    if (!editOrder?.items) return 0;
    const validIds = new Set(ingredients.map((ingredient) => ingredient.food.id));
    return editOrder.items.filter((item) => !validIds.has(item.ingredientFoodId)).length;
  }, [editOrder, ingredients]);
  const [saving, setSaving] = useState(false);
  const [logAfterSave, setLogAfterSave] = useState(false);
  const isEdit = Boolean(editOrder);

  const groups = useMemo(() => {
    const map = new Map<string, StoreIngredientDTO[]>();
    for (const ingredient of ingredients) {
      const list = map.get(ingredient.ingredientGroup) ?? [];
      list.push(ingredient);
      map.set(ingredient.ingredientGroup, list);
    }
    return [...map.entries()];
  }, [ingredients]);

  const totals = useMemo(() => {
    let calories = 0;
    let proteinG = 0;
    let carbsG = 0;
    let fatG = 0;
    for (const ingredient of ingredients) {
      const selection = selected.get(ingredient.food.id);
      if (!selection) continue;
      calories += ingredient.food.calories * selection.quantity;
      proteinG += ingredient.food.proteinG * selection.quantity;
      carbsG += ingredient.food.carbsG * selection.quantity;
      fatG += ingredient.food.fatG * selection.quantity;
    }
    return { calories, proteinG, carbsG, fatG };
  }, [ingredients, selected]);

  function toggle(foodId: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(foodId)) next.delete(foodId);
      else next.set(foodId, { quantity: 1 });
      return next;
    });
  }

  function adjust(foodId: string, delta: number) {
    setSelected((prev) => {
      const current = prev.get(foodId);
      if (!current) return prev;
      const next = new Map(prev);
      const quantity = Math.round((current.quantity + delta) * 2) / 2;
      if (quantity <= 0) next.delete(foodId);
      else next.set(foodId, { quantity });
      return next;
    });
  }

  async function save(logNow: boolean) {
    if (!name.trim()) {
      toast.error("Name your build first");
      return;
    }
    if (selected.size === 0) {
      toast.error("Pick at least one ingredient");
      return;
    }
    setSaving(true);
    setLogAfterSave(logNow);
    try {
      const body = JSON.stringify({
        name: name.trim(),
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
        const mealName = defaultMealForNow();
        // Always logs for today, so stamp the current wall-clock time.
        const now = new Date();
        const eatenTime = `${String(now.getHours()).padStart(2, "0")}:${String(
          now.getMinutes(),
        ).padStart(2, "0")}`;
        await apiFetch("/api/diary/entries", {
          method: "POST",
          body: JSON.stringify({
            date: todayISO(),
            mealName,
            customStoreOrderId: order.id,
            quantity: 1,
            servingMultiplier: 1,
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
        <div className="space-y-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-primary">Editing “{editOrder!.name}”</span>
            {onCancelEdit ? (
              <Button variant="ghost" size="xs" onClick={onCancelEdit}>
                Cancel
              </Button>
            ) : null}
          </div>
          {droppedCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {droppedCount} saved {droppedCount === 1 ? "ingredient is" : "ingredients are"} no
              longer on the menu and {droppedCount === 1 ? "was" : "were"} left out.
            </p>
          ) : null}
        </div>
      ) : null}
      <Input
        placeholder='Name this build, e.g. "My usual footlong"'
        value={name}
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
      />

      {groups.map(([group, items]) => (
        <section key={group}>
          <h3 className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {group}
          </h3>
          <ul className="divide-y rounded-xl border bg-card">
            {items.map((ingredient) => {
              const selection = selected.get(ingredient.food.id);
              return (
                <li
                  key={ingredient.id}
                  className={cn(
                    "flex min-h-11 items-center gap-3 px-3 py-2",
                    selection && "bg-[var(--store-tint,var(--muted))]/40",
                  )}
                >
                  <input
                    id={`ing-${ingredient.id}`}
                    type="checkbox"
                    className="size-5 accent-[var(--primary)]"
                    checked={Boolean(selection)}
                    onChange={() => toggle(ingredient.food.id)}
                  />
                  <label htmlFor={`ing-${ingredient.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{ingredient.food.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(ingredient.food.calories)} kcal ·{" "}
                      {Math.round(ingredient.food.proteinG)}p
                    </span>
                  </label>
                  {selection ? (
                    <span className="stepper-controls flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-xs"
                        aria-label={`Less ${ingredient.food.name}`}
                        onClick={() => adjust(ingredient.food.id, -0.5)}
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
                        onClick={() => adjust(ingredient.food.id, 0.5)}
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
      ))}

      <div
        className="fixed inset-x-0 z-30 mx-auto max-w-2xl px-4"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="nutrition-panel rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold tabular-nums">
              {Math.round(totals.calories)} kcal
            </span>
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
              {saving && !logAfterSave
                ? "Saving..."
                : isEdit
                  ? "Update build"
                  : "Save build"}
            </Button>
            <Button className="flex-1" disabled={saving} onClick={() => save(true)}>
              {saving && logAfterSave
                ? "Saving..."
                : isEdit
                  ? "Update and log"
                  : "Save and log"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
