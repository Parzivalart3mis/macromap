"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import type { GoalPhaseDTO } from "@/types/api";

export const PHASES: Array<{ value: GoalPhaseDTO; label: string; hint: string }> = [
  { value: "cut", label: "Cut", hint: "Calorie deficit — losing fat" },
  { value: "lean_bulk", label: "Lean Bulk", hint: "Small surplus — gaining slowly" },
  { value: "recomp", label: "Recomp", hint: "Maintenance on lifting days, deficit otherwise" },
  { value: "maintenance", label: "Maintenance", hint: "Holding weight" },
];

export function phaseLabel(phase: GoalPhaseDTO): string {
  return PHASES.find((p) => p.value === phase)?.label ?? phase;
}

/**
 * Four-way switch between a plan's weekly tables. The highlight is a single
 * shared element that slides between options (one `layoutId`), so the active
 * phase reads as moving rather than blinking.
 *
 * A phase with no table behind it stays selectable but is marked "not set up" —
 * the editor needs to let you open an empty phase in order to fill it, while
 * the API refuses to make it the active one.
 */
export function PhaseSwitcher({
  value,
  onChange,
  configured,
  disabled = false,
  idPrefix = "phase",
}: {
  value: GoalPhaseDTO;
  onChange: (phase: GoalPhaseDTO) => void;
  /** Phases that have all 7 days filled in. */
  configured: ReadonlySet<GoalPhaseDTO>;
  disabled?: boolean;
  /** Keeps the sliding highlight distinct when two switchers are mounted. */
  idPrefix?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      role="tablist"
      aria-label="Goal phase"
      className="grid grid-cols-4 gap-1 rounded-2xl bg-muted/60 p-1"
    >
      {PHASES.map((phase) => {
        const active = phase.value === value;
        const isSet = configured.has(phase.value);
        return (
          <button
            key={phase.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${phase.label}${isSet ? "" : " (not set up)"} — ${phase.hint}`}
            title={phase.hint}
            disabled={disabled}
            onClick={() => onChange(phase.value)}
            className={cn(
              "relative flex min-h-11 flex-col items-center justify-center rounded-xl px-1 py-1.5 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId={`${idPrefix}-pill`}
                className="absolute inset-0 rounded-xl bg-[image:var(--gradient-brand)] shadow-[var(--shadow-glow)]"
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 520, damping: 42, mass: 0.9 }
                }
                aria-hidden
              />
            ) : null}
            <span className="relative text-xs leading-tight font-semibold">{phase.label}</span>
            {!isSet ? (
              <span
                className={cn(
                  "relative text-[10px] leading-tight",
                  active ? "opacity-80" : "text-muted-foreground/70",
                )}
              >
                not set up
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
