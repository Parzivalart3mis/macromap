import { auth } from "@clerk/nextjs/server";
import { NotebookPen, ScanBarcode, Store, Timer } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: NotebookPen,
    title: "Fast diary logging",
    body: "Search, voice, and natural language. Log a full meal in seconds.",
  },
  {
    icon: Store,
    title: "Chain-store menus",
    body: "Verified items for 11 chains, plus a builder for your custom orders.",
  },
  {
    icon: ScanBarcode,
    title: "Barcode lookup",
    body: "Local database first, Open Food Facts and USDA as backup.",
  },
  {
    icon: Timer,
    title: "Fasting and progress",
    body: "Fasting timer, weight and body metrics, weekly reports and exports.",
  },
];

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/diary");

  return (
    <main
      className="relative mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-10 overflow-hidden px-6"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 4rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 4rem)",
      }}
    >
      {/* Ambient background */}
      <div
        aria-hidden
        className="animate-blob pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 size-80 rounded-full bg-cta/10 blur-3xl"
      />

      <div className="stagger-children relative space-y-10">
        <div className="space-y-4 text-center">
          <div className="animate-scale-in mx-auto flex size-20 rotate-3 items-center justify-center rounded-[1.75rem] bg-[image:var(--gradient-brand)] text-4xl font-black text-white shadow-[var(--shadow-glow)]">
            M
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight">
            Macro
            <span className="bg-[image:var(--gradient-brand)] bg-clip-text text-transparent">
              Map
            </span>
          </h1>
          <p className="text-muted-foreground">
            Track meals, chain-store orders, custom builds, and goals in one fast
            app. Works great solo and scales cleanly if friends join.
          </p>
        </div>

        <div className="grid gap-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="card-lift flex items-start gap-4 rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <feature.icon className="size-5 text-primary" aria-hidden />
              </div>
              <div>
                <h2 className="font-semibold">{feature.title}</h2>
                <p className="text-sm text-muted-foreground">{feature.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <Button size="lg" asChild>
            <Link href="/sign-up">Create account</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
