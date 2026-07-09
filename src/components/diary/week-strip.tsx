"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useRef } from "react";

import { addDaysISO } from "@/lib/dates";
import { cn } from "@/lib/utils";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function isoDayOfWeek(iso: string): number {
  return new Date(`${iso}T12:00:00`).getDay();
}

/**
 * Scrollable day strip: a checked gradient circle for logged days, a dashed
 * ring for an unlogged today, the date number otherwise. The selection pill
 * glides between days (shared layoutId) and the strip auto-scrolls to keep the
 * active day centred.
 */
export function WeekStrip({
  loggedDates,
  selected,
  today,
  onSelect,
}: {
  loggedDates: string[];
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  const reduce = useReducedMotion();
  const logged = new Set(loggedDates);
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
        return (
          <button
            key={date}
            ref={isSelected ? selectedRef : undefined}
            type="button"
            onClick={() => onSelect(date)}
            aria-label={`${date}${isLogged ? ", logged" : ""}`}
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
          </button>
        );
      })}
    </div>
  );
}

function min(a: string, b: string): string {
  return a < b ? a : b;
}
function max(a: string, b: string): string {
  return a > b ? a : b;
}
