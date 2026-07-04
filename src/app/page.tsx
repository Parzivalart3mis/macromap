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
    body: "Local database first, Open Food Facts and commercial APIs as backup.",
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
      className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-10 px-6"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 4rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 4rem)",
      }}
    >
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground">
          M
        </div>
        <h1 className="text-4xl font-bold tracking-tight">MacroMap</h1>
        <p className="text-muted-foreground">
          Track meals, chain-store orders, custom builds, and goals in one fast
          app. Works great solo and scales cleanly if friends join.
        </p>
      </div>

      <div className="grid gap-4">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="flex items-start gap-4 rounded-xl border bg-card p-4"
          >
            <feature.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
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
    </main>
  );
}
