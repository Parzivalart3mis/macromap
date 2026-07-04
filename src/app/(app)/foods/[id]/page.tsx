"use client";

import { History, Pencil } from "lucide-react";
import { use, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, ListSkeleton } from "@/components/async-states";
import { VerifiedBadge } from "@/components/foods/verified-badge";
import { NutritionPanel } from "@/components/nutrition/nutrition-panel";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/client/fetcher";
import type { FoodDTO } from "@/types/api";

interface HistoryRow {
  id: string;
  fieldChanged: string;
  oldValue: string | null;
  newValue: string | null;
  editedAt: string;
  editedBy: string | null;
}

const EDIT_FIELDS = [
  { key: "calories", label: "Calories" },
  { key: "proteinG", label: "Protein (g)" },
  { key: "carbsG", label: "Total carbs (g)" },
  { key: "fatG", label: "Total fat (g)" },
  { key: "satFatG", label: "Saturated fat (g)" },
  { key: "polyUnsatFatG", label: "Polyunsat. fat (g)" },
  { key: "monoUnsatFatG", label: "Monounsat. fat (g)" },
  { key: "transFatG", label: "Trans fat (g)" },
  { key: "cholesterolMg", label: "Cholesterol (mg)" },
  { key: "sodiumMg", label: "Sodium (mg)" },
  { key: "potassiumMg", label: "Potassium (mg)" },
  { key: "fiberG", label: "Dietary fiber (g)" },
  { key: "sugarG", label: "Sugars (g)" },
  { key: "addedSugarsG", label: "Added sugars (g)" },
  { key: "sugarAlcoholsG", label: "Sugar alcohols (g)" },
  { key: "vitaminAPct", label: "Vitamin A (% DV)" },
  { key: "vitaminCPct", label: "Vitamin C (% DV)" },
  { key: "calciumPct", label: "Calcium (% DV)" },
  { key: "ironPct", label: "Iron (% DV)" },
  { key: "vitaminDPct", label: "Vitamin D (% DV)" },
] as const;

/* Mounted only while editing, so state initializes from the food. */
function EditFoodDialog({
  food,
  onOpenChange,
  onSaved,
}: {
  food: FoodDTO;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(food.name);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const field of EDIT_FIELDS) {
      const value = food[field.key as keyof FoodDTO];
      next[field.key] = value == null ? "" : String(value);
    }
    return next;
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    const payload: Record<string, unknown> = {};
    if (name.trim() && name.trim() !== food.name) payload.name = name.trim();
    for (const field of EDIT_FIELDS) {
      const raw = values[field.key];
      if (raw === "" || raw == null) continue;
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) {
        toast.error(`${field.label} must be a non-negative number`);
        return;
      }
      if (num !== food[field.key as keyof FoodDTO]) payload[field.key] = num;
    }
    if (Object.keys(payload).length === 0) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/foods/${food.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success("Food updated, change recorded in history");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit shared food</DialogTitle>
          <DialogDescription>
            Anyone can edit, every change is tracked with your name
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="edit-name">Name</Label>
          <Input
            id="edit-name"
            value={name}
            maxLength={200}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {EDIT_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={`edit-${field.key}`}>{field.label}</Label>
              <Input
                id={`edit-${field.key}`}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={values[field.key] ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
              />
            </div>
          ))}
        </div>
        <Button disabled={busy} onClick={save}>
          {busy ? "Saving..." : "Save changes"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function FoodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [food, setFood] = useState<FoodDTO | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [foodData, historyData] = await Promise.all([
        apiFetch<{ food: FoodDTO }>(`/api/foods/${id}`),
        apiFetch<{ history: HistoryRow[] }>(`/api/foods/${id}/history`),
      ]);
      setFood(foodData.food);
      setHistory(historyData.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this food");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main>
      <PageHeader
        title="Food"
        action={
          food ? (
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil data-icon="inline-start" aria-hidden />
              Edit
            </Button>
          ) : undefined
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !food || !history ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="space-y-4 p-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{food.name}</h2>
              {food.isVerified ? <VerifiedBadge /> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {food.brandName ? `${food.brandName} · ` : ""}
              {food.servingSizeValue} {food.servingSizeUnit} per serving
              {food.barcode ? ` · barcode ${food.barcode}` : ""}
            </p>
          </div>

          <NutritionPanel
            nutrition={{
              calories: food.calories,
              proteinG: food.proteinG,
              carbsG: food.carbsG,
              fatG: food.fatG,
              fiberG: food.fiberG ?? undefined,
              sugarG: food.sugarG ?? undefined,
              satFatG: food.satFatG ?? undefined,
              sodiumMg: food.sodiumMg ?? undefined,
              cholesterolMg: food.cholesterolMg ?? undefined,
              potassiumMg: food.potassiumMg ?? undefined,
              transFatG: food.transFatG ?? undefined,
              polyUnsatFatG: food.polyUnsatFatG ?? undefined,
              monoUnsatFatG: food.monoUnsatFatG ?? undefined,
              addedSugarsG: food.addedSugarsG ?? undefined,
              sugarAlcoholsG: food.sugarAlcoholsG ?? undefined,
              vitaminAPct: food.vitaminAPct ?? undefined,
              vitaminCPct: food.vitaminCPct ?? undefined,
              calciumPct: food.calciumPct ?? undefined,
              ironPct: food.ironPct ?? undefined,
              vitaminDPct: food.vitaminDPct ?? undefined,
            }}
          />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-base">
                <History className="size-4" aria-hidden />
                Edit history
              </CardTitle>
            </CardHeader>
            <CardContent className="food-edit-history">
              {history.length === 0 ? (
                <EmptyState
                  title="No edits yet"
                  body="Changes to this shared food will be listed here."
                />
              ) : (
                <ul className="divide-y text-sm">
                  {history.map((row) => (
                    <li key={row.id} className="py-2">
                      <p>
                        <span className="font-medium">{row.fieldChanged}</span>{" "}
                        <span className="text-muted-foreground">
                          {row.oldValue ?? "—"} → {row.newValue ?? "—"}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.editedBy ?? "A user"} ·{" "}
                        {new Date(row.editedAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {food && editOpen ? (
        <EditFoodDialog food={food} onOpenChange={setEditOpen} onSaved={load} />
      ) : null}
    </main>
  );
}
