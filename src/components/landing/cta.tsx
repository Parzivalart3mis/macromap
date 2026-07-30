"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { btnGhost, btnPrimary, Reveal } from "@/components/landing/primitives";

export function CallToAction() {
  return (
    <section className="relative mx-auto max-w-5xl px-6 py-24 sm:py-32">
      <Reveal className="relative overflow-hidden rounded-[2.5rem] border border-emerald-300/20 px-8 py-16 text-center sm:px-16 sm:py-20">
        {/* Layered glow behind the panel */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/20"
        />
        <div
          aria-hidden
          className="absolute left-1/2 top-0 -z-10 h-64 w-[40rem] max-w-full -translate-x-1/2 rounded-full bg-emerald-400/25 blur-[100px]"
        />

        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Start mapping your macros.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-white/60">
          Free to use, fast to log, and precise enough to trust. Your first meal is a
          few taps away.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/sign-up" className={btnPrimary}>
            Create your account
            <ArrowRight
              className="size-4 transition-transform duration-300 group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
          <Link href="/sign-in" className={btnGhost}>
            I already have one
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
