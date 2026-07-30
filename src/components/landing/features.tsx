"use client";

import {
  NotebookPen,
  ScanLine,
  ShieldCheck,
  Store,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react";

import { Reveal } from "@/components/landing/primitives";

type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Grid span on desktop for the bento layout. */
  span: "wide" | "normal";
  glow: string;
};

// Accurate to what the app actually does — edit freely to re-order or reword.
const FEATURES: Feature[] = [
  {
    icon: NotebookPen,
    title: "Log a meal in seconds",
    body: "Search, voice, natural language, and barcode — whatever's fastest in the moment. Recent foods relog in one tap.",
    span: "wide",
    glow: "from-emerald-500/25",
  },
  {
    icon: ScanLine,
    title: "AI label reading",
    body: "Snap a nutrition label and every field fills itself — serving size, macros, the lot.",
    span: "normal",
    glow: "from-cyan-500/25",
  },
  {
    icon: Store,
    title: "Chain-store menus",
    body: "Verified items for 13 stores, plus a builder for your exact custom order.",
    span: "normal",
    glow: "from-indigo-500/25",
  },
  {
    icon: Target,
    title: "Goals that flex with your week",
    body: "A base target plus recurring activities — cycling, a shift, each lift — with per-date skips and one-offs when the plan changes.",
    span: "wide",
    glow: "from-teal-500/25",
  },
  {
    icon: ShieldCheck,
    title: "A food database you can trust",
    body: "Thousands of curated foods with a verified badge, shared by everyone who logs.",
    span: "normal",
    glow: "from-emerald-500/25",
  },
  {
    icon: Timer,
    title: "Fasting & progress",
    body: "A fasting timer, weight and body metrics, and progress charts that show the trend.",
    span: "normal",
    glow: "from-sky-500/25",
  },
];

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;
  return (
    <Reveal
      delay={(index % 3) * 0.08}
      className={feature.span === "wide" ? "md:col-span-2" : "md:col-span-1"}
    >
      <div className="group relative h-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md transition-colors duration-300 hover:border-white/20">
        {/* Hover glow */}
        <div
          className={`pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-br ${feature.glow} to-transparent opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100`}
        />
        <div className="relative">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-emerald-300 shadow-[0_0_24px_-8px_rgba(16,185,129,0.6)] transition-transform duration-300 group-hover:-translate-y-0.5">
            <Icon className="size-5" aria-hidden />
          </span>
          <h3 className="mt-4 text-lg font-semibold text-white">{feature.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/55">{feature.body}</p>
        </div>
      </div>
    </Reveal>
  );
}

export function Features() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-semibold tracking-[0.2em] text-emerald-300/80 uppercase">
          Capabilities
        </span>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Everything you need to log.
          <br className="hidden sm:block" /> Nothing you don&apos;t.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-white/55">
          Built for people who track seriously — fast enough to keep up, precise enough
          to trust.
        </p>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
        {FEATURES.map((feature, i) => (
          <FeatureCard key={feature.title} feature={feature} index={i} />
        ))}
      </div>
    </section>
  );
}
