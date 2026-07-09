"use client";

import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  MapPin,
  Mic,
  MicOff,
  Pencil,
  PlusCircle,
  ScanBarcode,
  Search,
  Type,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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
import { todayISO } from "@/lib/dates";
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

type Mode = null | "barcode" | "voice" | "text";
type LoggedVia = "search" | "barcode" | "voice" | "natural_language";

interface RecentItem {
  food: FoodDTO;
  lastQuantity: number;
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
  const serving = `${food.servingSizeValue} ${food.servingSizeUnit}`;
  const base = food.brandName ? `${food.brandName}, ${serving}` : serving;
  const qty = quantity !== 1 ? ` × ${quantity}` : "";
  return `${base}${qty} · ${Math.round(food.calories * quantity)} cal`;
}

/** MFP-style row: tap the body for the serving picker, tap + to log instantly. */
function QuickRow({
  title,
  subtitle,
  description,
  verified,
  busy,
  onOpen,
  onQuickLog,
  editHref,
}: {
  title: string;
  subtitle: string;
  description?: string | null;
  verified?: boolean;
  busy: boolean;
  onOpen?: () => void;
  onQuickLog: () => void;
  editHref?: string;
}) {
  return (
    <div className="card-lift flex items-center gap-2 rounded-2xl border bg-card p-3 shadow-[var(--shadow-soft)]">
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="min-w-0 flex-1 text-left"
      >
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold">{title}</span>
          {verified ? <VerifiedBadge /> : null}
        </span>
        <span className="block truncate text-[13px] text-muted-foreground">
          {subtitle}
        </span>
        {description ? (
          <span className="block truncate text-[13px] text-muted-foreground/80 italic">
            {description}
          </span>
        ) : null}
      </button>
      {editHref ? (
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
        await apiFetch("/api/diary/entries", {
          method: "POST",
          body: JSON.stringify({
            date,
            mealName,
            foodId,
            quantity,
            servingMultiplier: 1,
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
  const [searching, setSearching] = useState(false);
  // Typing filters the tabs; the combined DB/web search runs only once the user
  // submits (keyboard search key / magnifier). `submitted` gates that view.
  const [submitted, setSubmitted] = useState(() => (searchParams.get("q") ?? "").trim().length >= 2);

  // Logging
  const [quickBusy, setQuickBusy] = useState<string | null>(null);

  // Tapping a food opens the full-page log screen (with the unit selector).
  // `servings` pre-fills the count (used by History to restore the last amount).
  function openLog(id: string, via: LoggedVia, servings?: number) {
    const p = new URLSearchParams({ foodId: id, date, meal: mealName, via });
    if (servings && servings > 0) p.set("servings", String(servings));
    router.push(`/diary/log?${p.toString()}`);
  }

  // Modes
  const [mode, setMode] = useState<Mode>(null);
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
  const [savedMeals, setSavedMeals] = useState<SavedMealDTO[] | null>(null);
  const [myFoods, setMyFoods] = useState<FoodDTO[] | null>(null);
  const [stores, setStores] = useState<StoreDTO[]>([]);

  useEffect(() => {
    apiFetch<{ recent: RecentItem[] }>("/api/diary/recent")
      .then((data) => setRecent(data.recent))
      .catch(() => setRecent([]));
    apiFetch<{ savedMeals: SavedMealDTO[] }>("/api/saved-meals")
      .then((data) => setSavedMeals(data.savedMeals))
      .catch(() => setSavedMeals([]));
    apiFetch<{ foods: FoodDTO[] }>("/api/foods/mine")
      .then((data) => setMyFoods(data.foods))
      .catch(() => setMyFoods([]));
    apiFetch<{ stores: StoreDTO[] }>("/api/stores")
      .then((data) => setStores(data.stores))
      .catch(() => undefined);
  }, []);

  // Keep search + meal in the URL so back-navigation restores this exact view.
  function syncUrl(nextQuery: string, nextMeal: string) {
    const params = new URLSearchParams();
    params.set("date", date);
    params.set("meal", nextMeal);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    router.replace(`/diary/add?${params.toString()}`, { scroll: false });
  }

  async function fetchResults(value: string) {
    setSearching(true);
    try {
      const data = await apiFetch<{
        foods: FoodDTO[];
        external: ExternalFoodResultDTO[];
      }>(`/api/foods/search?q=${encodeURIComponent(value.trim())}`);
      setResults(data.foods);
      setExternalResults(data.external ?? []);
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  }

  // Re-run a query restored from the URL on mount (returning from a food page).
  useEffect(() => {
    const restored = searchParams.get("q") ?? "";
    if (restored.trim().length >= 2) {
      fetchResults(restored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Typing only filters the tabs; leaving the query returns to the tab view.
  function runSearch(value: string) {
    setQuery(value);
    setSubmitted(false);
    syncUrl(value, mealName);
    if (value.trim().length < 2) {
      setResults([]);
      setExternalResults([]);
    }
  }

  // Pressing the keyboard search key / magnifier runs the combined DB+web search.
  function submitSearch() {
    if (query.trim().length < 2) return;
    setSubmitted(true);
    fetchResults(query);
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
        eatenTime: currentTimeIfToday(date),
        loggedVia: via,
      }),
    });
    toast.success(`Logged to ${mealName}`);
  }

  async function quickLog(food: FoodDTO, quantity: number) {
    setQuickBusy(food.id);
    try {
      await logFood(food, quantity, "search");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logging failed");
    } finally {
      setQuickBusy(null);
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
      label: "Barcode scan",
      icon: ScanBarcode,
      onClick: () => setMode(mode === "barcode" ? null : "barcode"),
    },
    {
      key: "voice" as const,
      label: "Voice log",
      icon: Mic,
      onClick: () => setMode(mode === "voice" ? null : "voice"),
    },
    {
      key: "text" as const,
      label: "Describe",
      icon: Type,
      onClick: () => setMode(mode === "text" ? null : "text"),
    },
  ];

  // While typing (before submit), the tabs stay and filter locally by the query.
  const q = query.trim().toLowerCase();
  const filtering = q.length > 0 && !submitted;
  const matchesQuery = (name: string) => !q || name.toLowerCase().includes(q);
  const recentFiltered = recent?.filter((item) => matchesQuery(item.food.name)) ?? null;
  const mealsFiltered = savedMeals?.filter((meal) => matchesQuery(meal.name)) ?? null;
  const recipesFiltered = myFoods?.filter((food) => food.isRecipe && matchesQuery(food.name)) ?? null;
  const foodsFiltered = myFoods?.filter((food) => !food.isRecipe && matchesQuery(food.name)) ?? null;

  const quickActionsRow = (
    <div className="grid grid-cols-4 gap-2">
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
        className="card-lift flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-1 py-3 text-xs font-semibold text-primary shadow-[var(--shadow-soft)]"
      >
        <PlusCircle className="size-5" aria-hidden />
        Quick add
      </Link>
    </div>
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
            className="h-12 rounded-full pl-10"
          />
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
                      href={`/stores/${matchedStore.slug}`}
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
                        <span className="block text-[15px] font-semibold">
                          {matchedStore.name} Menu
                        </span>
                        <span className="text-[13px] text-muted-foreground">
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
                    <div className="stagger-children space-y-2">
                      {results.map((food) => (
                        <QuickRow
                          key={food.id}
                          title={food.name}
                          subtitle={foodSubtitle(food)}
                          description={food.description}
                          verified={food.isVerified}
                          busy={quickBusy === food.id}
                          onOpen={() => openLog(food.id, "search")}
                          onQuickLog={() => quickLog(food, 1)}
                        />
                      ))}
                    </div>
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
                  <TabsTrigger value="history">History</TabsTrigger>
                  <TabsTrigger value="meals">My Meals</TabsTrigger>
                  <TabsTrigger value="recipes">My Recipes</TabsTrigger>
                  <TabsTrigger value="foods">My Foods</TabsTrigger>
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
                    <p className="mb-2 px-1 text-lg font-extrabold tracking-tight">
                      Recently logged
                    </p>
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
                      {recentFiltered.map(({ food, lastQuantity }) => (
                        <QuickRow
                          key={food.id}
                          title={food.name}
                          subtitle={foodSubtitle(food, lastQuantity)}
                          description={food.description}
                          verified={food.isVerified}
                          busy={quickBusy === food.id}
                          onOpen={() => openLog(food.id, "search", lastQuantity)}
                          onQuickLog={() => quickLog(food, lastQuantity)}
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
                          onQuickLog={() => logSavedMeal(savedMeal)}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="recipes" className="pt-3">
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
