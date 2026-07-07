"use client";

import { motion, useReducedMotion } from "framer-motion";

const R = 52;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * Circular calorie progress ring. Fills to consumed/goal when it mounts
 * (so it tweens as a new day-page arrives). Turns to the warning colour when
 * over goal. `children` renders in the centre (the big number).
 */
export function CalorieRing({
  consumed,
  goal,
  className = "size-32",
  children,
}: {
  consumed: number;
  goal: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const pct = goal > 0 ? Math.min(1, consumed / goal) : consumed > 0 ? 1 : 0;
  const over = goal > 0 && consumed > goal;
  const offset = CIRCUMFERENCE * (1 - pct);

  return (
    <div className={`relative shrink-0 ${className}`}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--muted)" strokeWidth="10" />
        <motion.circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={over ? "var(--warning)" : "var(--primary)"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: reduce ? offset : CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={reduce ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
