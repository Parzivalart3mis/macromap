"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import {
  AlternateServingsEditor,
  type ServingDraft,
  servingsFromDrafts,
} from "@/components/foods/alternate-servings-editor";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiFetch } from "@/lib/client/fetcher";

interface SimilarFood {
  id: string;
  name: string;
  brandName: string | null;
  similarityScore: number;
}

type CreateResponse =
  | { status: "duplicate_warning"; similarFoods: SimilarFood[] }
  | { status: "created"; foodId: string };

const NUMBER_FIELDS = [
  { key: "calories", label: "Calories (kcal)", required: true },
  { key: "proteinG", label: "Protein (g)", required: true },
  { key: "carbsG", label: "Total carbs (g)", required: true },
  { key: "fatG", label: "Total fat (g)", required: true },
  { key: "satFatG", label: "Saturated fat (g)", required: false },
  { key: "polyUnsatFatG", label: "Polyunsat. fat (g)", required: false },
  { key: "monoUnsatFatG", label: "Monounsat. fat (g)", required: false },
  { key: "transFatG", label: "Trans fat (g)", required: false },
  { key: "cholesterolMg", label: "Cholesterol (mg)", required: false },
  { key: "sodiumMg", label: "Sodium (mg)", required: false },
  { key: "potassiumMg", label: "Potassium (mg)", required: false },
  { key: "fiberG", label: "Dietary fiber (g)", required: false },
  { key: "sugarG", label: "Sugars (g)", required: false },
  { key: "addedSugarsG", label: "Added sugars (g)", required: false },
  { key: "sugarAlcoholsG", label: "Sugar alcohols (g)", required: false },
  { key: "vitaminAPct", label: "Vitamin A (% DV)", required: false },
  { key: "vitaminCPct", label: "Vitamin C (% DV)", required: false },
  { key: "calciumPct", label: "Calcium (% DV)", required: false },
  { key: "ironPct", label: "Iron (% DV)", required: false },
  { key: "vitaminDPct", label: "Vitamin D (% DV)", required: false },
] as const;

function NewFoodForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [description, setDescription] = useState("");
  const [servingValue, setServingValue] = useState("1");
  const [servingUnit, setServingUnit] = useState("serving");
  const [barcode, setBarcode] = useState(searchParams.get("barcode") ?? "");
  const [altServings, setAltServings] = useState<ServingDraft[]>([]);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<SimilarFood[] | null>(null);

  function buildPayload(forceCreate: boolean) {
    const payload: Record<string, unknown> = {
      name: name.trim(),
      servingSizeValue: Number(servingValue),
      servingSizeUnit: servingUnit.trim(),
      forceCreate,
    };
    if (brandName.trim()) payload.brandName = brandName.trim();
    if (description.trim()) payload.description = description.trim();
    if (barcode.trim()) payload.barcode = barcode.trim();
    const alternateServings = servingsFromDrafts(altServings);
    if (alternateServings.length > 0) payload.alternateServings = alternateServings;
    for (const field of NUMBER_FIELDS) {
      const raw = numbers[field.key];
      if (raw != null && raw !== "") payload[field.key] = Number(raw);
      else if (field.required) payload[field.key] = 0;
    }
    return payload;
  }

  async function submit(forceCreate: boolean) {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!(Number(servingValue) > 0)) {
      toast.error("Serving size must be positive");
      return;
    }
    setBusy(true);
    try {
      const result = await apiFetch<CreateResponse>("/api/foods", {
        method: "POST",
        body: JSON.stringify(buildPayload(forceCreate)),
      });
      if (result.status === "duplicate_warning") {
        setDuplicates(result.similarFoods);
      } else {
        toast.success("Food added to the shared database");
        router.push(`/foods/${result.foodId}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create food");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="space-y-4 p-4">
        <div className="space-y-1">
          <Label htmlFor="food-name">Name</Label>
          <Input
            id="food-name"
            value={name}
            maxLength={200}
            onChange={(event) => setName(event.target.value)}
            placeholder="Greek yogurt, plain"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="food-brand">Brand (optional)</Label>
          <Input
            id="food-brand"
            value={brandName}
            maxLength={100}
            onChange={(event) => setBrandName(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="food-description">Description (optional)</Label>
          <Textarea
            id="food-description"
            value={description}
            maxLength={500}
            rows={2}
            placeholder="Notes about this dish — recipe source, how you make it..."
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="serving-value">Serving size</Label>
            <Input
              id="serving-value"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={servingValue}
              onChange={(event) => setServingValue(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="serving-unit">Unit</Label>
            <Input
              id="serving-unit"
              value={servingUnit}
              maxLength={20}
              onChange={(event) => setServingUnit(event.target.value)}
              placeholder="g, ml, serving"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="food-barcode">Barcode (optional)</Label>
          <Input
            id="food-barcode"
            inputMode="numeric"
            value={barcode}
            onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ""))}
          />
        </div>

        <AlternateServingsEditor
          drafts={altServings}
          onChange={setAltServings}
          baseValue={Number(servingValue)}
          baseUnit={servingUnit}
        />

        <h2 className="pt-2 text-sm font-semibold">Nutrition per serving</h2>
        <div className="grid grid-cols-2 gap-3">
          {NUMBER_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={`nf-${field.key}`}>
                {field.label}
                {field.required ? "" : " (opt.)"}
              </Label>
              <Input
                id={`nf-${field.key}`}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={numbers[field.key] ?? ""}
                onChange={(event) =>
                  setNumbers((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
              />
            </div>
          ))}
        </div>

        <Button className="w-full" size="lg" disabled={busy} onClick={() => submit(false)}>
          {busy ? "Checking..." : "Add to shared database"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Shared foods are visible to all users, edits are tracked in history
        </p>
      </div>

      <Sheet
        open={duplicates !== null}
        onOpenChange={(open) => {
          if (!open) setDuplicates(null);
        }}
      >
        <SheetContent side="bottom" className="sheet-safe-bottom rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Similar foods already exist</SheetTitle>
            <SheetDescription>
              Using an existing entry keeps the shared database clean
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-6">
            <ul className="divide-y rounded-xl border">
              {duplicates?.map((food) => (
                <li key={food.id}>
                  <Link
                    href={`/foods/${food.id}`}
                    className="flex min-h-11 items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{food.name}</span>
                      {food.brandName ? (
                        <span className="text-xs text-muted-foreground">{food.brandName}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {Math.round(food.similarityScore * 100)}% match
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDuplicates(null)}
              >
                Go back
              </Button>
              <Button className="flex-1" disabled={busy} onClick={() => submit(true)}>
                Create anyway
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function NewFoodPage() {
  return (
    <main>
      <PageHeader title="New food" />
      <Suspense>
        <NewFoodForm />
      </Suspense>
    </main>
  );
}
