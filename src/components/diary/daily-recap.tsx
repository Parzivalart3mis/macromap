"use client";

import { useEffect, useRef, useState } from "react";

import { DaySummaryView } from "@/components/diary/day-summary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/client/fetcher";
import { addDaysISO, todayISO } from "@/lib/dates";
import type { DaySummary } from "@/types/summary";

// The last summary date shown, and the local day the server was last asked —
// together they make the recap appear once, on the first open of each day.
const SHOWN_KEY = "mm-recap-shown";
const CHECKED_KEY = "mm-recap-checked";

function readKey(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode) — the recap may show again; harmless.
  }
}

/**
 * On the first open of a new day, shows the summary of the last logged day.
 * An installed PWA can sit in memory overnight, so "open" includes coming back
 * to the foreground, not just a fresh load.
 */
export function DailyRecap() {
  const [recap, setRecap] = useState<{ date: string; summary: DaySummary } | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    async function check() {
      const today = todayISO();
      if (busy.current || readKey(CHECKED_KEY) === today) return;
      busy.current = true;
      try {
        const data = await apiFetch<{ date: string | null; summary: DaySummary | null }>(
          "/api/diary/recap",
          {
            method: "POST",
            body: JSON.stringify({
              today,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }),
          },
        );
        writeKey(CHECKED_KEY, today);
        if (data.date && data.summary && data.date > (readKey(SHOWN_KEY) ?? "")) {
          writeKey(SHOWN_KEY, data.date);
          setRecap({ date: data.date, summary: data.summary });
        }
      } catch {
        // Offline or signed out — try again on the next open.
      } finally {
        busy.current = false;
      }
    }

    check();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", check);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", check);
    };
  }, []);

  if (!recap) return null;
  const isYesterday = recap.date === addDaysISO(todayISO(), -1);
  return (
    <Dialog open onOpenChange={(open) => !open && setRecap(null)}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isYesterday ? "Yesterday's summary" : "Your last logged day"}</DialogTitle>
          <DialogDescription>
            {new Date(`${recap.date}T12:00:00`).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </DialogDescription>
        </DialogHeader>
        <DaySummaryView summary={recap.summary} />
        <Button className="w-full" onClick={() => setRecap(null)}>
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}
