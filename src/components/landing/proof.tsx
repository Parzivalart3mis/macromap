"use client";

import { CountUp, Reveal } from "@/components/landing/primitives";

// Real, defensible numbers about the app — not invented testimonials.
const STATS: { value: number; suffix: string; label: string }[] = [
  { value: 6000, suffix: "+", label: "Foods in the shared database" },
  { value: 13, suffix: "", label: "Chain-store menus" },
  { value: 5, suffix: "", label: "Ways to log a food" },
  { value: 0, suffix: "", label: "Dollars — free to use" },
];

const CHAINS = [
  "Subway",
  "Starbucks",
  "McDonald's",
  "Chipotle",
  "Dunkin'",
  "Taco Bell",
  "Wendy's",
  "Burger King",
  "Panera",
  "Chick-fil-A",
  "ALDI",
  "Jewel",
  "Costco",
];

export function Proof() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-20">
      <Reveal className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-8 backdrop-blur-md sm:p-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent tabular-nums sm:text-5xl">
                <CountUp to={stat.value} />
                {stat.suffix}
              </div>
              <p className="mt-2 text-xs text-white/50 sm:text-sm">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <p className="text-center text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">
            Menus built in, ready to log
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {CHAINS.map((chain, i) => (
              <Reveal key={chain} as="span" delay={i * 0.03}>
                <span className="inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/70 transition-colors duration-300 hover:border-emerald-300/40 hover:text-white">
                  {chain}
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
