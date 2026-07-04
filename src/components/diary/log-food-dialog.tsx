"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

import { NutritionPanel } from "@/components/nutrition/nutrition-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { FoodDTO } from "@/types/api";
import type { NutritionSnapshot } from "@/types/nutrition";
import { NUTRITION_KEYS } from "@/types/nutrition";

function scaleFood(food: FoodDTO, factor: number): NutritionSnapshot {
  const snapshot: NutritionSnapshot = {
    calories: food.calories * factor,
    proteinG: food.proteinG * factor,
    carbsG: food.carbsG * factor,
    fatG: food.fatG * factor,
  };
  for (const key of NUTRITION_KEYS) {
    if (key in snapshot) continue;
    const value = food[key as keyof FoodDTO];
    if (typeof value === "number") snapshot[key] = value * factor;
  }
  return snapshot;
}

/* Quantity state lives in the body, which Radix unmounts on close — so every
   open starts fresh without reset effects. */
function LogFoodBody({
  food,
  onConfirm,
  confirmLabel,
  busy,
}: {
  food: FoodDTO;
  onConfirm: (quantity: number) => void;
  confirmLabel: string;
  busy: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const nutrition = scaleFood(food, quantity);

  return (
    <>
      <div className="stepper-controls flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="icon"
          aria-label="Decrease servings"
          onClick={() =>
            setQuantity((q) => Math.max(0.25, Math.round((q - 0.25) * 100) / 100))
          }
        >
          <Minus aria-hidden />
        </Button>
        <div className="w-24">
          <Input
            type="number"
            inputMode="decimal"
            min={0.25}
            step={0.25}
            value={quantity}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next) && next > 0) setQuantity(next);
            }}
            aria-label="Servings"
            className="text-center"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Increase servings"
          onClick={() => setQuantity((q) => Math.round((q + 0.25) * 100) / 100)}
        >
          <Plus aria-hidden />
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">servings</p>

      <NutritionPanel nutrition={nutrition} />

      <Button size="lg" disabled={busy} onClick={() => onConfirm(quantity)}>
        {busy ? "Logging..." : confirmLabel}
      </Button>
    </>
  );
}

export function LogFoodDialog({
  food,
  open,
  onOpenChange,
  onConfirm,
  confirmLabel = "Log food",
  busy = false,
}: {
  food: FoodDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (quantity: number) => void;
  confirmLabel?: string;
  busy?: boolean;
}) {
  if (!food) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="diary-entry-text">{food.name}</DialogTitle>
          <DialogDescription>
            {food.brandName ? `${food.brandName} · ` : ""}
            {food.servingSizeValue} {food.servingSizeUnit} per serving
          </DialogDescription>
        </DialogHeader>
        <LogFoodBody
          key={food.id}
          food={food}
          onConfirm={onConfirm}
          confirmLabel={confirmLabel}
          busy={busy}
        />
      </DialogContent>
    </Dialog>
  );
}
