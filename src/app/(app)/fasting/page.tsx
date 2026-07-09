"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, ListSkeleton } from "@/components/async-states";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/client/fetcher";
import { cn } from "@/lib/utils";
import type { FastingSessionDTO } from "@/types/api";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

export default function FastingPage() {
  const [active, setActive] = useState<FastingSessionDTO | null>(null);
  const [sessions, setSessions] = useState<FastingSessionDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{
        active: FastingSessionDTO | null;
        sessions: FastingSessionDTO[];
      }>("/api/fasting");
      setActive(data.active);
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load fasting data");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active]);

  async function toggleFast() {
    setBusy(true);
    try {
      if (active) {
        await apiFetch("/api/fasting/stop", { method: "POST" });
        toast.success("Fast ended");
      } else {
        await apiFetch("/api/fasting/start", { method: "POST" });
        toast.success("Fast started");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const completed = sessions?.filter((session) => session.endAt !== null) ?? [];

  return (
    <main>
      <PageHeader title="Fasting" />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : sessions === null ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="stagger-children space-y-4 p-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-5 py-8">
              {/* Progress ring: sweeps once per hour while fasting */}
              <div
                className={cn(
                  "relative flex size-56 items-center justify-center rounded-full",
                  active && "animate-ring-breathe",
                )}
              >
                <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90" aria-hidden>
                  <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 90}
                    strokeDashoffset={
                      2 *
                      Math.PI *
                      90 *
                      (active
                        ? 1 -
                          (((now - new Date(active.startAt).getTime()) / 60_000) % 60) / 60
                        : 1)
                    }
                    className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                  />
                </svg>
                <div className="flex flex-col items-center">
                  {active ? (
                    <>
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Fasting for
                      </p>
                      <p
                        className="text-4xl font-extrabold tracking-tight tabular-nums"
                        aria-live="polite"
                        aria-label="Elapsed fasting time"
                      >
                        {formatElapsed(now - new Date(active.startAt).getTime())}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        since{" "}
                        {new Date(active.startAt).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Ready when you are
                      </p>
                      <p className="text-4xl font-extrabold tracking-tight tabular-nums text-muted-foreground/30">
                        00:00:00
                      </p>
                    </>
                  )}
                </div>
              </div>
              <Button size="lg" disabled={busy} onClick={toggleFast} className="min-w-44">
                {active ? (
                  <Pause data-icon="inline-start" aria-hidden />
                ) : (
                  <Play data-icon="inline-start" aria-hidden />
                )}
                {busy ? "Working..." : active ? "End fast" : "Start fast"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">History</CardTitle>
            </CardHeader>
            <CardContent>
              {completed.length === 0 ? (
                <EmptyState
                  title="No completed fasts"
                  body="Your finished fasts and durations will appear here."
                />
              ) : (
                <ul className="divide-y text-sm">
                  {completed.map((session) => (
                    <li key={session.id} className="flex justify-between gap-3 py-2">
                      <span className="text-muted-foreground">
                        {new Date(session.startAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        {new Date(session.startAt).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="font-medium tabular-nums">
                        {session.durationMinutes != null
                          ? formatDuration(session.durationMinutes)
                          : "-"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
