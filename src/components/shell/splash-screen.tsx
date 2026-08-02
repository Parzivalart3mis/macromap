"use client";

import { useEffect, useState } from "react";

/**
 * Branded startup splash. Rendered inside the root layout so its markup is in
 * the very first HTML paint — the logo shows immediately with no flash of the
 * app underneath. After hydration it stays up for a short brand moment, then
 * fades out and unmounts. It is a fixed overlay, so appearing/leaving causes no
 * layout shift, and it only shows on a full load/refresh (client-side route
 * changes keep the persisted root layout, so it never re-triggers).
 *
 * All visuals are driven by CSS tokens + `#app-splash` styles in globals.css,
 * so it's theme-aware and easy to restyle in one place.
 */

const MIN_VISIBLE_MS = 650; // brand moment before we start dismissing
const EXIT_MS = 520; // must match the opacity transition in globals.css

export function SplashScreen() {
  const [phase, setPhase] = useState<"visible" | "hiding" | "done">("visible");

  useEffect(() => {
    const t = setTimeout(() => setPhase("hiding"), MIN_VISIBLE_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== "hiding") return;
    const t = setTimeout(() => setPhase("done"), EXIT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      id="app-splash"
      data-hiding={phase === "hiding" ? "" : undefined}
      role="status"
      aria-label="Loading MacroMap"
    >
      <div className="app-splash__mark">
        <span className="app-splash__badge">M</span>
        <span className="app-splash__word">
          Macro<span className="app-splash__word-accent">Map</span>
        </span>
      </div>
      <span className="app-splash__progress" aria-hidden />
    </div>
  );
}
