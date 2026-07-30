"use client";

import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Shared button styles so every CTA on the page stays consistent. */
export const btnPrimary =
  "group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-[0_0_34px_-8px_rgba(16,185,129,0.7)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_46px_-6px_rgba(16,185,129,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md transition duration-300 hover:border-white/25 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30";

const EXPO = [0.16, 1, 0.3, 1] as const;

/** Fade + rise into view on scroll; respects reduced motion. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 26,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "section" | "li" | "span";
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];
  return (
    <MotionTag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={reduce ? { duration: 0 } : { duration: 0.75, ease: EXPO, delay }}
    >
      {children}
    </MotionTag>
  );
}

/** Number that counts up when it scrolls into view. */
export function CountUp({
  to,
  duration = 1.6,
  format = (v: number) => Math.round(v).toLocaleString(),
}: {
  to: number;
  duration?: number;
  format?: (value: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, to, {
      duration,
      ease: EXPO,
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [inView, to, duration, reduce]);

  // With reduced motion there's no animation, so show the final value outright.
  return <span ref={ref}>{format(reduce ? to : value)}</span>;
}

/** Fixed, layered aurora + grid backdrop that drifts slowly behind the page. */
export function AuroraBackground() {
  const reduce = useReducedMotion();
  const drift = (dx: number, dy: number) =>
    reduce
      ? {}
      : {
          animate: { x: [0, dx, -dx * 0.6, 0], y: [0, dy, -dy * 0.5, 0], scale: [1, 1.08, 0.96, 1] },
          transition: { duration: 24, repeat: Infinity, ease: "easeInOut" as const },
        };

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Faint tech grid, faded at the edges */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 20%, transparent 75%)",
        }}
      />
      {/* Glow blobs */}
      <motion.div
        {...drift(40, -30)}
        className="absolute -top-48 left-[15%] size-[38rem] rounded-full bg-emerald-500/25 blur-[130px]"
      />
      <motion.div
        {...drift(-36, 28)}
        className="absolute top-[28%] right-[-10%] size-[42rem] rounded-full bg-indigo-500/20 blur-[140px]"
      />
      <motion.div
        {...drift(28, 24)}
        className="absolute bottom-[-10%] left-[25%] size-[34rem] rounded-full bg-cyan-400/15 blur-[130px]"
      />
      {/* Vignette to seat the content */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#05060c]/40 via-transparent to-[#05060c]" />
    </div>
  );
}
