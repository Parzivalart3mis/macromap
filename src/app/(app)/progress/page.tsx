"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, ListSkeleton } from "@/components/async-states";
import { MacroMeter } from "@/components/nutrition/macro-meter";
import { CalorieHistoryChart, WeightChart } from "@/components/progress/charts";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/client/fetcher";
import { todayISO } from "@/lib/dates";
import type { ProgressOverviewDTO } from "@/types/api";

function LogWeightDialog({
  open,
  onOpenChange,
  onLogged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged: () => void;
}) {
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const value = Number(weight);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid weight");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/progress/weight", {
        method: "POST",
        body: JSON.stringify({ date: todayISO(), weightValue: value }),
      });
      toast.success("Weight logged");
      setWeight("");
      onOpenChange(false);
      onLogged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logging failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log weight</DialogTitle>
          <DialogDescription>Recorded for today, one entry per day</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="weight-value">Weight</Label>
          <Input
            id="weight-value"
            type="number"
            inputMode="decimal"
            min={1}
            step={0.1}
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
          />
        </div>
        <Button disabled={busy} onClick={save}>
          {busy ? "Saving..." : "Save"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function LogMetricsDialog({
  open,
  onOpenChange,
  onLogged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged: () => void;
}) {
  const [bodyFat, setBodyFat] = useState("");
  const [waist, setWaist] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const bodyFatPct = bodyFat ? Number(bodyFat) : undefined;
    const waistCm = waist ? Number(waist) : undefined;
    if (bodyFatPct == null && waistCm == null && !notes.trim()) {
      toast.error("Log at least one metric");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/progress/body-metrics", {
        method: "POST",
        body: JSON.stringify({
          date: todayISO(),
          bodyFatPct,
          waistCm,
          notes: notes.trim() || undefined,
        }),
      });
      toast.success("Body metrics logged");
      setBodyFat("");
      setWaist("");
      setNotes("");
      onOpenChange(false);
      onLogged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logging failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log body metrics</DialogTitle>
          <DialogDescription>Body fat, waist, or a note for today</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="body-fat">Body fat %</Label>
            <Input
              id="body-fat"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={0.1}
              value={bodyFat}
              onChange={(event) => setBodyFat(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="waist">Waist (cm)</Label>
            <Input
              id="waist"
              type="number"
              inputMode="decimal"
              min={1}
              step={0.1}
              value={waist}
              onChange={(event) => setWaist(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="metric-notes">Notes</Label>
          <Input
            id="metric-notes"
            value={notes}
            maxLength={500}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        <Button disabled={busy} onClick={save}>
          {busy ? "Saving..." : "Save"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function ProgressPage() {
  const [overview, setOverview] = useState<ProgressOverviewDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<ProgressOverviewDTO>("/api/progress/overview");
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load progress");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main>
      <PageHeader title="Progress" />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !overview ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="stagger-children space-y-4 p-4">
          {/* Split dashboard: nutrition on top, body below */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Today</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-2xl font-bold tabular-nums">
                {Math.round(overview.today.totals.calories)}
                {overview.today.goal ? (
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / {overview.today.goal.calories} kcal
                  </span>
                ) : (
                  <span className="text-sm font-normal text-muted-foreground"> kcal</span>
                )}
              </p>
              <div className="grid gap-2.5">
                <MacroMeter
                  label="Protein"
                  value={overview.today.totals.proteinG}
                  target={overview.today.goal?.proteinG ?? null}
                  colorVar="--macro-protein"
                />
                <MacroMeter
                  label="Carbs"
                  value={overview.today.totals.carbsG}
                  target={overview.today.goal?.carbsG ?? null}
                  colorVar="--macro-carbs"
                />
                <MacroMeter
                  label="Fat"
                  value={overview.today.totals.fatG}
                  target={overview.today.goal?.fatG ?? null}
                  colorVar="--macro-fat"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Last 14 days</CardTitle>
            </CardHeader>
            <CardContent>
              <CalorieHistoryChart data={overview.calorieHistory} />
              <p className="mt-1 text-center text-[10px] text-muted-foreground">
                Bars show calories eaten, dashed line is your goal
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Weight</CardTitle>
              <Button size="sm" variant="secondary" onClick={() => setWeightOpen(true)}>
                <Plus data-icon="inline-start" aria-hidden />
                Log
              </Button>
            </CardHeader>
            <CardContent>
              {overview.weights.length === 0 ? (
                <EmptyState
                  title="No weight logged yet"
                  body="Log your first weigh-in to start the trend line."
                />
              ) : (
                <WeightChart data={overview.weights} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Body metrics</CardTitle>
              <Button size="sm" variant="secondary" onClick={() => setMetricsOpen(true)}>
                <Plus data-icon="inline-start" aria-hidden />
                Log
              </Button>
            </CardHeader>
            <CardContent>
              {overview.bodyMetrics.length === 0 ? (
                <EmptyState
                  title="No measurements yet"
                  body="Track body fat and waist alongside your weight."
                />
              ) : (
                <ul className="divide-y text-sm">
                  {[...overview.bodyMetrics].reverse().map((metric) => (
                    <li key={metric.id} className="flex justify-between gap-3 py-2">
                      <span className="text-muted-foreground">{metric.date}</span>
                      <span className="tabular-nums">
                        {metric.bodyFatPct != null ? `${metric.bodyFatPct}% bf` : ""}
                        {metric.bodyFatPct != null && metric.waistCm != null ? " · " : ""}
                        {metric.waistCm != null ? `${metric.waistCm} cm waist` : ""}
                        {metric.notes && metric.bodyFatPct == null && metric.waistCm == null
                          ? metric.notes
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <LogWeightDialog open={weightOpen} onOpenChange={setWeightOpen} onLogged={load} />
      <LogMetricsDialog open={metricsOpen} onOpenChange={setMetricsOpen} onLogged={load} />
    </main>
  );
}
