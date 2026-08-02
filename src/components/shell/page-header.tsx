"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Sticky glass page header. Sits flush at the top and gains a hairline border +
 * soft shadow once the page scrolls, so content reads as passing *under* the
 * chrome instead of colliding with it.
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "top-header app-chrome glass sticky top-0 z-30 border-b px-4 pb-3 transition-[border-color,box-shadow] duration-300",
        scrolled
          ? "border-border/60 shadow-[var(--shadow-soft)]"
          : "border-transparent",
      )}
    >
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
