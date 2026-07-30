"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ChevronDown, Flame, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { btnGhost, btnPrimary } from "@/components/landing/primitives";

const EXPO = [0.16, 1, 0.3, 1] as const;

/** A stylised, static preview of the product UI — pure SVG/CSS, no real data. */
function ProductPreview() {
  const R = 52;
  const CIRC = 2 * Math.PI * R;
  const pct = 0.86;
  const reduce = useReducedMotion();

  return (
    <div className="relative w-full max-w-sm rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
      <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
      <div className="mb-4 flex items-center justify-between text-xs text-white/50">
        <span className="font-semibold tracking-wide text-white/70">Today</span>
        <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 font-medium text-emerald-300">
          On track
        </span>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative size-28 shrink-0">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            <motion.circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              initial={reduce ? { strokeDashoffset: CIRC * (1 - pct) } : { strokeDashoffset: CIRC }}
              whileInView={{ strokeDashoffset: CIRC * (1 - pct) }}
              viewport={{ once: true }}
              transition={{ duration: 1.6, ease: EXPO, delay: 0.2 }}
            />
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-extrabold tracking-tight tabular-nums">1,847</span>
            <span className="text-[10px] text-white/50">of 2,100 cal</span>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          {[
            ["Carbs", "72%", "from-emerald-400 to-teal-400"],
            ["Protein", "58%", "from-cyan-400 to-sky-400"],
            ["Fat", "40%", "from-amber-300 to-orange-400"],
          ].map(([label, w, grad]) => (
            <div key={label}>
              <div className="mb-1 flex justify-between text-[11px] text-white/55">
                <span>{label}</span>
                <span className="tabular-nums">{w}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className={`h-full rounded-full bg-gradient-to-r ${grad}`}
                  initial={reduce ? { width: w as string } : { width: 0 }}
                  whileInView={{ width: w as string }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: EXPO, delay: 0.4 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {[
          ["Everything Bagel", "Kirkland Signature", "310"],
          ["Banana", "1 medium (118 g)", "105"],
          ["Sparkling Orange", "Celsius", "10"],
        ].map(([name, sub, cal]) => (
          <div
            key={name}
            className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
              <Flame className="size-3.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-white/90">{name}</span>
              <span className="block truncate text-[10px] text-white/45">{sub}</span>
            </span>
            <span className="text-xs font-semibold tabular-nums text-white/70">{cal}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // Parallax: content drifts up and fades; the preview floats at a different rate.
  const contentY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -80]);
  const previewY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -160]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, reduce ? 1 : 0]);

  const words = ["Track", "everything."];

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100dvh] flex-col items-center justify-center px-6 pt-28 pb-20 text-center"
    >
      <motion.div style={{ y: contentY, opacity: fade }} className="relative z-10 max-w-3xl">
        <motion.span
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EXPO }}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md"
        >
          <Sparkles className="size-3.5 text-emerald-300" aria-hidden />
          Nutrition tracking, reimagined
        </motion.span>

        <h1 className="mt-6 text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
          <span className="block">
            {words.map((w, i) => (
              <motion.span
                key={w}
                className="mr-3 inline-block"
                initial={reduce ? false : { opacity: 0, y: 28, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, ease: EXPO, delay: 0.1 + i * 0.12 }}
              >
                {w}
              </motion.span>
            ))}
          </span>
          <motion.span
            className="block bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent"
            initial={reduce ? false : { opacity: 0, y: 28, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: EXPO, delay: 0.34 }}
          >
            Miss nothing.
          </motion.span>
        </h1>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EXPO, delay: 0.5 }}
          className="mx-auto mt-6 max-w-xl text-base text-white/60 sm:text-lg"
        >
          MacroMap logs meals, chain-store orders, and custom builds in seconds — with
          barcode scanning, AI label reading, and goals that flex with your week.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EXPO, delay: 0.62 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link href="/sign-up" className={btnPrimary}>
            Get started free
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </Link>
          <Link href="/sign-in" className={btnGhost}>
            Sign in
          </Link>
        </motion.div>
      </motion.div>

      {/* Floating product preview */}
      <motion.div
        style={{ y: previewY, opacity: fade }}
        initial={reduce ? false : { opacity: 0, y: 60, rotateX: 12 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 1, ease: EXPO, delay: 0.5 }}
        className="relative z-10 mt-14 [perspective:1200px]"
      >
        <ProductPreview />
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: reduce ? 0 : 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40"
      >
        <motion.div
          animate={reduce ? {} : { y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="size-6" />
        </motion.div>
      </motion.div>
    </section>
  );
}
