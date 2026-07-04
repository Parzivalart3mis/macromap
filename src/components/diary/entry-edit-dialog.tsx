"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client/fetcher";
import type { DiaryEntryDTO } from "@/types/api";

/* Mounted only while an entry is being edited, so state initializes fresh
   from the entry each time without reset effects. */
export function EntryEditDialog({
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
