import Link from "next/link";

import { Button } from "@/components/ui/button";

/** 404 page — rendered inside the root layout, so theme + styles apply. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="space-y-1">
        <p className="text-5xl font-black tracking-tight text-primary">404</p>
        <h1 className="text-xl font-extrabold tracking-tight">Page not found</h1>
        <p className="mx-auto max-w-xs text-sm text-pretty text-muted-foreground">
          That page doesn&apos;t exist or may have moved.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </main>
  );
}
