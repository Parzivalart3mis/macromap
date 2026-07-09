"use client";

import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Flame, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/async-states";
import { CalendarPopover } from "@/components/diary/calendar-popover";
import { DiaryDayContent } from "@/components/diary/day-content";
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
import { addDaysISO, formatDisplayDate, todayISO } from "@/lib/dates";
import { defaultMealForNow } from "@/lib/store-theme";
import { cn } from "@/lib/utils";
import type { DiaryPayloadDTO, StreakDTO } from "@/types/api";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const slideVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%" }),
  center: { x: 0 },
  exit: (dir: number) => ({ x: dir >= 0 ? "-100%" : "100%" }),
};

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
  const [newMealName, setNewMealName] = useState("");
  const [insights, setInsights] = useState<string[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const dateBtnRef = useRef<HTMLButtonElement>(null);
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

  function handleDragEnd(_e: unknown, info: PanInfo) {
    const dist = info.offset.x;
    const vel = info.velocity.x;
    const swipe = Math.abs(dist) * 0.6 + Math.abs(vel) * 0.2;
    if (swipe < 60) return;
    if (dist < 0 || vel < -300) goNext();
    else goPrev();
  }

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
          {streak ? (
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold",
                streak.todayLogged
                  ? "bg-cta/15 text-cta-foreground dark:text-cta"
                  : "bg-muted text-muted-foreground",
              )}
              title={
                streak.todayLogged
                  ? `Longest streak: ${streak.longest} days`
                  : "Log something today to keep the streak going"
              }
            >
              <Flame
                className={cn("size-4 text-cta", streak.todayLogged && "animate-flame")}
                fill={streak.todayLogged ? "currentColor" : "none"}
                aria-hidden
              />
              {streak.current}
            </span>
          ) : null}
        </div>
        <WeekStrip
          loggedDates={recentDates}
          selected={date}
          today={todayISO()}
          onSelect={goTo}
        />
      </header>

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
              drag={reduce ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={handleDragEnd}
              className="w-full"
              style={{ touchAction: "pan-y", willChange: "transform" }}
            >
              <DiaryDayContent
                date={date}
                payload={activePayload}
                onAnalyze={analyze}
                onAddMeal={() => setNewMealOpen(true)}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Floating quick-log button */}
      <Button
        size="icon-lg"
        aria-label="Log food"
        className="fixed right-4 z-40 size-14 [&_svg]:size-6"
        style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
        asChild
      >
        <Link href={`/diary/add?date=${date}&meal=${encodeURIComponent(defaultMealForNow())}`}>
          <Plus aria-hidden />
        </Link>
      </Button>

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
