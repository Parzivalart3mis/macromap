"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A chain-store avatar. Shows `public/store-logos/<slug>.png` when that file
 * exists, and falls back to the store's initial on its brand colour otherwise —
 * so it looks exactly like before until a logo image is dropped in. Uses the
 * ambient `--tile-color` for the fallback (set by the caller), else --primary.
 */
export function StoreLogo({
  slug,
  name,
  className,
}: {
  slug: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={cn(
          "flex items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm",
          className,
        )}
        style={{ backgroundColor: "var(--tile-color, var(--primary))" }}
        aria-hidden
      >
        {name.charAt(0)}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/store-logos/${slug}.png`}
        alt={`${name} logo`}
        className="size-full object-contain p-1"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
