"use client";

import { Bookmark, Mic, MicOff, ScanBarcode, Search, Type } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { ListSkeleton, EmptyState } from "@/components/async-states";
import { BarcodeScanner, barcodeScanSupported } from "@/components/diary/barcode-scanner";
import { LogFoodDialog } from "@/components/diary/log-food-dialog";
import { VerifiedBadge } from "@/components/foods/verified-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceLogging } from "@/hooks/useVoiceLogging";
import { apiFetch } from "@/lib/client/fetcher";
import type { FoodDTO, NaturalLogSuggestionDTO, SavedMealDTO } from "@/types/api";

type LoggedVia = "search" | "barcode" | "voice" | "natural_language";

interface NaturalLogResponse {
  runId: string;
  suggestions: NaturalLogSuggestionDTO[];
}

function FoodRow({ food, onSelect }: { food: FoodDTO; onSelect: (food: FoodDTO) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(food)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{food.name}</span>
          {food.isVerified ? <VerifiedBadge /> : null}
        </span>
        <span className="text-xs text-muted-foreground">
          {food.brandName ? `${food.brandName} · ` : ""}
          {food.servingSizeValue} {food.servingSizeUnit}
        </span>
      </span>
      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
        {Math.round(food.calories)} kcal
      </span>
    </button>
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
          // No database match — create a shared food from the AI estimate
          // (per-serving = the whole line, so quantity becomes 1).
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
            loggedVia,
          }),
        });
        logged++;
      }
      if (logged > 0) {
        await apiFetch(`/api/foods/natural-log/${runId}`, { method: "PATCH" }).catch(
          () => undefined,
        );
        toast.success(`Logged ${logged} ${logged === 1 ? "item" : "items"}`);
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
      <p className="text-sm text-muted-foreground">
        Confirm what to log into {mealName}
      </p>
      <ul className="divide-y rounded-xl border">
        {suggestions.map((suggestion, index) => {
          const nutrition =
            suggestion.matchedFood ?? suggestion.estimatedNutrition ?? null;
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

export function AddFoodSheet({
  open,
  onOpenChange,
  date,
  mealName,
  onLogged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  mealName: string;
  onLogged: () => void;
}) {
  // --- Search tab ---
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodDTO[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Selection / logging ---
  const [selectedFood, setSelectedFood] = useState<FoodDTO | null>(null);
  const [selectedVia, setSelectedVia] = useState<LoggedVia>("search");
  const [logging, setLogging] = useState(false);

  // --- Barcode tab ---
  const [barcodeValue, setBarcodeValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [barcodeMiss, setBarcodeMiss] = useState<string | null>(null);

  // --- Voice + text tabs ---
  const voice = useVoiceLogging();
  const [freeText, setFreeText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [review, setReview] = useState<{
    runId: string;
    suggestions: NaturalLogSuggestionDTO[];
    via: LoggedVia;
  } | null>(null);

  // --- Saved meals tab ---
  const [savedMeals, setSavedMeals] = useState<SavedMealDTO[] | null>(null);
  const [savedBusy, setSavedBusy] = useState<string | null>(null);

  // Reset in the close handler (event, not effect) so reopening starts clean.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery("");
      setResults([]);
      setReview(null);
      setBarcodeValue("");
      setBarcodeMiss(null);
      setScanning(false);
      setFreeText("");
      voice.setTranscript("");
    }
    onOpenChange(next);
  }

  function runSearch(value: string) {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiFetch<{ foods: FoodDTO[] }>(
          `/api/foods/search?q=${encodeURIComponent(value.trim())}`,
        );
        setResults(data.foods);
      } catch {
        toast.error("Search failed");
      } finally {
        setSearching(false);
      }
    }, 250);
  }

  async function logSelected(quantity: number) {
    if (!selectedFood) return;
    setLogging(true);
    try {
      await apiFetch("/api/diary/entries", {
        method: "POST",
        body: JSON.stringify({
          date,
          mealName,
          foodId: selectedFood.id,
          quantity,
          servingMultiplier: 1,
          loggedVia: selectedVia,
        }),
      });
      toast.success(`Logged to ${mealName}`);
      setSelectedFood(null);
      onLogged();
      handleOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logging failed");
    } finally {
      setLogging(false);
    }
  }

  const lookupBarcode = useCallback(
    async (code: string) => {
      setScanning(false);
      setLookingUp(true);
      setBarcodeMiss(null);
      try {
        const result = await apiFetch<{ status: string; food: FoodDTO | null }>(
          "/api/foods/barcode/lookup",
          { method: "POST", body: JSON.stringify({ barcode: code }) },
        );
        if (result.food) {
          setSelectedVia("barcode");
          setSelectedFood(result.food);
        } else {
          setBarcodeMiss(code);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Lookup failed");
      } finally {
        setLookingUp(false);
      }
    },
    [],
  );

  async function parseText(text: string, via: LoggedVia) {
    if (text.trim().length < 3) {
      toast.error("Describe what you ate first");
      return;
    }
    setParsing(true);
    try {
      const data = await apiFetch<NaturalLogResponse>("/api/foods/natural-log", {
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

  async function loadSavedMeals() {
    try {
      const data = await apiFetch<{ savedMeals: SavedMealDTO[] }>("/api/saved-meals");
      setSavedMeals(data.savedMeals);
    } catch {
      toast.error("Could not load saved meals");
      setSavedMeals([]);
    }
  }

  async function logSavedMeal(savedMeal: SavedMealDTO) {
    setSavedBusy(savedMeal.id);
    try {
      await apiFetch(`/api/saved-meals/${savedMeal.id}/log`, {
        method: "POST",
        body: JSON.stringify({ date, mealName }),
      });
      toast.success(`Logged ${savedMeal.name}`);
      onLogged();
      handleOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logging failed");
    } finally {
      setSavedBusy(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="sheet-safe-bottom max-h-[92dvh] overflow-y-auto rounded-t-2xl"
      >
        <SheetHeader>
          <SheetTitle>Add to {mealName}</SheetTitle>
          <SheetDescription>Search, scan, speak, or type what you ate</SheetDescription>
        </SheetHeader>

        {review ? (
          <div className="px-4 pb-6">
            <SuggestionsReview
              suggestions={review.suggestions}
              runId={review.runId}
              date={date}
              mealName={mealName}
              loggedVia={review.via}
              onDone={() => {
                setReview(null);
                onLogged();
                handleOpenChange(false);
              }}
            />
            <Button
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => setReview(null)}
            >
              Back
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="search" className="px-4 pb-6">
            <TabsList className="w-full">
              <TabsTrigger value="search" aria-label="Search">
                <Search className="size-4" aria-hidden />
              </TabsTrigger>
              <TabsTrigger value="barcode" aria-label="Barcode">
                <ScanBarcode className="size-4" aria-hidden />
              </TabsTrigger>
              <TabsTrigger value="voice" aria-label="Voice">
                <Mic className="size-4" aria-hidden />
              </TabsTrigger>
              <TabsTrigger value="text" aria-label="Describe">
                <Type className="size-4" aria-hidden />
              </TabsTrigger>
              <TabsTrigger value="saved" aria-label="Saved meals">
                <Bookmark className="size-4" aria-hidden />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-2 pt-3">
              <Input
                placeholder="Search foods and store items"
                value={query}
                onChange={(event) => runSearch(event.target.value)}
                autoComplete="off"
              />
              {searching ? (
                <ListSkeleton rows={3} />
              ) : results.length > 0 ? (
                <div className="stagger-children divide-y rounded-xl border">
                  {results.map((food) => (
                    <FoodRow
                      key={food.id}
                      food={food}
                      onSelect={(f) => {
                        setSelectedVia("search");
                        setSelectedFood(f);
                      }}
                    />
                  ))}
                </div>
              ) : query.trim().length >= 2 ? (
                <EmptyState
                  title="No matches"
                  body="Try a different name, or add it to the shared database."
                  action={
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/foods/new">Create food</Link>
                    </Button>
                  }
                />
              ) : (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                  Search the shared database, verified store items, and your foods
                </p>
              )}
            </TabsContent>

            <TabsContent value="barcode" className="space-y-3 pt-3">
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
                      onChange={(event) =>
                        setBarcodeValue(event.target.value.replace(/\D/g, ""))
                      }
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
                  body="It is not in our database, Open Food Facts, or the commercial API."
                  action={
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/foods/new?barcode=${barcodeMiss}`}>Add it manually</Link>
                    </Button>
                  }
                />
              ) : null}
            </TabsContent>

            <TabsContent value="voice" className="space-y-3 pt-3">
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
                  {voice.error ? (
                    <p className="text-sm text-destructive">{voice.error}</p>
                  ) : null}
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
                  body="This browser does not support the Web Speech API. Use the describe tab instead."
                />
              )}
            </TabsContent>

            <TabsContent value="text" className="space-y-3 pt-3">
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
            </TabsContent>

            <TabsContent value="saved" className="pt-3">
              {savedMeals === null ? (
                <div className="py-2">
                  <Button variant="secondary" className="w-full" onClick={loadSavedMeals}>
                    Load saved meals
                  </Button>
                </div>
              ) : savedMeals.length === 0 ? (
                <EmptyState
                  title="No saved meals yet"
                  body="Log a meal, then use its menu to save it as a template."
                />
              ) : (
                <ul className="divide-y rounded-xl border">
                  {savedMeals.map((savedMeal) => (
                    <li
                      key={savedMeal.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {savedMeal.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {savedMeal.entriesSnapshotJson.length} items ·{" "}
                          {Math.round(
                            savedMeal.entriesSnapshotJson.reduce(
                              (sum, line) => sum + line.nutrition.calories,
                              0,
                            ),
                          )}{" "}
                          kcal
                        </span>
                      </span>
                      <Button
                        size="sm"
                        disabled={savedBusy === savedMeal.id}
                        onClick={() => logSavedMeal(savedMeal)}
                      >
                        {savedBusy === savedMeal.id ? "Logging..." : "Log"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        )}

        <LogFoodDialog
          food={selectedFood}
          open={selectedFood !== null}
          onOpenChange={(next) => {
            if (!next) setSelectedFood(null);
          }}
          onConfirm={logSelected}
          busy={logging}
        />
      </SheetContent>
    </Sheet>
  );
}
