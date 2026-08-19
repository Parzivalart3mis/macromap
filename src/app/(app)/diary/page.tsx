"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Flame } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/async-states";
import { CalendarPopover } from "@/components/diary/calendar-popover";
import { DiaryDayContent } from "@/components/diary/day-content";
import { QuickLogFab } from "@/components/diary/quick-log-fab";
import { StreakPopover } from "@/components/diary/streak-popover";
import { WeekStrip } from "@/components/diary/week-strip";
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
import { haptic } from "@/lib/client/haptics";
import { addDaysISO, formatDisplayDate, todayISO } from "@/lib/dates";
import { defaultMealForNow } from "@/lib/store-theme";
import { cn } from "@/lib/utils";
import type { DiaryPayloadDTO, StreakDTO } from "@/types/api";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// One-time celebration thresholds; the highest reached is kept in localStorage.
const STREAK_MILESTONES = [7, 30, 100, 365];
const MILESTONE_KEY = "mm-streak-milestone";

const slideVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%" }),
  center: { x: 0 },
  exit: (dir: number) => ({ x: dir >= 0 ? "-100%" : "100%" }),
};

/** Copy every logged item from another day into the current day. */
function CopyDayDialog({
  open,
  onOpenChange,
  targetDate,
  onCopied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetDate: string;
  onCopied: () => void;
}) {
  const [sourceDate, setSourceDate] = useState(() => addDaysISO(targetDate, -1));
  const [busy, setBusy] = useState(false);

  async function copy() {
    if (sourceDate === targetDate) {
      toast.error("Pick a different day");
      return;
    }
    setBusy(true);
    try {
      const payload = await apiFetch<DiaryPayloadDTO>(`/api/diary?date=${sourceDate}`);
      const entries = payload.meals.flatMap((meal) =>
        meal.entries.map((entry) => {
          const snap = entry.nutritionSnapshotJson;
          const common = {
            date: targetDate,
            mealName: meal.mealName,
            eatenTime: entry.eatenTime ?? undefined,
          };
          if (entry.foodId) {
            return {
              ...common,
              foodId: entry.foodId,
              quantity: entry.quantity,
              servingMultiplier: entry.servingMultiplier,
              servingText: snap.serving,
              loggedVia: "saved_meal",
            };
          }
          if (entry.customStoreOrderId) {
            return {
              ...common,
              customStoreOrderId: entry.customStoreOrderId,
              quantity: entry.quantity,
              servingMultiplier: entry.servingMultiplier,
              servingText: snap.serving,
              loggedVia: "saved_meal",
            };
          }
          return {
            ...common,
            quickAdd: {
              label: snap.label,
              calories: snap.calories,
              proteinG: snap.proteinG,
              carbsG: snap.carbsG,
              fatG: snap.fatG,
            },
            quantity: 1,
            servingMultiplier: 1,
            loggedVia: "quick_add",
          };
        }),
      );
      if (entries.length === 0) {
        toast.error(`Nothing logged on ${formatDisplayDate(sourceDate)}`);
        return;
      }
      // The batch endpoint caps at 50 entries per request.
      for (let i = 0; i < entries.length; i += 50) {
        await apiFetch("/api/diary/entries/batch", {
          method: "POST",
          body: JSON.stringify({ entries: entries.slice(i, i + 50) }),
        });
      }
      haptic("success");
      toast.success(
        `Copied ${entries.length} ${entries.length === 1 ? "item" : "items"} from ${formatDisplayDate(sourceDate)}`,
      );
      onOpenChange(false);
      onCopied();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copy failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy a day</DialogTitle>
          <DialogDescription>
            Copy every item from another day into {formatDisplayDate(targetDate)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label htmlFor="copy-source-date" className="text-sm font-medium">
            Copy from
          </label>
          <Input
            id="copy-source-date"
            type="date"
            value={sourceDate}
            max={todayISO()}
            onChange={(event) => setSourceDate(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["Yesterday", addDaysISO(targetDate, -1)],
              ["1 week ago", addDaysISO(targetDate, -7)],
            ] as const
          ).map(([label, day]) => (
            <Button
              key={label}
              variant="outline"
              size="xs"
              onClick={() => setSourceDate(day)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Button disabled={busy} onClick={copy}>
          {busy ? "Copying…" : "Copy items"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function DiaryHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduce = useReducedMotion();

  const paramDate = searchParams.get("date");
  const [{ date, direction }, setNav] = useState(() => ({
    date: paramDate && DATE_RE.test(paramDate) ? paramDate : todayISO(),
    direction: 0,
  }));

  // Per-day payloads so the outgoing and incoming pages can both show real
  // content during a slide. Neighbours are prefetched for instant swipes.
  const [cache, setCache] = useState<Record<string, DiaryPayloadDTO>>({});
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState<StreakDTO | null>(null);
  const [recentDates, setRecentDates] = useState<string[]>([]);
  const [newMealOpen, setNewMealOpen] = useState(false);
  const [copyDayOpen, setCopyDayOpen] = useState(false);
  const [newMealName, setNewMealName] = useState("");
  const [insights, setInsights] = useState<string[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const dateBtnRef = useRef<HTMLButtonElement>(null);
  const streakBtnRef = useRef<HTMLButtonElement>(null);
  const loadingRef = useRef<Set<string>>(new Set());
  const dateRef = useRef(date);
  useEffect(() => {
    dateRef.current = date;
  }, [date]);

  const fetchDay = useCallback(async (target: string, force = false) => {
    if (!force && loadingRef.current.has(target)) return;
    loadingRef.current.add(target);
    try {
      const data = await apiFetch<DiaryPayloadDTO>(`/api/diary?date=${target}`);
      setCache((prev) => ({ ...prev, [target]: data }));
      if (target === dateRef.current) setError(null);
    } catch (err) {
      loadingRef.current.delete(target);
      if (target === dateRef.current) {
        setError(err instanceof Error ? err.message : "Could not load the diary");
      }
    }
  }, []);

  const loadStreak = useCallback(() => {
    apiFetch<{ streak: StreakDTO; recentDates: string[] }>(
      `/api/progress/streak?today=${todayISO()}`,
    )
      .then((data) => {
        setStreak(data.streak);
        setRecentDates(data.recentDates);
        // Celebrate 7/30/100/365-day milestones once each, on the day reached.
        if (data.streak.todayLogged) {
          const reached = STREAK_MILESTONES.filter((m) => data.streak.current >= m).pop();
          const seen = Number(window.localStorage.getItem(MILESTONE_KEY) ?? 0);
          if (reached && reached > seen) {
            window.localStorage.setItem(MILESTONE_KEY, String(reached));
            toast.success(`${reached}-day logging streak! 🔥`);
          }
        }
      })
      .catch(() => undefined);
  }, []);

  // Load the active day + prefetch neighbours whenever the day changes.
  useEffect(() => {
    fetchDay(date);
    fetchDay(addDaysISO(date, 1));
    fetchDay(addDaysISO(date, -1));
  }, [date, fetchDay]);

  // Streak once; whenever the diary becomes visible again (returning from the
  // log/add pages, or foregrounding the PWA), refresh the streak and active day.
  // iOS standalone PWAs fire `visibilitychange`/`pageshow` reliably but often
  // not `focus`, so we listen to all three.
  useEffect(() => {
    loadStreak();
    const refresh = () => {
      loadStreak();
      fetchDay(dateRef.current, true);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchDay, loadStreak]);

  const goTo = useCallback(
    (next: string) => {
      // Event-handler ref write (not render) so rapid taps chain off the
      // latest target rather than a stale render value.
      dateRef.current = next;
      setNav((prev) => ({
        date: next,
        direction: next > prev.date ? 1 : next < prev.date ? -1 : prev.direction,
      }));
      router.replace(next === todayISO() ? "/diary" : `/diary?date=${next}`, {
        scroll: false,
      });
    },
    [router],
  );
  const goPrev = useCallback(() => goTo(addDaysISO(dateRef.current, -1)), [goTo]);
  const goNext = useCallback(() => goTo(addDaysISO(dateRef.current, 1)), [goTo]);

  async function addCustomMeal() {
    const name = newMealName.trim();
    if (!name) return;
    try {
      await apiFetch("/api/diary/meals", {
        method: "POST",
        body: JSON.stringify({ date, mealName: name }),
      });
      setNewMealOpen(false);
      setNewMealName("");
      fetchDay(date, true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add meal");
    }
  }

  async function analyze() {
    setAnalyzing(true);
    try {
      const data = await apiFetch<{ insights: string[] }>("/api/diary/analyze", {
        method: "POST",
        body: JSON.stringify({ date }),
      });
      setInsights(data.insights);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  // "Complete diary": mark the day done, generate + save its analysis, and show
  // it. Idempotent — also used for "Re-analyze".
  async function completeDay() {
    setAnalyzing(true);
    try {
      const data = await apiFetch<{ insights: string[] }>("/api/diary/complete", {
        method: "POST",
        body: JSON.stringify({ date }),
      });
      setInsights(data.insights);
      haptic("success");
      fetchDay(dateRef.current, true);
    } catch (err) {
      setInsights(null);
      toast.error(err instanceof Error ? err.message : "Could not complete the day");
    } finally {
      // Always clear the loading state so the dialog flips from "Analyzing…" to
      // the insights (or closes on error).
      setAnalyzing(false);
    }
  }

  async function uncompleteDay() {
    try {
      await apiFetch(`/api/diary/complete?date=${date}`, { method: "DELETE" });
      toast.success("Marked incomplete");
      fetchDay(dateRef.current, true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    }
  }

  const activePayload = cache[date] ?? null;

  return (
    <main>
      <header className="top-header app-chrome glass sticky top-0 z-30 border-b border-border/60 px-4 pb-1.5">
        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon-sm" aria-label="Previous day" onClick={goPrev}>
              <ChevronLeft aria-hidden />
            </Button>
            <button
              ref={dateBtnRef}
              type="button"
              aria-label="Pick a date"
              aria-expanded={calendarOpen}
              className="flex items-center gap-1 rounded-xl text-xl font-extrabold tracking-tight"
              onClick={() => setCalendarOpen((open) => !open)}
            >
              {formatDisplayDate(date)}
              {calendarOpen ? (
                <ChevronUp className="size-4 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
              )}
            </button>
            <Button variant="ghost" size="icon-sm" aria-label="Next day" onClick={goNext}>
              <ChevronRight aria-hidden />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copy from another day"
              onClick={() => setCopyDayOpen(true)}
            >
              <Copy aria-hidden />
            </Button>
            {streak ? (
              <button
                ref={streakBtnRef}
                type="button"
                aria-label="Streak details"
                onClick={() => setStreakOpen(true)}
                className={cn(
                  "flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold",
                  streak.todayLogged
                    ? "bg-cta/15 text-cta-foreground dark:text-cta"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Flame
                  className={cn("size-4 text-cta", streak.todayLogged && "animate-flame")}
                  fill={streak.todayLogged ? "currentColor" : "none"}
                  aria-hidden
                />
                {streak.current}
              </button>
            ) : null}
          </div>
        </div>
        <WeekStrip
          loggedDates={recentDates}
          selected={date}
          today={todayISO()}
          onSelect={goTo}
        />
      </header>

      {streakOpen && streak ? (
        <StreakPopover
          streak={streak}
          loggedDates={recentDates}
          today={todayISO()}
          anchorRef={streakBtnRef}
          onClose={() => setStreakOpen(false)}
        />
      ) : null}

      {calendarOpen ? (
        <CalendarPopover
          selected={date}
          today={todayISO()}
          loggedDates={recentDates}
          anchorRef={dateBtnRef}
          onSelect={(next) => {
            goTo(next);
            setCalendarOpen(false);
          }}
          onClose={() => setCalendarOpen(false)}
        />
      ) : null}

      {error && !activePayload ? (
        <ErrorState message={error} onRetry={() => fetchDay(date, true)} />
      ) : (
        // overflow-x-clip hides the off-screen pages without clipping the tall
        // vertical content or forcing a nested scroll container.
        <div
          className="relative overflow-x-clip"
          style={{ overscrollBehaviorX: "contain" }}
        >
          <AnimatePresence custom={direction} initial={false} mode="popLayout">
            <motion.div
              key={date}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 520, damping: 42, mass: 0.9 }
              }
              className="w-full"
              style={{ willChange: "transform" }}
            >
              <DiaryDayContent
                date={date}
                payload={activePayload}
                onAnalyze={analyze}
                onAddMeal={() => setNewMealOpen(true)}
                onGoalChanged={() => fetchDay(date, true)}
                onChanged={() => fetchDay(date, true)}
                onComplete={completeDay}
                onUncomplete={uncompleteDay}
                onViewAnalysis={() => {
                  if (activePayload?.analysis) setInsights(activePayload.analysis);
                }}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Floating quick-log button with a fan-out of logging modes */}
      <QuickLogFab date={date} meal={defaultMealForNow()} />

      <CopyDayDialog
        key={date}
        open={copyDayOpen}
        onOpenChange={setCopyDayOpen}
        targetDate={date}
        onCopied={() => fetchDay(date, true)}
      />

      <Dialog open={newMealOpen} onOpenChange={setNewMealOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New meal bucket</DialogTitle>
            <DialogDescription>
              Add a custom meal like Pre-workout or Late snack for this day
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Meal name"
            value={newMealName}
            maxLength={40}
            onChange={(event) => setNewMealName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addCustomMeal();
            }}
          />
          <Button onClick={addCustomMeal} disabled={!newMealName.trim()}>
            Add meal
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={insights !== null || analyzing}
        onOpenChange={(open) => {
          if (!open) {
            setInsights(null);
            setAnalyzing(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Day analysis</DialogTitle>
            <DialogDescription>{formatDisplayDate(date)}</DialogDescription>
          </DialogHeader>
          {analyzing ? (
            <p className="py-4 text-sm text-muted-foreground">Analyzing your day...</p>
          ) : (
            <ul className="space-y-2 py-2">
              {insights?.map((insight, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <span className="text-primary" aria-hidden>
                    •
                  </span>
                  {insight}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function DiaryPage() {
  return (
    <Suspense fallback={null}>
      <DiaryHome />
    </Suspense>
  );
}
