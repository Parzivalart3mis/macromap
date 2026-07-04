"use client";

import { Ellipsis, NotebookPen, Timer, TrendingUp, Utensils } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/diary", label: "Diary", icon: NotebookPen, match: ["/diary"] },
  // Food covers the create-food flow and the store pages that live under it.
  { href: "/food", label: "Food", icon: Utensils, match: ["/food", "/foods", "/stores"] },
  { href: "/progress", label: "Progress", icon: TrendingUp, match: ["/progress"] },
  { href: "/fasting", label: "Fasting", icon: Timer, match: ["/fasting"] },
  { href: "/more", label: "More", icon: Ellipsis, match: ["/more"] },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="bottom-nav app-chrome fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {TABS.map((tab) => {
          const active = tab.match.some(
            (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
          );
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 min-w-11 flex-1 flex-col items-center gap-0.5 rounded-md py-2 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <tab.icon className="size-5" aria-hidden />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
