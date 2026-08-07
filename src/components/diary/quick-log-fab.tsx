"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/client/haptics";

/**
 * Floating quick-log button. Navigates straight to the Add Food search page —
 * the individual logging methods (scan / voice / describe / quick add / photo)
 * live on that page's own action row, so there's no duplicate fan-out menu here.
 */
export function QuickLogFab({ date, meal }: { date: string; meal: string }) {
  const href = `/diary/add?date=${date}&meal=${encodeURIComponent(meal)}`;
  return (
    <Button
      size="icon-lg"
      aria-label="Log food"
      className="fixed right-4 z-40 size-14 [&_svg]:size-6"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      onClick={() => haptic("light")}
      asChild
    >
      <Link href={href}>
        <Plus aria-hidden />
      </Link>
    </Button>
  );
}
