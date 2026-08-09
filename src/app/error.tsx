"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Route-segment error boundary. Catches render errors anywhere below the root
 * layout and offers recovery instead of dropping to a blank screen. Rendered
 * inside the root layout, so the app's theme + styles apply.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in the browser console + Vercel logs for diagnosis.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Something went wrong</h1>
        <p className="mx-auto max-w-xs text-sm text-pretty text-muted-foreground">
          The app hit an unexpected error. Try again, or head back to your diary.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  );
}
