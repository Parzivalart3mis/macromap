"use client";

import {
  ArrowLeft,
  Calculator,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Link2,
  MapPin,
  Mic,
  MicOff,
  Pencil,
  PlusCircle,
  Repeat,
  ScanBarcode,
  Search,
  Type,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ListSkeleton } from "@/components/async-states";
import { BarcodeScanner, barcodeScanSupported } from "@/components/diary/barcode-scanner";
import { VerifiedBadge } from "@/components/foods/verified-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceLogging } from "@/hooks/useVoiceLogging";
import { apiFetch } from "@/lib/client/fetcher";
import { haptic } from "@/lib/client/haptics";
import { imageToBase64 } from "@/lib/client/image";
import { todayISO } from "@/lib/dates";
import { nativeServingLabel, nativeServingTextFor } from "@/lib/units";
import { cn } from "@/lib/utils";
import type {
  ExternalFoodResultDTO,
  FoodDTO,
  NaturalLogSuggestionDTO,
  SavedMealDTO,
  StoreDTO,
} from "@/types/api";

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Mode = null | "barcode" | "voice" | "text" | "quick" | "photo";

/** One AI-estimated food recognized from a meal photo. */
interface MealScanItem {
  name: string;
  quantity: number;
  unit?: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
type LoggedVia = "search" | "barcode" | "voice" | "natural_language";

/** One selected item queued for Multi-Add. */
interface BatchEntry {
  foodId: string;
  quantity: number;
  servingMultiplier: number;
  servingText?: string;
  label: string;
}

interface RecentItem {
  food: FoodDTO;
  /** Servings of the last-used unit (not folded into native servings). */
  lastQuantity: number;
  /** That unit's multiplier vs the native serving. */
  lastMultiplier: number;
  /** Display text of the last serving ("1 large (136 g)"); null on old rows. */
  lastServing: string | null;
}

/**
 * Current wall-clock "HH:MM", but only when logging for today — backfilling a
 * past date should not claim today's time.
 */
function currentTimeIfToday(date: string): string | undefined {
  if (date !== todayISO()) return undefined;
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}


/** Standard food line: "Brand, serving size" (+ last quantity and calories). */
function foodSubtitle(food: FoodDTO, quantity = 1): string {
  const serving = nativeServingLabel(food);
  const base = food.brandName ? `${food.brandName}, ${serving}` : serving;
  const qty = quantity !== 1 ? ` × ${quantity}` : "";
  return `${base}${qty} · ${Math.round(food.calories * quantity)} cal`;
}

/**
 * History line: the serving exactly as last logged, without the size
 * parenthetical — "1 large · 121 cal", not "1 large (136 g)" or "118 g".
 */
function recentSubtitle({ food, lastQuantity, lastMultiplier, lastServing }: RecentItem): string {
  const factor = lastQuantity * lastMultiplier;
  const serving = (lastServing ?? nativeServingTextFor(food, factor)).replace(
    /\s*\([^)]*\)\s*$/,
    "",
  );
  const base = food.brandName ? `${food.brandName}, ${serving}` : serving;
  return `${base} · ${Math.round(food.calories * factor)} cal`;
}

/** MFP-style row: tap the body for the serving picker, tap + to log instantly. */
/** Meal Scan: photograph a plate → review AI-estimated foods → log them. */
function MealScanPanel({
  mealName,
  date,
  onDone,
}: {
  mealName: string;
  date: string;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<Array<{ selected: boolean; item: MealScanItem }> | null>(null);
  const [scanning, setScanning] = useState(false);
  const [logging, setLogging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setScanning(true);
    try {
      const { data, mimeType } = await imageToBase64(file);
      const res = await apiFetch<{ items: MealScanItem[] }>("/api/foods/meal-scan", {
        method: "POST",
        body: JSON.stringify({ image: data, mimeType }),
      });
      if (res.items.length === 0) {
        toast.error("No foods recognized — try another photo");
        return;
      }
      setRows(res.items.map((item) => ({ selected: true, item })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that photo");
    } finally {
      setScanning(false);
    }
  }

  async function logSelected() {
    const chosen = (rows ?? []).filter((row) => row.selected).map((row) => row.item);
    if (chosen.length === 0) return;
    setLogging(true);
    try {
      await apiFetch("/api/diary/entries/batch", {
        method: "POST",
        body: JSON.stringify({
          entries: chosen.map((item) => ({
            date,
            mealName,
            quickAdd: {
              label: item.unit ? `${item.name} (${item.quantity} ${item.unit})` : item.name,
              calories: item.calories,
              proteinG: item.proteinG,
              carbsG: item.carbsG,
              fatG: item.fatG,
            },
            quantity: 1,
            servingMultiplier: 1,
            eatenTime: currentTimeIfToday(date),
            loggedVia: "quick_add",
          })),
        }),
      });
      haptic("success");
      toast.success(`Logged ${chosen.length} ${chosen.length === 1 ? "item" : "items"} to ${mealName}`);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not log items");
    } finally {
      setLogging(false);
    }
  }

  const selectedCount = rows?.filter((row) => row.selected).length ?? 0;

  return (
    <div className="animate-fade-up space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      {rows === null ? (
        <>
          <p className="text-sm text-muted-foreground">
            Snap a photo of your plate and we&apos;ll estimate each food.
          </p>
          <Button className="w-full" disabled={scanning} onClick={() => inputRef.current?.click()}>
            {scanning ? "Reading photo…" : "Take or choose a photo"}
          </Button>
        </>
      ) : (
        <>
          <p className="px-1 text-xs text-muted-foreground">
            AI estimates — uncheck anything wrong and review before logging.
          </p>
          <ul className="divide-y rounded-2xl border bg-card">
            {rows.map((row, index) => (
              <li key={index} className="flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--primary)]"
                  checked={row.selected}
                  onChange={(event) =>
                    setRows((prev) =>
                      (prev ?? []).map((r, i) =>
                        i === index ? { ...r, selected: event.target.checked } : r,
                      ),
                    )
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {row.item.name}
                    {row.item.unit ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {row.item.quantity} {row.item.unit}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(row.item.calories)} kcal · {Math.round(row.item.proteinG)}p{" "}
                    {Math.round(row.item.carbsG)}c {Math.round(row.item.fatG)}f
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setRows(null)}>
              Retake
            </Button>
            <Button
              className="flex-1"
              disabled={logging || selectedCount === 0}
              onClick={logSelected}
            >
              {logging ? "Adding…" : `Add ${selectedCount} to ${mealName}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Foodless "Quick add": type calories (+ optional macros) and drop it in. */
function QuickAddPanel({
  mealName,
  busy,
  onSubmit,
}: {
  mealName: string;
  busy: boolean;
  onSubmit: (value: {
    label: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }) => void;
}) {
  const [label, setLabel] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const cal = Number(calories);
  const valid = Number.isFinite(cal) && cal > 0;

  const macroInputs: Array<[string, string, (v: string) => void]> = [
    ["Protein", protein, setProtein],
    ["Carbs", carbs, setCarbs],
    ["Fat", fat, setFat],
  ];

  return (
    <div className="animate-fade-up space-y-3">
      <p className="text-sm text-muted-foreground">
        Log calories and macros without picking a food — for when you don&apos;t have the details.
      </p>
      <Input
        placeholder="Description (optional)"
        value={label}
        maxLength={60}
        onChange={(event) => setLabel(event.target.value)}
      />
      <div>
        <label className="mb-1 block px-1 text-xs font-medium text-muted-foreground">
          Calories
        </label>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="0"
          value={calories}
          onChange={(event) => setCalories(event.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {macroInputs.map(([macroLabel, value, setValue]) => (
          <div key={macroLabel}>
            <label className="mb-1 block px-1 text-xs font-medium text-muted-foreground">
              {macroLabel} (g)
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="0"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
        ))}
      </div>
      <Button
        className="w-full"
        disabled={!valid || busy}
        onClick={() =>
          onSubmit({
            label: label.trim() || "Quick add",
            calories: cal,
            proteinG: Number(protein) || 0,
            carbsG: Number(carbs) || 0,
            fatG: Number(fat) || 0,
          })
        }
      >
        {busy ? "Adding…" : `Add to ${mealName}`}
      </Button>
    </div>
  );
}

function QuickRow({
  title,
  subtitle,
  description,
  verified,
  busy,
  onOpen,
  onQuickLog,
  editHref,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  title: string;
  subtitle: string;
  description?: string | null;
  verified?: boolean;
  busy: boolean;
  onOpen?: () => void;
  onQuickLog: () => void;
  editHref?: string;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const mainClick = selectable ? onToggleSelect : onOpen;
  return (
    <div
      className={cn(
        "card-lift flex items-center gap-2 rounded-2xl border bg-card p-3 shadow-[var(--shadow-soft)]",
        selectable && selected && "border-primary/60 bg-primary/5",
      )}
    >
      <button
        type="button"
        onClick={mainClick}
        disabled={!mainClick}
        className="min-w-0 flex-1 text-left"
      >
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold">{title}</span>
          {verified ? <VerifiedBadge /> : null}
        </span>
        <span className="block truncate text-[12px] text-muted-foreground">
          {subtitle}
        </span>
        {description ? (
          <span className="block truncate text-[12px] text-muted-foreground/80 italic">
            {description}
          </span>
        ) : null}
      </button>
      {editHref && !selectable ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${title}`}
          className="rounded-full text-muted-foreground"
          asChild
        >
          <Link href={editHref}>
            <Pencil className="size-4" aria-hidden />
          </Link>
        </Button>
      ) : null}
      {selectable ? (
        <span
          aria-hidden
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full border transition-colors",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-transparent",
          )}
        >
          <Check className="size-4" aria-hidden />
        </span>
      ) : (
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label={`Log ${title}`}
          disabled={busy}
          onClick={onQuickLog}
          className="rounded-full text-primary"
        >
          <PlusCircle className="size-5" aria-hidden />
        </Button>
      )}
    </div>
  );
}

function SuggestionsReview({
  suggestions,
  runId,
  date,
  mealName,
  loggedVia,
  onDone,
}: {
  suggestions: NaturalLogSuggestionDTO[];
  runId: string;
  date: string;
  mealName: string;
  loggedVia: LoggedVia;
  onDone: () => void;
}) {
  const [included, setIncluded] = useState<boolean[]>(suggestions.map(() => true));
  const [busy, setBusy] = useState(false);

  async function logAll() {
    setBusy(true);
    try {
      let logged = 0;
      for (let i = 0; i < suggestions.length; i++) {
        if (!included[i]) continue;
        const suggestion = suggestions[i];
        let foodId = suggestion.matchedFood?.id;
        let quantity = suggestion.quantity;
        if (!foodId) {
          if (!suggestion.estimatedNutrition) continue;
          const created = await apiFetch<{ status: string; foodId: string }>(
            "/api/foods",
            {
              method: "POST",
              body: JSON.stringify({
                name: suggestion.inputName,
                servingSizeValue: 1,
                servingSizeUnit: "serving",
                calories: suggestion.estimatedNutrition.calories,
                proteinG: suggestion.estimatedNutrition.proteinG,
                carbsG: suggestion.estimatedNutrition.carbsG,
                fatG: suggestion.estimatedNutrition.fatG,
                forceCreate: true,
              }),
            },
          );
          foodId = created.foodId;
          quantity = 1;
        }
        const servingText = suggestion.matchedFood
          ? nativeServingTextFor(suggestion.matchedFood, quantity)
          : "1 serving";
        await apiFetch("/api/diary/entries", {
          method: "POST",
          body: JSON.stringify({
            date,
            mealName,
            foodId,
            quantity,
            servingMultiplier: 1,
            servingText,
            eatenTime: currentTimeIfToday(date),
            loggedVia,
          }),
        });
        logged++;
      }
      if (logged > 0) {
        await apiFetch(`/api/foods/natural-log/${runId}`, { method: "PATCH" }).catch(
          () => undefined,
        );
        toast.success(`Logged ${logged} ${logged === 1 ? "item" : "items"} to ${mealName}`);
      }
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logging failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Confirm what to log into {mealName}</p>
      <ul className="divide-y rounded-2xl border bg-card">
        {suggestions.map((suggestion, index) => {
          const nutrition = suggestion.matchedFood ?? suggestion.estimatedNutrition ?? null;
          return (
            <li key={index} className="flex items-center gap-3 px-3 py-2.5">
              <input
                id={`suggestion-${index}`}
                type="checkbox"
                className="size-5 accent-[var(--primary)]"
                checked={included[index]}
                onChange={(event) =>
                  setIncluded((prev) =>
                    prev.map((value, i) => (i === index ? event.target.checked : value)),
                  )
                }
              />
              <label htmlFor={`suggestion-${index}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {suggestion.matchedFood?.name ?? suggestion.inputName}
                  {suggestion.quantity !== 1 && suggestion.matchedFood
                    ? ` × ${suggestion.quantity}`
                    : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {suggestion.matchedFood
                    ? `Matched from database${suggestion.matchedFood.isVerified ? " · verified" : ""}`
                    : "AI estimate, added as a new food"}
                  {nutrition ? ` · ${Math.round(nutrition.calories)} kcal` : ""}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <Button className="w-full" disabled={busy || included.every((i) => !i)} onClick={logAll}>
        {busy ? "Logging..." : "Log selected"}
      </Button>
    </div>
  );
}

function AddFoodView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramDate = searchParams.get("date");
  const date = paramDate && DATE_RE.test(paramDate) ? paramDate : todayISO();
  const [mealName, setMealName] = useState(() => {
    const meal = searchParams.get("meal");
    return meal && meal.length <= 40 ? meal : "Snacks";
  });

  // Search state survives navigation (kept in the URL): coming back from a
  // store or food page restores the query and its results.
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [results, setResults] = useState<FoodDTO[]>([]);
  const [externalResults, setExternalResults] = useState<ExternalFoodResultDTO[]>([]);
  const [importingIndex, setImportingIndex] = useState<number | null>(null);
  const [searching, setSearching] = useState(
    () => (searchParams.get("q") ?? "").trim().length >= 2,
  );
  const [resultFilter, setResultFilter] = useState<"all" | "verified">("all");
  const [resultSort, setResultSort] = useState<"match" | "calories" | "protein">("match");
  // `submitted` gates the search-results view (search-as-you-type sets it once
  // the query reaches 2 chars).
  const [submitted, setSubmitted] = useState(() => (searchParams.get("q") ?? "").trim().length >= 2);

  // Logging
  const [quickBusy, setQuickBusy] = useState<string | null>(null);
  const [quickAddBusy, setQuickAddBusy] = useState(false);
  // Multi-Add: batch-select several foods and log them in one go.
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState<Map<string, BatchEntry>>(new Map());
  const [batchBusy, setBatchBusy] = useState(false);
  const [recipeUrl, setRecipeUrl] = useState("");
  const [importingRecipe, setImportingRecipe] = useState(false);

  // Tapping a food opens the full-page log screen (with the unit selector).
  // `servings` pre-fills the count and `mult` restores the last-used unit
  // (used by History so "1 large" reopens as 1 large, not 1.15 native).
  function openLog(id: string, via: LoggedVia, servings?: number, mult?: number) {
    const p = new URLSearchParams({ foodId: id, date, meal: mealName, via });
    if (servings && servings > 0) p.set("servings", String(servings));
    if (mult && mult > 0 && mult !== 1) p.set("mult", String(mult));
    router.push(`/diary/log?${p.toString()}`);
  }

  // Modes — a `mode` query param (from the diary FAB) opens straight into one.
  const [mode, setMode] = useState<Mode>(() => {
    const m = searchParams.get("mode");
    return m === "barcode" || m === "voice" || m === "text" || m === "quick" || m === "photo"
      ? m
      : null;
  });
  const [barcodeValue, setBarcodeValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [barcodeMiss, setBarcodeMiss] = useState<string | null>(null);
  const voice = useVoiceLogging();
  const [freeText, setFreeText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [review, setReview] = useState<{
    runId: string;
    suggestions: NaturalLogSuggestionDTO[];
    via: LoggedVia;
  } | null>(null);

  // Tabs data
  const [recent, setRecent] = useState<RecentItem[] | null>(null);
  const [frequent, setFrequent] = useState<RecentItem[] | null>(null);
  const [savedMeals, setSavedMeals] = useState<SavedMealDTO[] | null>(null);
  const [myFoods, setMyFoods] = useState<FoodDTO[] | null>(null);
  const [stores, setStores] = useState<StoreDTO[]>([]);

  useEffect(() => {
    // History/My Meals/My Foods refresh on mount, on meal switch (History is
    // ranked by what's usually eaten in that meal), and whenever this screen
    // becomes visible again (e.g. returning here after logging a food), so a
    // just-logged item shows up in "Recently logged".
    function loadLibrary() {
      apiFetch<{ recent: RecentItem[] }>(
        `/api/diary/recent?meal=${encodeURIComponent(mealName)}`,
      )
        .then((data) => setRecent(data.recent))
        .catch(() => setRecent([]));
      apiFetch<{ frequent: RecentItem[] }>(
        `/api/diary/frequent?meal=${encodeURIComponent(mealName)}`,
      )
        .then((data) => setFrequent(data.frequent))
        .catch(() => setFrequent([]));
      apiFetch<{ savedMeals: SavedMealDTO[] }>("/api/saved-meals")
        .then((data) => setSavedMeals(data.savedMeals))
        .catch(() => setSavedMeals([]));
      apiFetch<{ foods: FoodDTO[] }>("/api/foods/mine")
        .then((data) => setMyFoods(data.foods))
        .catch(() => setMyFoods([]));
    }
    loadLibrary();
    apiFetch<{ stores: StoreDTO[] }>("/api/stores")
      .then((data) => setStores(data.stores))
      .catch(() => undefined);

    const onVisible = () => {
      if (document.visibilityState === "visible") loadLibrary();
    };
    window.addEventListener("focus", loadLibrary);
    window.addEventListener("pageshow", loadLibrary);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", loadLibrary);
      window.removeEventListener("pageshow", loadLibrary);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [mealName]);

  // Keep search + meal in the URL so back-navigation restores this exact view.
  function syncUrl(nextQuery: string, nextMeal: string) {
    const params = new URLSearchParams();
    params.set("date", date);
    params.set("meal", nextMeal);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    router.replace(`/diary/add?${params.toString()}`, { scroll: false });
  }

  // Guards against out-of-order responses while typing: only the latest
  // request's results are applied.
  const searchSeq = useRef(0);

  async function fetchResults(value: string) {
    const seq = ++searchSeq.current;
    setSearching(true);
    try {
      const data = await apiFetch<{
        foods: FoodDTO[];
        external: ExternalFoodResultDTO[];
      }>(`/api/foods/search?q=${encodeURIComponent(value.trim())}`);
      if (seq !== searchSeq.current) return;
      setResults(data.foods);
      setExternalResults(data.external ?? []);
    } catch {
      if (seq === searchSeq.current) toast.error("Search failed");
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  }

  // Search-as-you-type: schedule the combined DB+web search shortly after the
  // query settles. State transitions live in runSearch so this effect only
  // schedules/cancels the debounced fetch (and runs once for a URL-restored
  // query on mount).
  useEffect(() => {
    if (query.trim().length < 2) return;
    const handle = setTimeout(() => void fetchResults(query.trim()), 250);
    return () => clearTimeout(handle);
  }, [query]);

  function runSearch(value: string) {
    setQuery(value);
    syncUrl(value, mealName);
    if (value.trim().length >= 2) {
      setSubmitted(true);
      setSearching(true);
    } else {
      searchSeq.current++; // discard any in-flight result
      setSubmitted(false);
      setSearching(false);
      setResults([]);
      setExternalResults([]);
    }
  }

  // Pressing the keyboard search key / magnifier searches immediately.
  function submitSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    void fetchResults(query);
  }

  // A store whose name matches the query gets a "browse the menu" card.
  const matchedStore =
    query.trim().length >= 3
      ? stores.find((store) => {
          const q = query.trim().toLowerCase();
          const name = store.name.toLowerCase();
          return name.includes(q) || q.includes(name);
        })
      : undefined;

  async function logFood(food: FoodDTO, quantity: number, via: LoggedVia) {
    await apiFetch("/api/diary/entries", {
      method: "POST",
      body: JSON.stringify({
        date,
        mealName,
        foodId: food.id,
        quantity,
        servingMultiplier: 1,
        servingText: nativeServingTextFor(food, quantity),
        eatenTime: currentTimeIfToday(date),
        loggedVia: via,
      }),
    });
    haptic("success");
    toast.success(`Logged to ${mealName}`);
  }

  /**
   * "+" on a food row. A plain food logs one native serving; a History item
   * re-logs the last serving verbatim (same unit, count, and text).
   */
  async function quickLog(item: FoodDTO | RecentItem, quantity = 1) {
    const isRecent = "lastQuantity" in item;
    const food = isRecent ? item.food : item;
    setQuickBusy(food.id);
    try {
      if (isRecent) {
        await apiFetch("/api/diary/entries", {
          method: "POST",
          body: JSON.stringify({
            date,
            mealName,
            foodId: food.id,
            quantity: item.lastQuantity,
            servingMultiplier: item.lastMultiplier,
            servingText:
              item.lastServing ??
              nativeServingTextFor(food, item.lastQuantity * item.lastMultiplier),
            eatenTime: currentTimeIfToday(date),
            loggedVia: "search",
          }),
        });
        haptic("success");
        toast.success(`Logged to ${mealName}`);
      } else {
        await logFood(food, quantity, "search");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logging failed");
    } finally {
      setQuickBusy(null);
    }
  }

  async function importRecipe() {
    const url = recipeUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Paste a recipe link (https://…)");
      return;
    }
    setImportingRecipe(true);
    try {
      const { food } = await apiFetch<{ food: { id: string; name: string } }>(
        "/api/foods/recipe-import",
        { method: "POST", body: JSON.stringify({ url }) },
      );
      haptic("success");
      toast.success(`Imported "${food.name}" to My Recipes`);
      setRecipeUrl("");
      const data = await apiFetch<{ foods: FoodDTO[] }>("/api/foods/mine");
      setMyFoods(data.foods);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import that recipe");
    } finally {
      setImportingRecipe(false);
    }
  }

  const foodToBatch = (food: FoodDTO): BatchEntry => ({
    foodId: food.id,
    quantity: 1,
    servingMultiplier: 1,
    servingText: nativeServingTextFor(food, 1),
    label: food.name,
  });
  const recentToBatch = (item: RecentItem): BatchEntry => ({
    foodId: item.food.id,
    quantity: item.lastQuantity,
    servingMultiplier: item.lastMultiplier,
    servingText: item.lastServing ?? undefined,
    label: item.food.name,
  });

  function toggleSelect(entry: BatchEntry) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(entry.foodId)) next.delete(entry.foodId);
      else next.set(entry.foodId, entry);
      return next;
    });
  }

  function exitMultiSelect() {
    setMultiSelect(false);
    setSelected(new Map());
  }

  async function batchLog() {
    if (selected.size === 0) return;
    setBatchBusy(true);
    try {
      const eatenTime = currentTimeIfToday(date);
      await apiFetch("/api/diary/entries/batch", {
        method: "POST",
        body: JSON.stringify({
          entries: [...selected.values()].map((entry) => ({
            date,
            mealName,
            foodId: entry.foodId,
            quantity: entry.quantity,
            servingMultiplier: entry.servingMultiplier,
            servingText: entry.servingText,
            eatenTime,
            loggedVia: "search",
          })),
        }),
      });
      haptic("success");
      const count = selected.size;
      toast.success(`Added ${count} ${count === 1 ? "item" : "items"} to ${mealName}`);
      exitMultiSelect();
      router.push(`/diary?date=${date}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add items");
    } finally {
      setBatchBusy(false);
    }
  }

  async function quickAddLog(input: {
    label: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }) {
    setQuickAddBusy(true);
    try {
      await apiFetch("/api/diary/entries", {
        method: "POST",
        body: JSON.stringify({
          date,
          mealName,
          quickAdd: input,
          quantity: 1,
          servingMultiplier: 1,
          eatenTime: currentTimeIfToday(date),
          loggedVia: "quick_add",
        }),
      });
      haptic("success");
      toast.success(`Added to ${mealName}`);
      router.push(`/diary?date=${date}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Quick add failed");
    } finally {
      setQuickAddBusy(false);
    }
  }

  async function importExternal(result: ExternalFoodResultDTO, index: number) {
    setImportingIndex(index);
    try {
      const { food } = await apiFetch<{ food: FoodDTO }>("/api/foods/import", {
        method: "POST",
        body: JSON.stringify(result),
      });
      openLog(food.id, "search");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setImportingIndex(null);
    }
  }

  async function lookupBarcode(code: string) {
    setScanning(false);
    setLookingUp(true);
    setBarcodeMiss(null);
    try {
      const result = await apiFetch<{ status: string; food: FoodDTO | null }>(
        "/api/foods/barcode/lookup",
        { method: "POST", body: JSON.stringify({ barcode: code }) },
      );
      if (result.food) {
        openLog(result.food.id, "barcode");
      } else {
        setBarcodeMiss(code);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lookup failed");
    } finally {
      setLookingUp(false);
    }
  }

  async function parseText(text: string, via: LoggedVia) {
    if (text.trim().length < 3) {
      toast.error("Describe what you ate first");
      return;
    }
    setParsing(true);
    try {
      const data = await apiFetch<{
        runId: string;
        suggestions: NaturalLogSuggestionDTO[];
      }>("/api/foods/natural-log", {
        method: "POST",
        body: JSON.stringify({ date, mealName, text: text.trim() }),
      });
      if (data.suggestions.length === 0) {
        toast.error("Could not find any foods in that description");
      } else {
        setReview({ runId: data.runId, suggestions: data.suggestions, via });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Parsing failed");
    } finally {
      setParsing(false);
    }
  }

  /**
   * Tapping a saved meal opens the full "Add Meal" screen (items, servings,
   * meal, time) carrying this flow's date + meal slot — the "+" stays the
   * one-tap path that logs a single serving straight away.
   */
  function openSavedMeal(savedMeal: SavedMealDTO) {
    const p = new URLSearchParams({ date, meal: mealName });
    router.push(`/more/foods/meals/${savedMeal.id}?${p.toString()}`);
  }

  async function logSavedMeal(savedMeal: SavedMealDTO) {
    setQuickBusy(savedMeal.id);
    try {
      await apiFetch(`/api/saved-meals/${savedMeal.id}/log`, {
        method: "POST",
        body: JSON.stringify({ date, mealName, eatenTime: currentTimeIfToday(date) }),
      });
      toast.success(`Logged ${savedMeal.name} to ${mealName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logging failed");
    } finally {
      setQuickBusy(null);
    }
  }

  const QUICK_ACTIONS = [
    {
      key: "barcode" as const,
      label: "Scan",
      icon: ScanBarcode,
      onClick: () => setMode(mode === "barcode" ? null : "barcode"),
    },
    {
      key: "voice" as const,
      label: "Voice",
      icon: Mic,
      onClick: () => setMode(mode === "voice" ? null : "voice"),
    },
    {
      key: "text" as const,
      label: "Describe",
      icon: Type,
      onClick: () => setMode(mode === "text" ? null : "text"),
    },
    {
      key: "quick" as const,
      label: "Quick add",
      icon: Calculator,
      onClick: () => setMode(mode === "quick" ? null : "quick"),
    },
    {
      key: "photo" as const,
      label: "Photo",
      icon: Camera,
      onClick: () => setMode(mode === "photo" ? null : "photo"),
    },
  ];

  // While typing (before submit), the tabs stay and filter locally by the query.
  const q = query.trim().toLowerCase();
  const filtering = q.length > 0 && !submitted;
  const matchesQuery = (name: string) => !q || name.toLowerCase().includes(q);
  const recentFiltered = recent?.filter((item) => matchesQuery(item.food.name)) ?? null;
  const frequentFiltered = frequent?.filter((item) => matchesQuery(item.food.name)) ?? null;
  const mealsFiltered = savedMeals?.filter((meal) => matchesQuery(meal.name)) ?? null;
  const recipesFiltered = myFoods?.filter((food) => food.isRecipe && matchesQuery(food.name)) ?? null;
  const foodsFiltered = myFoods?.filter((food) => !food.isRecipe && matchesQuery(food.name)) ?? null;

  // Client-side filter + sort over the server-ranked results.
  const displayedResults = (() => {
    const filtered = resultFilter === "verified" ? results.filter((f) => f.isVerified) : results;
    if (resultSort === "calories") return [...filtered].sort((a, b) => a.calories - b.calories);
    if (resultSort === "protein") return [...filtered].sort((a, b) => b.proteinG - a.proteinG);
    return filtered;
  })();

  const quickActionsRow = (
    <div className="grid grid-cols-3 gap-2">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={action.onClick}
          className={cn(
            "card-lift flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-1 py-3 text-xs font-semibold text-primary shadow-[var(--shadow-soft)]",
            mode === action.key && "border-primary/50 bg-primary/5",
          )}
        >
          <action.icon className="size-5" aria-hidden />
          {action.label}
        </button>
      ))}
      <Link
        href={`/foods/new`}
        className="card-lift flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-1 py-3 text-center text-xs font-semibold text-primary shadow-[var(--shadow-soft)]"
      >
        <PlusCircle className="size-5" aria-hidden />
        Create food
      </Link>
    </div>
  );

  const selectToggle = (
    <Button
      variant="ghost"
      size="xs"
      className="shrink-0 text-primary"
      onClick={() => (multiSelect ? exitMultiSelect() : setMultiSelect(true))}
    >
      {multiSelect ? "Cancel" : "Select"}
    </Button>
  );

  const modePanels = (
    <>
      {mode === "barcode" ? (
        <div className="animate-fade-up space-y-3">
          {scanning ? (
            <>
              <BarcodeScanner
                onDetected={(code) => {
                  setBarcodeValue(code);
                  lookupBarcode(code);
                }}
                onError={(message) => {
                  toast.error(message);
                  setScanning(false);
                }}
              />
              <Button variant="outline" className="w-full" onClick={() => setScanning(false)}>
                Stop scanning
              </Button>
            </>
          ) : (
            <>
              {barcodeScanSupported() ? (
                <Button variant="secondary" className="w-full" onClick={() => setScanning(true)}>
                  <ScanBarcode data-icon="inline-start" aria-hidden />
                  Scan with camera
                </Button>
              ) : null}
              <div className="flex gap-2">
                <Input
                  placeholder="Enter barcode digits"
                  inputMode="numeric"
                  value={barcodeValue}
                  onChange={(event) => setBarcodeValue(event.target.value.replace(/\D/g, ""))}
                />
                <Button
                  disabled={barcodeValue.length < 8 || lookingUp}
                  onClick={() => lookupBarcode(barcodeValue)}
                >
                  {lookingUp ? "Looking..." : "Look up"}
                </Button>
              </div>
            </>
          )}
          {barcodeMiss ? (
            <EmptyState
              icon={ScanBarcode}
              title="Barcode not found"
              body="It is not in our database, Open Food Facts, or USDA."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/foods/new?barcode=${barcodeMiss}`}>Add it manually</Link>
                </Button>
              }
            />
          ) : null}
        </div>
      ) : null}

      {mode === "voice" ? (
        <div className="animate-fade-up space-y-3">
          {voice.supported ? (
            <>
              <Button
                variant={voice.listening ? "destructive" : "secondary"}
                className="w-full"
                onClick={voice.listening ? voice.stop : voice.start}
              >
                {voice.listening ? (
                  <MicOff data-icon="inline-start" aria-hidden />
                ) : (
                  <Mic data-icon="inline-start" aria-hidden />
                )}
                {voice.listening ? "Stop listening" : "Start speaking"}
              </Button>
              <Textarea
                placeholder="Your words appear here, edit before parsing"
                value={voice.transcript}
                onChange={(event) => voice.setTranscript(event.target.value)}
                rows={3}
              />
              {voice.error ? <p className="text-sm text-destructive">{voice.error}</p> : null}
              <Button
                className="w-full"
                disabled={parsing || voice.transcript.trim().length < 3}
                onClick={() => parseText(voice.transcript, "voice")}
              >
                {parsing ? "Parsing..." : "Parse and review"}
              </Button>
            </>
          ) : (
            <EmptyState
              icon={MicOff}
              title="Voice input not supported"
              body="This browser does not support the Web Speech API. Use Describe instead."
            />
          )}
        </div>
      ) : null}

      {mode === "text" ? (
        <div className="animate-fade-up space-y-3">
          <Textarea
            placeholder='Try "2 eggs and a Subway footlong"'
            value={freeText}
            onChange={(event) => setFreeText(event.target.value)}
            rows={3}
          />
          <Button
            className="w-full"
            disabled={parsing || freeText.trim().length < 3}
            onClick={() => parseText(freeText, "natural_language")}
          >
            {parsing ? "Parsing..." : "Parse and review"}
          </Button>
        </div>
      ) : null}

      {mode === "quick" ? (
        <QuickAddPanel mealName={mealName} busy={quickAddBusy} onSubmit={quickAddLog} />
      ) : null}

      {mode === "photo" ? (
        <MealScanPanel
          mealName={mealName}
          date={date}
          onDone={() => router.push(`/diary?date=${date}`)}
        />
      ) : null}
    </>
  );

  return (
    <main>
      <header className="top-header app-chrome glass sticky top-0 z-30 border-b border-border/60 px-4 pb-3">
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to diary"
            onClick={() => router.back()}
          >
            <ArrowLeft aria-hidden />
          </Button>
          <div className="flex flex-1 justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-xl text-lg font-bold text-primary"
                >
                  {mealName}
                  <ChevronDown className="size-4" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {MEALS.map((meal) => (
                  <DropdownMenuItem
                    key={meal}
                    onSelect={() => {
                      setMealName(meal);
                      syncUrl(query, meal);
                    }}
                  >
                    {meal}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <span className="size-9" aria-hidden />
        </div>
      </header>

      <div className="space-y-4 p-4 pb-24">
        <form
          className="relative"
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch();
          }}
        >
          <button
            type="submit"
            aria-label="Search"
            className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          >
            <Search className="size-4" aria-hidden />
          </button>
          <Input
            type="search"
            enterKeyHint="search"
            placeholder="Search foods, brands, flavors..."
            value={query}
            onChange={(event) => runSearch(event.target.value)}
            autoComplete="off"
            className="h-12 rounded-full pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => runSearch("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </form>

        {/* Natural-language review takes over when present */}
        {review ? (
          <>
            <SuggestionsReview
              suggestions={review.suggestions}
              runId={review.runId}
              date={date}
              mealName={mealName}
              loggedVia={review.via}
              onDone={() => {
                setReview(null);
                setMode(null);
                setFreeText("");
                voice.setTranscript("");
              }}
            />
            <Button variant="ghost" className="w-full" onClick={() => setReview(null)}>
              Back
            </Button>
          </>
        ) : (
          <>
            {submitted ? (
              searching ? (
                <ListSkeleton rows={4} />
              ) : (
                <div className="space-y-4">
                  {matchedStore ? (
                    <Link
                      href={`/stores/${matchedStore.slug}?meal=${encodeURIComponent(mealName)}&date=${date}`}
                      className="card-lift flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-[var(--shadow-soft)]"
                    >
                      <span
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white"
                        style={{
                          backgroundColor:
                            matchedStore.theme?.primaryHex ?? "var(--primary)",
                        }}
                      >
                        <MapPin className="size-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold">
                          {matchedStore.name} Menu
                        </span>
                        <span className="text-[12px] text-muted-foreground">
                          Choose from {matchedStore.menuItemCount ?? 0} menu items
                        </span>
                      </span>
                      <ChevronRight
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </Link>
                  ) : null}
                  {results.length > 0 ? (
                    <div className="-mx-1 flex items-start justify-between gap-2 px-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          ["all", "All"],
                          ["verified", "Verified"],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setResultFilter(key)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            resultFilter === key
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
                      {(
                        [
                          ["match", "Best match"],
                          ["calories", "Fewest cal"],
                          ["protein", "Most protein"],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setResultSort(key)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            resultSort === key
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                      {selectToggle}
                    </div>
                  ) : null}
                  {displayedResults.length > 0 ? (
                    <div className="stagger-children space-y-2">
                      {displayedResults.map((food) => (
                        <QuickRow
                          key={food.id}
                          title={food.name}
                          subtitle={foodSubtitle(food)}
                          description={food.description}
                          verified={food.isVerified}
                          busy={quickBusy === food.id}
                          onOpen={() => openLog(food.id, "search")}
                          onQuickLog={() => quickLog(food, 1)}
                          selectable={multiSelect}
                          selected={selected.has(food.id)}
                          onToggleSelect={() => toggleSelect(foodToBatch(food))}
                        />
                      ))}
                    </div>
                  ) : results.length > 0 ? (
                    <p className="px-1 text-sm text-muted-foreground">
                      No verified matches — switch to All to see every result.
                    </p>
                  ) : null}
                  {externalResults.length > 0 ? (
                    <div className="space-y-2">
                      <p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Results from web
                      </p>
                      <div className="stagger-children space-y-2">
                        {externalResults.map((result, index) => (
                          <QuickRow
                            key={`${result.source}-${result.barcode ?? index}`}
                            title={result.name}
                            subtitle={`${result.brandName ? `${result.brandName}, ` : ""}${result.servingSizeValue} ${result.servingSizeUnit} · ${Math.round(result.calories)} cal · ${result.source === "usda" ? "USDA" : "Open Food Facts"}`}
                            busy={importingIndex === index}
                            onOpen={() => importExternal(result, index)}
                            onQuickLog={() => importExternal(result, index)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {results.length === 0 && externalResults.length === 0 ? (
                    <EmptyState
                      title="No matches"
                      body="Try a different name, or add it to the shared database."
                      action={
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/foods/new">Create food</Link>
                        </Button>
                      }
                    />
                  ) : null}
                </div>
              )
            ) : (
              <Tabs defaultValue="history">
                <TabsList className="w-full">
                  <TabsTrigger value="history">Recent</TabsTrigger>
                  <TabsTrigger value="frequent">Frequent</TabsTrigger>
                  <TabsTrigger value="meals">Meals</TabsTrigger>
                  <TabsTrigger value="recipes">Recipes</TabsTrigger>
                  <TabsTrigger value="foods">Foods</TabsTrigger>
                </TabsList>

                {/* Barcode / voice / describe / quick add — hidden while filtering */}
                {filtering ? null : (
                  <>
                    <div className="pt-3">{quickActionsRow}</div>
                    {modePanels}
                  </>
                )}

                <TabsContent value="history" className="pt-3">
                  {!filtering ? (
                    <div className="mb-2 flex items-center justify-between">
                      <p className="px-1 text-lg font-extrabold tracking-tight">
                        Recently logged
                      </p>
                      {recentFiltered && recentFiltered.length > 0 ? selectToggle : null}
                    </div>
                  ) : null}
                  {recentFiltered === null ? (
                    <ListSkeleton rows={4} />
                  ) : recentFiltered.length === 0 ? (
                    <EmptyState
                      title={filtering ? "No matches in your history" : "Nothing logged yet"}
                      body={
                        filtering
                          ? "Try the search key to look up the shared database."
                          : "Foods you log will show up here for quick relogging."
                      }
                    />
                  ) : (
                    <div className="stagger-children space-y-2">
                      {recentFiltered.map((item) => (
                        <QuickRow
                          key={item.food.id}
                          title={item.food.name}
                          subtitle={recentSubtitle(item)}
                          description={item.food.description}
                          verified={item.food.isVerified}
                          busy={quickBusy === item.food.id}
                          onOpen={() =>
                            openLog(item.food.id, "search", item.lastQuantity, item.lastMultiplier)
                          }
                          onQuickLog={() => quickLog(item)}
                          selectable={multiSelect}
                          selected={selected.has(item.food.id)}
                          onToggleSelect={() => toggleSelect(recentToBatch(item))}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="frequent" className="pt-3">
                  {!filtering ? (
                    <div className="mb-2 flex items-center justify-between">
                      <p className="px-1 text-lg font-extrabold tracking-tight">Frequent</p>
                      {frequentFiltered && frequentFiltered.length > 0 ? selectToggle : null}
                    </div>
                  ) : null}
                  {frequentFiltered === null ? (
                    <ListSkeleton rows={4} />
                  ) : frequentFiltered.length === 0 ? (
                    <EmptyState
                      icon={Repeat}
                      title={filtering ? "No matches in your frequents" : "No frequent foods yet"}
                      body={
                        filtering
                          ? "Try the search key to look up the shared database."
                          : "Log a food a few times and it will surface here for one-tap adding."
                      }
                    />
                  ) : (
                    <div className="stagger-children space-y-2">
                      {frequentFiltered.map((item) => (
                        <QuickRow
                          key={item.food.id}
                          title={item.food.name}
                          subtitle={recentSubtitle(item)}
                          description={item.food.description}
                          verified={item.food.isVerified}
                          busy={quickBusy === item.food.id}
                          onOpen={() =>
                            openLog(item.food.id, "search", item.lastQuantity, item.lastMultiplier)
                          }
                          onQuickLog={() => quickLog(item)}
                          selectable={multiSelect}
                          selected={selected.has(item.food.id)}
                          onToggleSelect={() => toggleSelect(recentToBatch(item))}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="meals" className="pt-3">
                  {mealsFiltered === null ? (
                    <ListSkeleton rows={3} />
                  ) : mealsFiltered.length === 0 ? (
                    <EmptyState
                      title={filtering ? "No meals match" : "No saved meals yet"}
                      body="Log a meal, then use its menu to save it as a template."
                    />
                  ) : (
                    <div className="stagger-children space-y-2">
                      {mealsFiltered.map((savedMeal) => (
                        <QuickRow
                          key={savedMeal.id}
                          title={savedMeal.name}
                          subtitle={`${savedMeal.entriesSnapshotJson.length} items, ${Math.round(
                            savedMeal.entriesSnapshotJson.reduce(
                              (sum, line) => sum + line.nutrition.calories,
                              0,
                            ),
                          )} cal`}
                          busy={quickBusy === savedMeal.id}
                          onOpen={() => openSavedMeal(savedMeal)}
                          onQuickLog={() => logSavedMeal(savedMeal)}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="recipes" className="space-y-3 pt-3">
                  {!filtering ? (
                    <div className="rounded-2xl border bg-card p-3 shadow-[var(--shadow-soft)]">
                      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                        <Link2 className="size-4 text-primary" aria-hidden />
                        Import from a link
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="url"
                          inputMode="url"
                          placeholder="Paste a recipe URL"
                          value={recipeUrl}
                          onChange={(event) => setRecipeUrl(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") importRecipe();
                          }}
                        />
                        <Button
                          className="shrink-0"
                          disabled={importingRecipe || recipeUrl.trim().length < 4}
                          onClick={importRecipe}
                        >
                          {importingRecipe ? "Importing…" : "Import"}
                        </Button>
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Macros are AI-estimated from the ingredients — review after importing.
                      </p>
                    </div>
                  ) : null}
                  {recipesFiltered === null ? (
                    <ListSkeleton rows={3} />
                  ) : recipesFiltered.length === 0 ? (
                    <EmptyState
                      title={filtering ? "No recipes match" : "No recipes yet"}
                      body="Dishes you create with a per-serving size show up here."
                    />
                  ) : (
                    <div className="stagger-children space-y-2">
                      {recipesFiltered.map((food) => (
                        <QuickRow
                          key={food.id}
                          title={food.name}
                          subtitle={foodSubtitle(food)}
                          description={food.description}
                          verified={food.isVerified}
                          busy={quickBusy === food.id}
                          onOpen={() => openLog(food.id, "search")}
                          onQuickLog={() => quickLog(food, 1)}
                          editHref={`/foods/${food.id}`}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="foods" className="pt-3">
                  {foodsFiltered === null ? (
                    <ListSkeleton rows={3} />
                  ) : foodsFiltered.length === 0 ? (
                    <EmptyState
                      title={filtering ? "No foods match" : "No foods created yet"}
                      body="Foods you add to the shared database appear here."
                      action={
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/foods/new">Create food</Link>
                        </Button>
                      }
                    />
                  ) : (
                    <div className="stagger-children space-y-2">
                      {foodsFiltered.map((food) => (
                        <QuickRow
                          key={food.id}
                          title={food.name}
                          subtitle={foodSubtitle(food)}
                          description={food.description}
                          verified={food.isVerified}
                          busy={quickBusy === food.id}
                          onOpen={() => openLog(food.id, "search")}
                          onQuickLog={() => quickLog(food, 1)}
                          editHref={`/foods/${food.id}`}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </div>

      {/* Multi-Add action bar */}
      {multiSelect && selected.size > 0 ? (
        <div
          className="fixed inset-x-0 z-40 mx-auto max-w-2xl px-4"
          style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <div className="glass flex items-center gap-3 rounded-2xl border p-2 pl-4 shadow-[var(--shadow-lift)]">
            <span className="flex-1 text-sm font-semibold tabular-nums">
              {selected.size} selected
            </span>
            <Button variant="ghost" size="sm" onClick={exitMultiSelect}>
              Cancel
            </Button>
            <Button size="sm" disabled={batchBusy} onClick={batchLog}>
              {batchBusy ? "Adding…" : `Add to ${mealName}`}
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function AddFoodPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <AddFoodView />
    </Suspense>
  );
}
