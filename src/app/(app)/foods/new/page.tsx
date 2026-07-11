"use client";

import { ArrowLeft, ArrowRight, Check, ScanText, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ListSkeleton } from "@/components/async-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// Nutrition step, in the order the label reads. Only Calories is user-required;
// protein/carbs/fat are optional in the UI but sent as 0 (the API needs them).
const NUTRITION_FIELDS = [
  { key: "calories", label: "Calories", required: true },
  { key: "fatG", label: "Total Fat (g)" },
  { key: "satFatG", label: "Saturated Fat (g)" },
  { key: "polyUnsatFatG", label: "Polyunsaturated Fat (g)" },
  { key: "monoUnsatFatG", label: "Monounsaturated (g)" },
  { key: "transFatG", label: "Trans Fat (g)" },
  { key: "cholesterolMg", label: "Cholesterol (mg)" },
  { key: "sodiumMg", label: "Sodium (mg)" },
  { key: "potassiumMg", label: "Potassium (mg)" },
  { key: "carbsG", label: "Total Carbohydrates (g)" },
  { key: "fiberG", label: "Dietary Fiber (g)" },
  { key: "sugarG", label: "Sugars (g)" },
  { key: "addedSugarsG", label: "Added Sugars (g)" },
  { key: "sugarAlcoholsG", label: "Sugar Alcohols (g)" },
  { key: "proteinG", label: "Protein (g)" },
  { key: "vitaminAPct", label: "Vitamin A (% DV)" },
  { key: "vitaminCPct", label: "Vitamin C (% DV)" },
  { key: "calciumPct", label: "Calcium (% DV)" },
  { key: "ironPct", label: "Iron (% DV)" },
  { key: "vitaminDPct", label: "Vitamin D (% DV)" },
] as const;
const API_DEFAULT_ZERO = new Set(["calories", "proteinG", "carbsG", "fatG"]);

const ROW_INPUT =
  "h-8 flex-1 min-w-0 border-0 bg-transparent p-0 text-right shadow-none focus-visible:ring-0";
const NUM_INPUT =
  "h-8 w-28 shrink-0 border-0 bg-transparent p-0 text-right shadow-none focus-visible:ring-0";

/** Parse "1 cup" / "0.5 cup" / "1/2 cup" / "100g" into { value, unit }. */
function parseServing(input: string): { value: number; unit: string } {
  const s = input.trim();
  const match = s.match(/^([\d.]+\/[\d.]+|[\d.]+)\s*(.*)$/);
  if (!match) return { value: 1, unit: s || "serving" };
  let value = 1;
  if (match[1].includes("/")) {
    const [a, b] = match[1].split("/").map(Number);
    value = b ? a / b : 1;
  } else {
    value = Number(match[1]) || 1;
  }
  return { value: value > 0 ? value : 1, unit: match[2].trim() || "serving" };
}

/** Keep only digits and a single decimal point. */
function decimalOnly(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
}

/** Downscale a label photo to ≤1280 px JPEG and return bare base64. */
async function imageToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { data: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType: "image/jpeg" };
}

/** Fields the scanner can prefill (label-printed values as strings). */
interface ScannedLabel {
  brandName?: string | null;
  foodName?: string | null;
  servingSize?: string | null;
  servingsPerContainer?: number | null;
  barcode?: string | null;
  [nutrient: string]: string | number | null | undefined;
}

function CreateFoodWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const barcode = searchParams.get("barcode") ?? "";

  const [step, setStep] = useState<1 | 2>(1);
  const [brandName, setBrandName] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [servingSize, setServingSize] = useState("");
  const [perContainer, setPerContainer] = useState("1");
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<SimilarFood[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  async function scanLabel(file: File) {
    setScanning(true);
    try {
      const { data, mimeType } = await imageToBase64(file);
      const { label } = await apiFetch<{ label: ScannedLabel }>("/api/foods/label-scan", {
        method: "POST",
        body: JSON.stringify({ image: data, mimeType }),
      });
      if (label.brandName) setBrandName(label.brandName);
      if (label.foodName) setName(label.foodName);
      if (label.servingSize) setServingSize(label.servingSize);
      if (label.servingsPerContainer) setPerContainer(String(label.servingsPerContainer));
      const scanned: Record<string, string> = {};
      for (const field of NUTRITION_FIELDS) {
        const value = label[field.key];
        if (typeof value === "number") scanned[field.key] = String(value);
      }
      setNumbers((prev) => ({ ...prev, ...scanned }));
      toast.success("Label scanned — check the values before saving");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that label");
    } finally {
      setScanning(false);
    }
  }

  // Back trap: advancing to step 2 pushes a history entry, so the back gesture /
  // button returns to step 1 instead of leaving the wizard.
  useEffect(() => {
    const onPop = () => setStep(1);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function goNext() {
    if (!name.trim()) {
      toast.error("Food name is required");
      return;
    }
    if (!servingSize.trim() || !(parseServing(servingSize).value > 0)) {
      toast.error("Enter a serving size, e.g. 1 cup");
      return;
    }
    if (!(Number(perContainer) > 0)) {
      toast.error("Servings per container must be at least 1");
      return;
    }
    window.history.pushState({ foodWizard: 2 }, "");
    setStep(2);
  }

  function buildPayload(forceCreate: boolean) {
    const { value, unit } = parseServing(servingSize);
    const payload: Record<string, unknown> = {
      name: name.trim(),
      servingSizeValue: value,
      servingSizeUnit: unit,
      forceCreate,
    };
    if (brandName.trim()) payload.brandName = brandName.trim();
    if (description.trim()) payload.description = description.trim();
    if (barcode.trim()) payload.barcode = barcode.trim();
    // Servings per container → a "container" alternate serving (MFP-style).
    const perN = Number(perContainer);
    if (Number.isFinite(perN) && perN > 1) {
      payload.alternateServings = [{ unit: "container", multiplier: perN }];
    }
    for (const field of NUTRITION_FIELDS) {
      const raw = numbers[field.key];
      if (raw != null && raw !== "") payload[field.key] = Number(raw);
      else if (API_DEFAULT_ZERO.has(field.key)) payload[field.key] = 0;
    }
    return payload;
  }

  async function submit(forceCreate: boolean) {
    if (numbers.calories == null || numbers.calories === "") {
      toast.error("Calories are required");
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
        router.replace(`/foods/${result.foodId}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create food");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="pb-10">
      <header className="top-header app-chrome glass sticky top-0 z-30 border-b border-border/60 px-4 pb-3">
        <div className="flex items-center justify-between gap-2 pt-2">
          {step === 1 ? (
            <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => router.back()}>
              <X aria-hidden />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Back"
              onClick={() => window.history.back()}
            >
              <ArrowLeft aria-hidden />
            </Button>
          )}
          <h1 className="text-lg font-bold">Create Food</h1>
          {step === 1 ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next"
              className="text-primary"
              onClick={goNext}
            >
              <ArrowRight aria-hidden />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Save food"
              className="text-primary"
              disabled={busy}
              onClick={() => submit(false)}
            >
              <Check aria-hidden />
            </Button>
          )}
        </div>
      </header>

      {step === 1 ? (
        <div className="divide-y border-b text-sm">
          {/* Photo of the Nutrition Facts label prefills both steps */}
          <div className="px-4 py-3">
            <input
              ref={scanInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) scanLabel(file);
              }}
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={scanning}
              onClick={() => scanInputRef.current?.click()}
            >
              <ScanText data-icon="inline-start" aria-hidden />
              {scanning ? "Reading label..." : "Scan a nutrition label"}
            </Button>
          </div>
          <FieldRow label="Brand Name" hint="Optional">
            <Input
              value={brandName}
              maxLength={100}
              placeholder="ex. Campbell's"
              onChange={(e) => setBrandName(e.target.value)}
              className={ROW_INPUT}
            />
          </FieldRow>
          <FieldRow label="Food Name" hint="Required">
            <Input
              value={name}
              maxLength={200}
              placeholder="ex. Chicken Soup"
              onChange={(e) => setName(e.target.value)}
              className={ROW_INPUT}
            />
          </FieldRow>
          <FieldRow label="Description" hint="Optional">
            <Input
              value={description}
              maxLength={500}
              placeholder="ex. Homemade, less oil"
              onChange={(e) => setDescription(e.target.value)}
              className={ROW_INPUT}
            />
          </FieldRow>
          <FieldRow label="Serving Size" hint="Required">
            <Input
              value={servingSize}
              maxLength={30}
              placeholder="ex. 1 cup"
              onChange={(e) => setServingSize(e.target.value)}
              className={ROW_INPUT}
            />
          </FieldRow>
          <FieldRow label="Servings per container" hint="Required">
            <Input
              type="text"
              inputMode="decimal"
              value={perContainer}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setPerContainer(decimalOnly(e.target.value))}
              className={ROW_INPUT}
            />
          </FieldRow>
        </div>
      ) : (
        <>
          <p className="px-4 pt-4 pb-1 text-sm font-semibold text-muted-foreground">
            Nutrition Facts
          </p>
          <div className="divide-y border-y text-sm">
            {NUTRITION_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center justify-between gap-3 px-4 py-3">
                <label htmlFor={`nf-${field.key}`} className="font-medium">
                  {field.label}
                </label>
                <Input
                  id={`nf-${field.key}`}
                  type="text"
                  inputMode="decimal"
                  placeholder={"required" in field ? "Required" : "Optional"}
                  value={numbers[field.key] ?? ""}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) =>
                    setNumbers((prev) => ({ ...prev, [field.key]: decimalOnly(e.target.value) }))
                  }
                  className={NUM_INPUT}
                />
              </div>
            ))}
          </div>
          <p className="px-4 pt-3 text-center text-xs text-muted-foreground">
            Shared foods are visible to all users; edits are tracked in history.
          </p>
        </>
      )}

      <Sheet
        open={duplicates !== null}
        onOpenChange={(open) => {
          if (!open) setDuplicates(null);
        }}
      >
        <SheetContent side="bottom" className="sheet-safe-bottom rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Similar foods already exist</SheetTitle>
            <SheetDescription>Using an existing entry keeps the shared database clean</SheetDescription>
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
              <Button variant="outline" className="flex-1" onClick={() => setDuplicates(null)}>
                Go back
              </Button>
              <Button className="flex-1" disabled={busy} onClick={() => submit(true)}>
                Create anyway
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="shrink-0">
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      {children}
    </div>
  );
}

export default function NewFoodPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <CreateFoodWizard />
    </Suspense>
  );
}
