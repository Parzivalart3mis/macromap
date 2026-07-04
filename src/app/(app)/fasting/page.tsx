"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, ListSkeleton } from "@/components/async-states";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/client/fetcher";
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
        <div className="space-y-4 p-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-8">
              {active ? (
                <>
                  <p className="text-sm text-muted-foreground">Fasting for</p>
                  <p
                    className="text-5xl font-bold tabular-nums"
                    aria-live="polite"
                    aria-label="Elapsed fasting time"
                  >
                    {formatElapsed(now - new Date(active.startAt).getTime())}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Started {new Date(active.startAt).toLocaleString()}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">No fast in progress</p>
                  <p className="text-5xl font-bold tabular-nums text-muted-foreground/40">
                    00:00:00
                  </p>
                </>
              )}
              <Button size="lg" disabled={busy} onClick={toggleFast} className="min-w-40">
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
