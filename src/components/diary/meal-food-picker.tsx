"use client";

import {
  ArrowLeft,
  Check,
  Mic,
  MicOff,
  PlusCircle,
  ScanBarcode,
  Search,
  Type,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ListSkeleton } from "@/components/async-states";
import { BarcodeScanner, barcodeScanSupported } from "@/components/diary/barcode-scanner";
import { VerifiedBadge } from "@/components/foods/verified-badge";
import { Button } from "@/components/ui/button";
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
} from "@/types/api";

type Mode = null | "barcode" | "voice" | "text";

/** "Brand, serving size · N cal" for one serving of the food. */
function foodSubtitle(food: FoodDTO): string {
  const serving = `${food.servingSizeValue} ${food.servingSizeUnit}`;
  const base = food.brandName ? `${food.brandName}, ${serving}` : serving;
  return `${base} · ${Math.round(food.calories)} cal`;
}

/** Row whose whole body (and the + button) adds the food to the meal. */
function AddRow({
  title,
  subtitle,
  description,
  verified,
  onAdd,
}: {
  title: string;
  subtitle: string;
  description?: string | null;
  verified?: boolean;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="card-lift flex w-full items-center gap-2 rounded-2xl border bg-card p-3 text-left shadow-[var(--shadow-soft)]"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold">{title}</span>
          {verified ? <VerifiedBadge /> : null}
        </span>
        <span className="block truncate text-[13px] text-muted-foreground">{subtitle}</span>
        {description ? (
          <span className="block truncate text-[13px] text-muted-foreground/80 italic">
            {description}
          </span>
        ) : null}
      </span>
      <PlusCircle className="size-5 shrink-0 text-primary" aria-hidden />
    </button>
  );
}

/**
 * Full-screen food picker for the Create-a-Meal builder. Mirrors the diary
 * Add Food screen (search, History / My Recipes / My Foods, barcode, voice,
 * describe) but every action calls `onAdd(food, quantity)` to append the food
 * to the meal in progress instead of logging it. Rendered as an overlay so the
 * builder's own state (name, items, directions) is never lost.
 */
export function MealFoodPicker({
  onAdd,
  onClose,
}: {
  onAdd: (food: FoodDTO, quantity?: number) => void;
  onClose: () => void;
}) {
  // Search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodDTO[]>([]);
  const [externalResults, setExternalResults] = useState<ExternalFoodResultDTO[]>([]);
  const [importingIndex, setImportingIndex] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tabs data (My Foods = created non-recipes, My Recipes = created recipes)
  const [recent, setRecent] = useState<FoodDTO[] | null>(null);
  const [myFoods, setMyFoods] = useState<FoodDTO[] | null>(null);

  // Modes
  const [mode, setMode] = useState<Mode>(null);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [barcodeMiss, setBarcodeMiss] = useState<string | null>(null);
  const voice = useVoiceLogging();
  const [freeText, setFreeText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [review, setReview] = useState<NaturalLogSuggestionDTO[] | null>(null);

  useEffect(() => {
    apiFetch<{ recent: { food: FoodDTO }[] }>("/api/diary/recent")
      .then((data) => setRecent(data.recent.map((item) => item.food)))
      .catch(() => setRecent([]));
    apiFetch<{ foods: FoodDTO[] }>("/api/foods/mine")
      .then((data) => setMyFoods(data.foods))
      .catch(() => setMyFoods([]));
  }, []);

  function added(food: FoodDTO, quantity = 1) {
    onAdd(food, quantity);
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

  function runSearch(value: string) {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setResults([]);
      setExternalResults([]);
      return;
    }
    searchTimer.current = setTimeout(() => fetchResults(value), 250);
  }

  async function importExternal(result: ExternalFoodResultDTO, index: number) {
    setImportingIndex(index);
    try {
      const { food } = await apiFetch<{ food: FoodDTO }>("/api/foods/import", {
        method: "POST",
        body: JSON.stringify(result),
      });
      added(food);
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
        added(result.food);
        setBarcodeValue("");
      } else {
        setBarcodeMiss(code);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lookup failed");
    } finally {
      setLookingUp(false);
    }
  }

  async function parseText(text: string) {
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
        // date/meal are required by the endpoint but unused: we review the
        // parsed foods and add them to the meal rather than logging them.
        body: JSON.stringify({ date: todayISO(), mealName: "Snacks", text: text.trim() }),
      });
      if (data.suggestions.length === 0) {
        toast.error("Could not find any foods in that description");
      } else {
        setReview(data.suggestions);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Parsing failed");
    } finally {
      setParsing(false);
    }
  }

  const recipes = myFoods?.filter((food) => food.isRecipe) ?? null;
  const plainFoods = myFoods?.filter((food) => !food.isRecipe) ?? null;
  const searchActive = query.trim().length >= 2;

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
                onClick={() => parseText(voice.transcript)}
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
            placeholder='Try "2 eggs and a slice of toast"'
            value={freeText}
            onChange={(event) => setFreeText(event.target.value)}
            rows={3}
          />
          <Button
            className="w-full"
            disabled={parsing || freeText.trim().length < 3}
            onClick={() => parseText(freeText)}
          >
            {parsing ? "Parsing..." : "Parse and review"}
          </Button>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="top-header app-chrome glass sticky top-0 z-30 border-b border-border/60 px-4 pb-3">
        <div className="flex items-center gap-2 pt-2">
          <Button variant="ghost" size="icon-sm" aria-label="Back to meal" onClick={onClose}>
            <ArrowLeft aria-hidden />
          </Button>
          <h2 className="flex-1 text-center text-lg font-bold">Add Food</h2>
          <Button variant="ghost" size="sm" className="font-bold text-primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-24">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            placeholder="Search foods, brands, flavors..."
            value={query}
            onChange={(event) => runSearch(event.target.value)}
            autoComplete="off"
            className="h-12 rounded-full pl-10"
          />
        </div>

        {review ? (
          <MealSuggestionsReview
            suggestions={review}
            onAddAll={(picked) => {
              setReview(null);
              setMode(null);
              setFreeText("");
              voice.setTranscript("");
              picked.forEach(({ food, quantity }) => added(food, quantity));
            }}
            onCancel={() => setReview(null)}
          />
        ) : searchActive ? (
          searching ? (
            <ListSkeleton rows={4} />
          ) : (
            <div className="space-y-4">
              {results.length > 0 ? (
                <div className="stagger-children space-y-2">
                  {results.map((food) => (
                    <AddRow
                      key={food.id}
                      title={food.name}
                      subtitle={foodSubtitle(food)}
                      description={food.description}
                      verified={food.isVerified}
                      onAdd={() => added(food)}
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
                      <AddRow
                        key={`${result.source}-${result.barcode ?? index}`}
                        title={result.name}
                        subtitle={`${result.brandName ? `${result.brandName}, ` : ""}${result.servingSizeValue} ${result.servingSizeUnit} · ${Math.round(result.calories)} cal · ${result.source === "usda" ? "USDA" : "Open Food Facts"}`}
                        onAdd={() =>
                          importingIndex === null ? importExternal(result, index) : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {results.length === 0 && externalResults.length === 0 ? (
                <EmptyState title="No matches" body="Try a different name." />
              ) : null}
            </div>
          )
        ) : (
          <Tabs defaultValue="history">
            <TabsList className="w-full">
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="recipes">My Recipes</TabsTrigger>
              <TabsTrigger value="foods">My Foods</TabsTrigger>
            </TabsList>

            <div className="pt-3">{quickActionsRow}</div>
            {modePanels}

            <TabsContent value="history" className="pt-3">
              <p className="mb-2 px-1 text-lg font-extrabold tracking-tight">Recently logged</p>
              {recent === null ? (
                <ListSkeleton rows={4} />
              ) : recent.length === 0 ? (
                <EmptyState
                  title="Nothing logged yet"
                  body="Foods you log will show up here for quick adding."
                />
              ) : (
                <div className="stagger-children space-y-2">
                  {recent.map((food) => (
                    <AddRow
                      key={food.id}
                      title={food.name}
                      subtitle={foodSubtitle(food)}
                      description={food.description}
                      verified={food.isVerified}
                      onAdd={() => added(food)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="recipes" className="pt-3">
              {recipes === null ? (
                <ListSkeleton rows={3} />
              ) : recipes.length === 0 ? (
                <EmptyState title="No recipes yet" body="Recipes you create appear here." />
              ) : (
                <div className="stagger-children space-y-2">
                  {recipes.map((food) => (
                    <AddRow
                      key={food.id}
                      title={food.name}
                      subtitle={foodSubtitle(food)}
                      description={food.description}
                      verified={food.isVerified}
                      onAdd={() => added(food)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="foods" className="pt-3">
              {plainFoods === null ? (
                <ListSkeleton rows={3} />
              ) : plainFoods.length === 0 ? (
                <EmptyState title="No foods created yet" body="Foods you add appear here." />
              ) : (
                <div className="stagger-children space-y-2">
                  {plainFoods.map((food) => (
                    <AddRow
                      key={food.id}
                      title={food.name}
                      subtitle={foodSubtitle(food)}
                      description={food.description}
                      verified={food.isVerified}
                      onAdd={() => added(food)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

/** Review of parsed voice/describe items; adds picked ones to the meal. */
function MealSuggestionsReview({
  suggestions,
  onAddAll,
  onCancel,
}: {
  suggestions: NaturalLogSuggestionDTO[];
  onAddAll: (picked: { food: FoodDTO; quantity: number }[]) => void;
  onCancel: () => void;
}) {
  const [included, setIncluded] = useState<boolean[]>(suggestions.map(() => true));
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      const picked: { food: FoodDTO; quantity: number }[] = [];
      for (let i = 0; i < suggestions.length; i++) {
        if (!included[i]) continue;
        const suggestion = suggestions[i];
        if (suggestion.matchedFood) {
          picked.push({ food: suggestion.matchedFood, quantity: suggestion.quantity });
        } else if (suggestion.estimatedNutrition) {
          // AI estimate with no DB match: create it as a food, then add it.
          const created = await apiFetch<{ status: string; foodId: string }>("/api/foods", {
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
          });
          const { food } = await apiFetch<{ food: FoodDTO }>(`/api/foods/${created.foodId}`);
          picked.push({ food, quantity: 1 });
        }
      }
      onAddAll(picked);
      if (picked.length > 0) {
        toast.success(`Added ${picked.length} ${picked.length === 1 ? "item" : "items"}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add items");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Confirm what to add to the meal</p>
      <ul className="divide-y rounded-2xl border bg-card">
        {suggestions.map((suggestion, index) => {
          const nutrition = suggestion.matchedFood ?? suggestion.estimatedNutrition ?? null;
          return (
            <li key={index} className="flex items-center gap-3 px-3 py-2.5">
              <input
                id={`meal-suggestion-${index}`}
                type="checkbox"
                className="size-5 accent-[var(--primary)]"
                checked={included[index]}
                onChange={(event) =>
                  setIncluded((prev) =>
                    prev.map((value, i) => (i === index ? event.target.checked : value)),
                  )
                }
              />
              <label htmlFor={`meal-suggestion-${index}`} className="min-w-0 flex-1">
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
      <Button className="w-full" disabled={busy || included.every((i) => !i)} onClick={confirm}>
        <Check data-icon="inline-start" aria-hidden />
        {busy ? "Adding..." : "Add selected"}
      </Button>
      <Button variant="ghost" className="w-full" onClick={onCancel}>
        Back
      </Button>
    </div>
  );
}
