"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useRef } from "react";

import { addDaysISO } from "@/lib/dates";
import type { DayProgressDTO } from "@/types/api";
import { cn } from "@/lib/utils";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function isoDayOfWeek(iso: string): number {
  return new Date(`${iso}T12:00:00`).getDay();
}

/** How a logged day went against its goal. */
export type DayOutcome = "under" | "onTarget" | "over";

export interface DayRing {
  /** Share of the goal eaten, clamped to 1 so the ring never overdraws. */
  fraction: number;
  outcome: DayOutcome;
}

/** Within this much of the goal counts as hitting it rather than undershooting. */
const ON_TARGET_BAND = 0.05;

/**
 * Scores a day for the strip. Returns null when there is nothing meaningful to
 * draw — no goal resolved for that day, or a goal of zero — in which case the
 * strip falls back to the plain logged/not-logged circle it has always shown.
 */
export function dayRing(calories: number, goal: number | null): DayRing | null {
  if (goal == null || goal <= 0) return null;
  const ratio = calories / goal;
  const outcome: DayOutcome =
    ratio > 1 ? "over" : ratio >= 1 - ON_TARGET_BAND ? "onTarget" : "under";
  return { fraction: Math.min(1, ratio), outcome };
}

/**
 * Scrollable day strip. A logged day draws a ring filled to its share of that
 * day's calorie goal — so a 400-calorie snack and a day you landed on target no
 * longer look identical, which is what the old binary tick could not say.
 * Days without a resolved goal keep the plain checked circle. The selection
 * pill glides between days (shared layoutId) and the strip auto-scrolls to keep
 * the active day centred.
 */
export function WeekStrip({
  loggedDates,
  progress = [],
  selected,
  today,
  onSelect,
}: {
  loggedDates: string[];
  /** Calories and goal per recent day; absent days fall back to the tick. */
  progress?: DayProgressDTO[];
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  const reduce = useReducedMotion();
  const logged = new Set(loggedDates);
  const byDate = new Map(progress.map((d) => [d.date, d]));
  const selectedRef = useRef<HTMLButtonElement>(null);

  // A wide window around today, extended if the selection roams past it.
  const start = min(addDaysISO(today, -35), selected);
  const end = max(addDaysISO(today, 35), selected);
  const days: string[] = [];
  for (let d = start; d <= end; d = addDaysISO(d, 1)) days.push(d);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: reduce ? "auto" : "smooth",
    });
  }, [selected, reduce]);

  return (
    <div
      className="app-chrome -mx-4 flex gap-1 overflow-x-auto px-4 pt-3 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ overscrollBehaviorX: "contain" }}
    >
      {days.map((date) => {
        const isLogged = logged.has(date);
        const isToday = date === today;
        const isSelected = date === selected;
        const day = byDate.get(date);
        const ring = isLogged && day ? dayRing(day.calories, day.goal) : null;
        return (
          <button
            key={date}
            ref={isSelected ? selectedRef : undefined}
            type="button"
            onClick={() => onSelect(date)}
            aria-label={
              ring
                ? `${date}, ${day!.calories} of ${day!.goal} calories, ${RING_LABEL[ring.outcome]}`
                : `${date}${isLogged ? ", logged" : ""}`
            }
            aria-current={isSelected ? "date" : undefined}
            className="relative flex min-h-11 min-w-11 shrink-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isSelected ? (
              <motion.span
                layoutId="week-pill"
                className="absolute inset-0 rounded-2xl bg-primary/12"
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 520, damping: 42, mass: 0.9 }
                }
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative text-[10px] font-semibold",
                isSelected ? "text-primary" : "text-muted-foreground",
              )}
            >
              {isToday ? "Today" : DAY_LETTERS[isoDayOfWeek(date)]}
            </span>
            {ring ? (
              <span className="relative flex size-9 items-center justify-center">
                <GoalRing ring={ring} animate={!reduce} />
                <span
                  className={cn(
                    "relative text-sm font-semibold tabular-nums",
                    ring.outcome === "over" ? "text-[var(--warning)]" : "text-primary",
                  )}
                >
                  {Number(date.slice(8, 10))}
                </span>
              </span>
            ) : (
              <span
                className={cn(
                  "relative flex size-9 items-center justify-center rounded-full border-2 transition-colors",
                  isLogged
                    ? "border-transparent bg-[image:var(--gradient-brand)] text-white shadow-[var(--shadow-glow)]"
                    : isToday
                      ? "border-dashed border-primary/60"
                      : "border-border",
                  isSelected && !isLogged && "border-primary",
                )}
              >
                {isLogged ? (
                  <Check className="size-4" strokeWidth={3} aria-hidden />
                ) : (
                  <span className="text-sm font-semibold tabular-nums">
                    {Number(date.slice(8, 10))}
                  </span>
                )}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const RING_LABEL: Record<DayOutcome, string> = {
  under: "under goal",
  onTarget: "on target",
  over: "over goal",
};

const RING_STROKE: Record<DayOutcome, string> = {
  under: "var(--primary)",
  onTarget: "var(--primary)",
  over: "var(--warning)",
};

const R = 15.5; // radius inside a 36px (size-9) box with a 2.5px stroke
const CIRCUMFERENCE = 2 * Math.PI * R;

/** The filled arc behind a day's date number. */
function GoalRing({ ring, animate }: { ring: DayRing; animate: boolean }) {
  return (
    <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
      <circle
        cx="18"
        cy="18"
        r={R}
        fill="none"
        stroke="var(--muted)"
        strokeWidth="2.5"
      />
      <motion.circle
        cx="18"
        cy="18"
        r={R}
        fill="none"
        stroke={RING_STROKE[ring.outcome]}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        initial={{ strokeDashoffset: animate ? CIRCUMFERENCE : CIRCUMFERENCE * (1 - ring.fraction) }}
        animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - ring.fraction) }}
        transition={animate ? { duration: 0.5, ease: "easeOut" } : { duration: 0 }}
      />
      {/* A day that went over gets a full faint track plus the warning arc, so
          "over" reads differently from "exactly on target" at a glance. */}
      {ring.outcome === "over" ? (
        <circle
          cx="18"
          cy="18"
          r={R}
          fill="none"
          stroke="var(--warning)"
          strokeOpacity={0.25}
          strokeWidth="2.5"
        />
      ) : null}
    </svg>
  );
}

function min(a: string, b: string): string {
  return a < b ? a : b;
}
function max(a: string, b: string): string {
  return a > b ? a : b;
}
