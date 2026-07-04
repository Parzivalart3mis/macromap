"use client";

import { Check } from "lucide-react";

import { addDaysISO } from "@/lib/dates";
import { cn } from "@/lib/utils";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * MyFitnessPal-style streak strip: the current week with a checked circle for
 * every day that has diary entries, a dashed circle for an unlogged today,
 * and tap-to-jump date switching.
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
  const logged = new Set(loggedDates);
  // Week containing today, starting Sunday (matches the reference design).
  const todayDow = new Date(`${today}T12:00:00`).getDay();
  const weekStart = addDaysISO(today, -todayDow);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));

  return (
    <div className="app-chrome flex items-start justify-between px-4 pt-3 pb-1">
      {days.map((date, index) => {
        const isLogged = logged.has(date);
        const isToday = date === today;
        const isSelected = date === selected;
        return (
          <button
            key={date}
            type="button"
            onClick={() => onSelect(date)}
            aria-label={`${date}${isLogged ? ", logged" : ""}`}
            aria-current={isSelected ? "date" : undefined}
            className="flex min-w-10 flex-col items-center gap-1.5 rounded-xl py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={cn(
                "text-xs font-semibold",
                isSelected ? "text-primary" : "text-muted-foreground",
              )}
            >
              {DAY_LETTERS[index]}
              {isToday ? (
                <span className="mx-auto block size-1 rounded-full bg-primary" aria-hidden />
              ) : null}
            </span>
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-full border-2 transition-all duration-300 [transition-timing-function:var(--ease-spring)]",
                isLogged
                  ? "border-transparent bg-[image:var(--gradient-brand)] text-white shadow-[var(--shadow-glow)]"
                  : isToday
                    ? "border-dashed border-primary/60"
                    : "border-border",
                isSelected && !isLogged && "border-primary",
                isSelected && "scale-110",
              )}
            >
              {isLogged ? <Check className="size-4" strokeWidth={3} aria-hidden /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
