"use client";

import { addMonths, format, getDay, getDaysInMonth, parseISO, subMonths } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CARD_WIDTH = 300;

/**
 * Compact, app-styled month calendar anchored under a trigger (the diary date
 * header). Custom-built because the OS `<input type="date">` picker can't be
 * positioned or sized. All dates stay on the user's local calendar (no UTC
 * drift): "yyyy-MM-dd" strings in, `format(...)` strings out.
 */
export function CalendarPopover({
  selected,
  today,
  loggedDates,
  anchorRef,
  onSelect,
  onClose,
}: {
  selected: string;
  today: string;
  loggedDates: string[];
  anchorRef: RefObject<HTMLElement | null>;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [view, setView] = useState(() => parseISO(selected));
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const logged = new Set(loggedDates);

  // Anchor under the trigger, clamped to the viewport.
  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(12, Math.min(r.left, window.innerWidth - CARD_WIDTH - 12));
    setPos({ top: r.bottom + 8, left });
  }, [anchorRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const firstOfMonth = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = getDay(firstOfMonth); // 0 = Sun
  const daysInMonth = getDaysInMonth(view);
  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(format(new Date(view.getFullYear(), view.getMonth(), d), "yyyy-MM-dd"));
  }

  return (
    <>
      {/* Backdrop catches outside taps */}
      <button
        type="button"
        aria-label="Close calendar"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-label="Pick a date"
        initial={reduce ? false : { opacity: 0, scale: 0.94, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }}
        style={{
          top: pos?.top ?? 72,
          left: pos?.left ?? 12,
          width: CARD_WIDTH,
          transformOrigin: "top left",
          visibility: pos ? "visible" : "hidden",
        }}
        className="glass fixed z-50 rounded-2xl border p-3 shadow-[var(--shadow-lift)]"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-base font-bold tracking-tight">{format(view, "MMMM yyyy")}</span>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous month"
              onClick={() => setView((v) => subMonths(v, 1))}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next month"
              onClick={() => setView((v) => addMonths(v, 1))}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((w) => (
            <span
              key={w}
              className="pb-1 text-center text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {w}
            </span>
          ))}
          {cells.map((iso, i) =>
            iso === null ? (
              <span key={`e${i}`} />
            ) : (
              <button
                key={iso}
                type="button"
                onClick={() => onSelect(iso)}
                aria-current={iso === selected ? "date" : undefined}
                className={cn(
                  "relative mx-auto flex size-9 items-center justify-center rounded-full text-sm tabular-nums transition-colors",
                  iso === today
                    ? "bg-primary font-bold text-primary-foreground"
                    : iso === selected
                      ? "border-2 border-primary font-semibold text-primary"
                      : "hover:bg-muted",
                )}
              >
                {Number(iso.slice(8, 10))}
                {logged.has(iso) && iso !== today ? (
                  <span
                    aria-hidden
                    className="absolute bottom-1 size-1 rounded-full bg-primary"
                  />
                ) : null}
              </button>
            ),
          )}
        </div>
      </motion.div>
    </>
  );
}
