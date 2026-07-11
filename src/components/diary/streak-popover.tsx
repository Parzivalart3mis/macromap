"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";
import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

import { addDaysISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { StreakDTO } from "@/types/api";

const CARD_WIDTH = 240;
const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** Small stat card under the streak chip: current, longest, last-7-days dots. */
export function StreakPopover({
  streak,
  loggedDates,
  today,
  anchorRef,
  onClose,
}: {
  streak: StreakDTO;
  loggedDates: string[];
  today: string;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const logged = new Set(loggedDates);

  // Anchor under the chip, clamped to the viewport (right-aligned chip).
  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(12, Math.min(r.right - CARD_WIDTH, window.innerWidth - CARD_WIDTH - 12));
    setPos({ top: r.bottom + 8, left });
  }, [anchorRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The last 7 days, oldest first, ending today.
  const week = Array.from({ length: 7 }, (_, i) => addDaysISO(today, i - 6));

  return (
    <>
      <button
        type="button"
        aria-label="Close streak details"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-label="Logging streak"
        initial={reduce ? false : { opacity: 0, scale: 0.94, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }}
        style={{
          top: pos?.top ?? 72,
          left: pos?.left ?? 12,
          width: CARD_WIDTH,
          transformOrigin: "top right",
          visibility: pos ? "visible" : "hidden",
        }}
        className="glass fixed z-50 rounded-2xl border p-4 shadow-[var(--shadow-lift)]"
      >
        <div className="flex items-center gap-2">
          <Flame className="size-5 text-cta" fill="currentColor" aria-hidden />
          <span className="text-lg font-extrabold tabular-nums">
            {streak.current} day{streak.current === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {streak.todayLogged
            ? "Today is logged — keep it rolling"
            : "Log something today to keep the streak"}
        </p>
        <div className="mt-3 flex justify-between">
          {week.map((iso) => (
            <span key={iso} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "size-2.5 rounded-full",
                  logged.has(iso)
                    ? "bg-cta"
                    : iso === today
                      ? "border-2 border-cta"
                      : "bg-muted",
                )}
                aria-hidden
              />
              <span className="text-[9px] font-semibold text-muted-foreground">
                {WEEKDAY_LETTERS[new Date(`${iso}T12:00:00`).getDay()]}
              </span>
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Longest streak: <span className="font-semibold">{streak.longest} days</span>
        </p>
      </motion.div>
    </>
  );
}
