"use client";

import { Calculator, Mic, Pencil, Plus, ScanBarcode, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { haptic } from "@/lib/client/haptics";

/** Quick-log actions. `mode` deep-links the add page straight into that panel. */
const ACTIONS = [
  {
    key: "search",
    label: "Search foods",
    desc: "Find and log from the database",
    icon: Search,
    mode: null,
  },
  {
    key: "barcode",
    label: "Scan barcode",
    desc: "Look up a packaged food",
    icon: ScanBarcode,
    mode: "barcode",
  },
  {
    key: "voice",
    label: "Voice log",
    desc: "Say what you ate",
    icon: Mic,
    mode: "voice",
  },
  {
    key: "text",
    label: "Describe",
    desc: "Type a meal in plain text",
    icon: Pencil,
    mode: "text",
  },
  {
    key: "quick",
    label: "Quick add",
    desc: "Log calories without a food",
    icon: Calculator,
    mode: "quick",
  },
] as const;

/**
 * Floating quick-log button. Opens a bottom sheet fanning out to the four
 * logging modes instead of jumping straight into search, so a scan / voice /
 * quick-add is one tap away.
 */
export function QuickLogFab({ date, meal }: { date: string; meal: string }) {
  const [open, setOpen] = useState(false);
  const base = `/diary/add?date=${date}&meal=${encodeURIComponent(meal)}`;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon-lg"
          aria-label="Log food"
          className="fixed right-4 z-40 size-14 [&_svg]:size-6"
          style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
          onClick={() => haptic("light")}
        >
          <Plus aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="px-1 pb-1">
          <SheetTitle className="text-sm">Log food</SheetTitle>
          <SheetDescription className="sr-only">
            Choose how to log food for this day
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-2">
          {ACTIONS.map((action) => (
            <Button
              key={action.key}
              asChild
              variant="secondary"
              className="h-auto justify-start gap-3 rounded-2xl px-3 py-3 text-left"
              onClick={() => {
                haptic("light");
                setOpen(false);
              }}
            >
              <Link href={action.mode ? `${base}&mode=${action.mode}` : base}>
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <action.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{action.label}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {action.desc}
                  </span>
                </span>
              </Link>
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
