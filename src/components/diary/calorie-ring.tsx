"use client";

import { motion, useReducedMotion } from "framer-motion";

const R = 52;
const CIRCUMFERENCE = 2 * Math.PI * R;

type Macros = { carbsG: number; fatG: number; proteinG: number };

/** Draw order of the bands — matches the macro-card colour order below the ring. */
const SEGMENTS: Array<{ key: keyof Macros; perGram: number; colorVar: string }> = [
  { key: "carbsG", perGram: 4, colorVar: "--macro-carbs" },
  { key: "fatG", perGram: 9, colorVar: "--macro-fat" },
  { key: "proteinG", perGram: 4, colorVar: "--macro-protein" },
];

/**
 * Circular calorie progress ring. When `macros` are supplied the filled arc is
 * split into carb / fat / protein bands by their share of consumed calories, so
 * the ring itself tells the macro story. Falls back to a single-colour fill
 * (primary, or warning when over) if no macros are given. A one-shot pulse
 * celebrates reaching the goal. `children` renders in the centre (the big
 * number).
 */
export function CalorieRing({
  consumed,
  goal,
  macros,
  className = "size-32",
  children,
}: {
  consumed: number;
  goal: number;
  macros?: Macros | null;
  className?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const pct = goal > 0 ? Math.min(1, consumed / goal) : consumed > 0 ? 1 : 0;
  const over = goal > 0 && consumed > goal;
  const reached = goal > 0 && consumed >= goal;
  const filled = pct * CIRCUMFERENCE;

  // Split the filled arc into carb / fat / protein bands by their calorie share.
  const macroCals = macros
    ? SEGMENTS.map((s) => Math.max(0, macros[s.key] ?? 0) * s.perGram)
    : [];
  const macroTotal = macroCals.reduce((a, b) => a + b, 0);
  const segmented = macros != null && macroTotal > 0;

  let cursor = 0;
  const bands = segmented
    ? SEGMENTS.map((s, i) => {
        const len = (macroCals[i] / macroTotal) * filled;
        const start = cursor;
        cursor += len;
        return { colorVar: s.colorVar, len, start };
      })
    : [];

  return (
    <div className={`relative shrink-0 ${className}`}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--muted)" strokeWidth="10" />

        {segmented ? (
          bands.map((b, i) =>
            b.len <= 0.01 ? null : (
              <motion.circle
                key={i}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={`var(${b.colorVar})`}
                strokeWidth="10"
                strokeLinecap="butt"
                strokeDashoffset={-b.start}
                initial={{
                  strokeDasharray: reduce
                    ? `${b.len} ${CIRCUMFERENCE}`
                    : `0 ${CIRCUMFERENCE}`,
                }}
                animate={{ strokeDasharray: `${b.len} ${CIRCUMFERENCE}` }}
                transition={reduce ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
              />
            ),
          )
        ) : (
          <motion.circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={over ? "var(--warning)" : "var(--primary)"}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: reduce ? CIRCUMFERENCE * (1 - pct) : CIRCUMFERENCE }}
            animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - pct) }}
            transition={reduce ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
          />
        )}

        {/* Thin outer ring flags an over-goal day without hiding the macro bands. */}
        {over ? (
          <circle
            cx="60"
            cy="60"
            r={R + 7}
            fill="none"
            stroke="var(--warning)"
            strokeWidth="2"
            opacity={0.9}
          />
        ) : null}
      </svg>

      {/* One-shot celebratory pulse when the goal is reached. */}
      {reached && !reduce ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ border: `3px solid ${over ? "var(--warning)" : "var(--primary)"}` }}
          initial={{ opacity: 0.7, scale: 0.9 }}
          animate={{ opacity: 0, scale: 1.25 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.45 }}
        />
      ) : null}

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
