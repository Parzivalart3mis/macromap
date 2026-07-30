"use client";

import { useMotionValueEvent, useScroll } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

import { CallToAction } from "@/components/landing/cta";
import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { AuroraBackground } from "@/components/landing/primitives";
import { Proof } from "@/components/landing/proof";
import { SiteFooter } from "@/components/landing/site-footer";
import { cn } from "@/lib/utils";

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        scrolled ? "border-b border-white/10 bg-[#05060c]/70 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[image:var(--gradient-brand)] text-sm font-black text-white shadow-[var(--shadow-glow)]">
            M
          </span>
          <span className="text-base font-extrabold tracking-tight text-white">
            Macro
            <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
              Map
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:text-white sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#05060c] transition-transform duration-300 hover:-translate-y-0.5"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

/** The full marketing landing page — dark, cinematic, self-contained. */
export function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#05060c] text-white antialiased selection:bg-emerald-400/30">
      <AuroraBackground />
      <Nav />
      <main>
        <Hero />
        <Features />
        <Proof />
        <CallToAction />
      </main>
      <SiteFooter />
    </div>
  );
}
