"use client";

import { BookmarkPlus, MoreVertical, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import type { DiaryEntryDTO, DiaryMealDTO } from "@/types/api";

/* Mounted only while an entry is being edited, so state initializes fresh
   from the entry each time without reset effects. */
function EntryEditDialog({
  entry,
  onOpenChange,
  onChanged,
}: {
  entry: DiaryEntryDTO;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [quantity, setQuantity] = useState<string>(() => String(entry.quantity));
  const [busy, setBusy] = useState(false);

  async function save() {
    const next = Number(quantity);
    if (!Number.isFinite(next) || next <= 0) {
      toast.error("Servings must be a positive number");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/diary/entries/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: next }),
      });
      onOpenChange(false);
      onChanged();
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
      onChanged();
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
          <DialogTitle className="diary-entry-text">
            {entry.nutritionSnapshotJson.label}
          </DialogTitle>
          <DialogDescription>
            {Math.round(entry.nutritionSnapshotJson.calories)} kcal logged
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label htmlFor="entry-quantity" className="text-sm font-medium">
            Servings
          </label>
          <Input
            id="entry-quantity"
            type="number"
            inputMode="decimal"
            min={0.25}
            step={0.25}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={save}>
            Save
          </Button>
          <Button variant="destructive" disabled={busy} onClick={remove}>
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MealCard({
  meal,
  date,
  onAddFood,
  onChanged,
}: {
  meal: DiaryMealDTO;
  date: string;
  onAddFood: (mealName: string) => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<DiaryEntryDTO | null>(null);

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
    <Card className="overflow-hidden py-0 gap-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <h2 className="font-semibold">{meal.mealName}</h2>
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round(meal.totals.calories)} kcal
          </span>
        </div>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Add food to ${meal.mealName}`}
            onClick={() => onAddFood(meal.mealName)}
          >
            <Plus aria-hidden />
          </Button>
          {meal.entries.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Meal options">
                  <MoreVertical aria-hidden />
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
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {meal.entries.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Nothing logged</p>
        ) : (
          <ul className="divide-y">
            {meal.entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="diary-row flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/50"
                  onClick={() => setEditing(entry)}
                >
                  <span className="diary-entry-text min-w-0">
                    <span className="block truncate text-sm">
                      {entry.nutritionSnapshotJson.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {entry.quantity !== 1 ? `${entry.quantity} servings · ` : ""}
                      {Math.round(entry.nutritionSnapshotJson.proteinG)}p ·{" "}
                      {Math.round(entry.nutritionSnapshotJson.carbsG)}c ·{" "}
                      {Math.round(entry.nutritionSnapshotJson.fatG)}f
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {Math.round(entry.nutritionSnapshotJson.calories)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {editing ? (
        <EntryEditDialog
          entry={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onChanged={onChanged}
        />
      ) : null}
    </Card>
  );
}
