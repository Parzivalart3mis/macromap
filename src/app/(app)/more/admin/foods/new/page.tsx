"use client";

import { AlertTriangle, Camera, Check, ShieldCheck, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Spinner } from "@/components/async-states";
import { SubHeader } from "@/components/more/sub-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/client/fetcher";
import { haptic } from "@/lib/client/haptics";
import { imageToBase64 } from "@/lib/client/image";
import {
  API_DEFAULT_ZERO,
  NUTRITION_FIELDS,
  decimalOnly,
  labelWarnings,
  parseServing,
  type ScannedLabel,
} from "@/lib/foods/label-fields";
import { cn } from "@/lib/utils";

interface StoreRow {
  id: string;
  name: string;
  slug: string;
}

interface CreateResult {
  status: "created" | "duplicate_warning" | "barcode_taken";
  foodId?: string;
  placed?: "menu" | "builder" | null;
  similarFoods?: Array<{ id: string; name: string; brandName: string | null }>;
  existing?: { id: string; name: string; brandName: string | null };
}

const MAX_PHOTOS = 5;

export default function AdminNewFoodPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<Array<{ url: string; file: File }>>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [servingSize, setServingSize] = useState("");
  const [perContainer, setPerContainer] = useState("1");
  const [numbers, setNumbers] = useState<Record<string, string>>({});

  const [storeId, setStoreId] = useState<string>("none");
  const [placement, setPlacement] = useState<"menu" | "builder">("menu");
  const [category, setCategory] = useState("");
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [known, setKnown] = useState<{ menuCategories: string[]; ingredientGroups: string[] }>({
    menuCategories: [],
    ingredientGroups: [],
  });

  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<CreateResult | null>(null);

  useEffect(() => {
    apiFetch<{ stores: StoreRow[] }>("/api/stores")
      .then((d) => setStores(d.stores))
      .catch(() => undefined);
  }, []);

  // Existing sections for the chosen store, so a new item joins one rather
  // than inventing a near-duplicate category.
  useEffect(() => {
    if (storeId === "none") return;
    apiFetch<{ menuCategories: string[]; ingredientGroups: string[] }>(
      `/api/admin/foods?storeId=${storeId}`,
    )
      .then(setKnown)
      .catch(() => undefined);
  }, [storeId]);

  // Object URLs for the thumbnails have to be released by hand.
  useEffect(() => {
    return () => photos.forEach((p) => URL.revokeObjectURL(p.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addPhotos(files: File[]) {
    setPhotos((prev) =>
      [...prev, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(
        0,
        MAX_PHOTOS,
      ),
    );
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function scan() {
    if (!photos.length) return;
    setScanning(true);
    try {
      const images = await Promise.all(photos.map((p) => imageToBase64(p.file)));
      const { label } = await apiFetch<{ label: ScannedLabel }>("/api/foods/label-scan", {
        method: "POST",
        body: JSON.stringify({ images }),
      });
      if (label.brandName) setBrandName(label.brandName);
      if (label.foodName) setName(label.foodName);
      if (label.servingSize) setServingSize(label.servingSize);
      if (label.servingsPerContainer) setPerContainer(String(label.servingsPerContainer));
      if (label.barcode) setBarcode(label.barcode);
      const next: Record<string, string> = {};
      for (const field of NUTRITION_FIELDS) {
        const value = label[field.key];
        if (typeof value === "number") next[field.key] = String(value);
      }
      setNumbers((prev) => ({ ...prev, ...next }));
      setScanned(true);
      haptic("success");
      toast.success(
        `Read ${photos.length} photo${photos.length > 1 ? "s" : ""} — check every value`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read those photos");
    } finally {
      setScanning(false);
    }
  }

  const warnings = labelWarnings(numbers);
  const store = stores.find((s) => s.id === storeId);
  const categoryOptions =
    placement === "builder" ? known.ingredientGroups : known.menuCategories;

  function payload(forceCreate: boolean) {
    const { value, unit } = parseServing(servingSize);
    const body: Record<string, unknown> = {
      name: name.trim(),
      servingSizeValue: value,
      servingSizeUnit: unit,
      isVerified: true,
      forceCreate,
    };
    if (brandName.trim()) body.brandName = brandName.trim();
    if (barcode.trim()) body.barcode = barcode.trim();
    const perN = Number(perContainer);
    if (Number.isFinite(perN) && perN > 1) {
      body.alternateServings = [{ unit: "container", multiplier: perN }];
    }
    for (const field of NUTRITION_FIELDS) {
      const raw = numbers[field.key];
      if (raw != null && raw !== "") body[field.key] = Number(raw);
      else if (API_DEFAULT_ZERO.has(field.key)) body[field.key] = 0;
    }
    if (store && category.trim()) {
      body.store = {
        storeId: store.id,
        menuCategory: category.trim(),
        placement,
        ...(placement === "builder" ? { ingredientGroup: category.trim() } : {}),
      };
    }
    return body;
  }

  async function save(forceCreate: boolean) {
    if (!name.trim()) return toast.error("A name is required");
    if (!numbers.calories) return toast.error("Calories are required");
    if (store && !category.trim()) {
      return toast.error(placement === "builder" ? "Pick a group" : "Pick a category");
    }
    setBusy(true);
    try {
      const result = await apiFetch<CreateResult>("/api/admin/foods", {
        method: "POST",
        body: JSON.stringify(payload(forceCreate)),
      });
      if (result.status === "created") {
        haptic("success");
        toast.success(
          result.placed
            ? `Added as verified, on ${store?.name}'s ${result.placed === "builder" ? "builder" : "menu"}`
            : "Added as a verified item",
        );
        router.replace(`/foods/${result.foodId}`);
      } else {
        setConflict(result);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add it");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <SubHeader title="Add a verified item" />
      <div className="space-y-4 p-4 pb-28">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="size-4 text-primary" aria-hidden />
              Photos of the package
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Front for the brand and name, back for the Nutrition Facts panel, and the
              barcode if it is on a third face. They are read together as one package.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) addPhotos(files);
              }}
            />
            {photos.length ? (
              <ul className="flex flex-wrap gap-2">
                {photos.map((photo, index) => (
                  <li key={photo.url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={`Package photo ${index + 1}`}
                      className="size-20 rounded-xl object-cover ring-1 ring-foreground/10"
                    />
                    <button
                      type="button"
                      aria-label={`Remove photo ${index + 1}`}
                      onClick={() => removePhoto(index)}
                      className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-background text-destructive ring-1 ring-foreground/15"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={photos.length >= MAX_PHOTOS}
                onClick={() => fileRef.current?.click()}
              >
                <Camera data-icon="inline-start" aria-hidden />
                {photos.length ? "Add another" : "Add photos"}
              </Button>
              <Button className="flex-1" disabled={!photos.length || scanning} onClick={scan}>
                {scanning ? <Spinner data-icon="inline-start" /> : null}
                {scanning ? "Reading…" : "Scan"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {scanned ? "Check every value" : "Details"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="f-name">Name</Label>
                <Input id="f-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="f-brand">Brand</Label>
                <Input id="f-brand" value={brandName} maxLength={100} onChange={(e) => setBrandName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="f-barcode">Barcode</Label>
                <Input id="f-barcode" value={barcode} inputMode="numeric" onChange={(e) => setBarcode(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="f-serving">Serving size</Label>
                <Input id="f-serving" value={servingSize} placeholder="1 pack (70 g)" onChange={(e) => setServingSize(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="f-per">Servings per container</Label>
                <Input
                  id="f-per"
                  inputMode="decimal"
                  value={perContainer}
                  onChange={(e) => setPerContainer(decimalOnly(e.target.value))}
                />
              </div>
            </div>

            {warnings.length ? (
              <ul className="space-y-1 rounded-xl bg-[var(--warning)]/10 px-3 py-2 text-xs ring-1 ring-[var(--warning)]/25">
                {warnings.map((warning) => (
                  <li key={warning} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--warning)]" aria-hidden />
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <ul className="divide-y text-sm">
              {NUTRITION_FIELDS.map((field) => (
                <li key={field.key} className="flex items-center gap-3 py-1.5">
                  <span className={cn("flex-1", field.required && "font-medium")}>
                    {field.label}
                  </span>
                  <Input
                    aria-label={field.label}
                    inputMode="decimal"
                    value={numbers[field.key] ?? ""}
                    onChange={(e) =>
                      setNumbers((prev) => ({ ...prev, [field.key]: decimalOnly(e.target.value) }))
                    }
                    className="h-8 w-24 shrink-0 text-right"
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Place it in a store</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="f-store">Store</Label>
              <Select
                value={storeId}
                onValueChange={(v) => {
                  setStoreId(v);
                  setCategory("");
                }}
              >
                <SelectTrigger id="f-store" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No store — standalone item</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {store ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="f-placement">Placement</Label>
                  <Select
                    value={placement}
                    onValueChange={(v) => {
                      setPlacement(v as "menu" | "builder");
                      setCategory("");
                    }}
                  >
                    <SelectTrigger id="f-placement" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="menu">Menu item</SelectItem>
                      <SelectItem value="builder">Build-your-own ingredient</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="f-category">
                    {placement === "builder" ? "Ingredient group" : "Menu category"}
                  </Label>
                  <Input
                    id="f-category"
                    list="known-categories"
                    value={category}
                    placeholder={categoryOptions[0] ?? "Dairy"}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                  <datalist id="known-categories">
                    {categoryOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                  {categoryOptions.length ? (
                    <p className="px-1 text-xs text-muted-foreground">
                      Already in {store.name}: {categoryOptions.join(" · ")}
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 rounded-xl bg-primary/8 px-3 py-2.5 text-xs ring-1 ring-primary/15">
          <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
          <span>
            Saved as a <span className="font-semibold">verified</span> entry in the shared
            database — everyone can log it.
          </span>
        </div>

        <Button className="w-full" size="lg" disabled={busy} onClick={() => save(false)}>
          {busy ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" aria-hidden />}
          {busy ? "Saving…" : "Add verified item"}
        </Button>
      </div>

      {conflict ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4 sm:place-items-center">
          <Card className="w-full max-w-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {conflict.status === "barcode_taken"
                  ? "That barcode already exists"
                  : "Similar items already exist"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="divide-y text-sm">
                {(conflict.existing ? [conflict.existing] : (conflict.similarFoods ?? [])).map(
                  (food) => (
                    <li key={food.id} className="py-2">
                      <span className="font-medium">{food.name}</span>
                      {food.brandName ? (
                        <span className="text-muted-foreground"> · {food.brandName}</span>
                      ) : null}
                    </li>
                  ),
                )}
              </ul>
              <p className="text-xs text-muted-foreground">
                Upgrading the existing row is usually better than adding a second one.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConflict(null)}>
                  <Trash2 data-icon="inline-start" aria-hidden />
                  Go back
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() => {
                    setConflict(null);
                    save(true);
                  }}
                >
                  Add anyway
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  );
}
