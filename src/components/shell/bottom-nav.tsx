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
      className="bottom-nav app-chrome fixed inset-x-0 bottom-0 z-40 px-3 pt-1"
    >
      <div className="glass mx-auto flex max-w-2xl items-stretch justify-around rounded-3xl border shadow-[var(--shadow-lift)]">
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
                "group relative flex min-h-11 min-w-11 flex-1 flex-col items-center gap-0.5 rounded-3xl py-2 text-[10px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {/* Active pill glides in behind the icon */}
              <span
                aria-hidden
                className={cn(
                  "absolute top-1 h-8 w-14 rounded-full bg-primary/12 transition-all duration-300 [transition-timing-function:var(--ease-spring)]",
                  active ? "scale-100 opacity-100" : "scale-50 opacity-0",
                )}
              />
              <tab.icon
                className={cn(
                  "relative size-5 transition-transform duration-300 [transition-timing-function:var(--ease-spring)]",
                  active && "-translate-y-px scale-110",
                )}
                aria-hidden
              />
              <span className="relative">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
