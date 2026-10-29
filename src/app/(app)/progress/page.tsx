"use client";

import { Minus, Plus, Ruler, Scale, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, ListSkeleton, Spinner } from "@/components/async-states";
import { MacroMeter } from "@/components/nutrition/macro-meter";
import {
  BodyMetricChart,
  CalorieHistoryChart,
  ExpandChartButton,
  ExpandedChartSheet,
  LoggedDaysHeatmap,
  WeightChart,
} from "@/components/progress/charts";
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
import { bodyComposition, navyBodyFatPct, waistToHeight } from "@/lib/body/composition";
import { apiFetch } from "@/lib/client/fetcher";
import { haptic } from "@/lib/client/haptics";
import { formatDisplayDate, relativeDayLabel, todayISO } from "@/lib/dates";
import {
  WEIGHT_STEP,
  previousReading,
  stepWeight,
  weightDelta,
} from "@/lib/progress/weight-entry";
import { cn } from "@/lib/utils";
import type { BiologicalSexDTO, ProgressOverviewDTO, WeightLogDTO } from "@/types/api";

/**
 * What the most recent measurement implies: waist-to-height with its band, and
 * the lean/fat split against the latest weight. Each row is skipped when its
 * inputs are missing rather than shown as a blank.
 */
function LatestComposition({ overview }: { overview: ProgressOverviewDTO }) {
  const latest = overview.bodyMetrics[overview.bodyMetrics.length - 1];
  const latestWeight = overview.weights[overview.weights.length - 1]?.weightValue ?? null;
  if (!latest) return null;

  const whtr = waistToHeight(latest.waistCm, overview.heightCm);
  const bf =
    latest.bodyFatPct ??
    navyBodyFatPct({
      sex: overview.sex,
      heightCm: overview.heightCm,
      waistCm: latest.waistCm,
      neckCm: latest.neckCm,
      hipCm: latest.hipCm,
    });
  const split = bodyComposition(latestWeight, bf);
  if (!whtr && bf == null && !split) {
    // Nothing derivable — usually height or sex missing on the profile.
    return overview.heightCm == null ? (
      <p className="mb-3 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Add your height on the profile screen to see waist-to-height and a body
        fat estimate.
      </p>
    ) : null;
  }

  return (
    <dl className="mb-3 grid grid-cols-3 gap-2 text-center">
      {whtr ? (
        <div className="rounded-xl bg-muted/60 px-2 py-2">
          <dt className="text-xs text-muted-foreground">Waist / height</dt>
          <dd className="font-semibold tabular-nums">{whtr.ratio.toFixed(2)}</dd>
          <dd className="text-xs text-muted-foreground">{whtr.label}</dd>
        </div>
      ) : null}
      {bf != null ? (
        <div className="rounded-xl bg-muted/60 px-2 py-2">
          <dt className="text-xs text-muted-foreground">Body fat</dt>
          <dd className="font-semibold tabular-nums">{bf}%</dd>
          <dd className="text-xs text-muted-foreground">
            {latest.bodyFatPct != null ? "entered" : "estimated"}
          </dd>
        </div>
      ) : null}
      {split ? (
        <div className="rounded-xl bg-muted/60 px-2 py-2">
          <dt className="text-xs text-muted-foreground">Lean mass</dt>
          <dd className="font-semibold tabular-nums">{split.leanKg} kg</dd>
          <dd className="text-xs text-muted-foreground">{split.fatKg} kg fat</dd>
        </div>
      ) : null}
    </dl>
  );
}

/**
 * The reading under inspection in the expanded weight chart, with the one
 * action that was previously impossible: taking a bad figure back out. The
 * trend line is a smoothed average, so a single mistyped weigh-in bends a
 * fortnight of chart either side of it.
 */
function InspectedReading({
  reading,
  unit,
  onDeleted,
}: {
  reading: WeightLogDTO | null;
  unit: string;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // A different point was tapped — drop back out of the confirm step.
  const key = reading?.date ?? "none";
  const [armedFor, setArmedFor] = useState(key);
  if (armedFor !== key) {
    setArmedFor(key);
    setConfirming(false);
  }

  if (!reading) {
    return (
      <p className="shrink-0 rounded-xl bg-muted/50 px-3 py-2.5 text-center text-xs text-muted-foreground">
        Tap the chart to inspect a reading
      </p>
    );
  }

  async function remove() {
    if (!reading) return;
    setBusy(true);
    try {
      await apiFetch(`/api/progress/weight?date=${reading.date}`, { method: "DELETE" });
      haptic("warning");
      toast.success(`Removed the ${relativeDayLabel(reading.date, todayISO())} reading`);
      onDeleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove it");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold tabular-nums">
          {reading.weightValue} {unit}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDisplayDate(reading.date)} · {relativeDayLabel(reading.date, todayISO())}
        </p>
      </div>
      {confirming ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="destructive" disabled={busy} onClick={remove}>
            {busy ? <Spinner data-icon="inline-start" /> : null}
            Remove
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 text-destructive"
          onClick={() => setConfirming(true)}
        >
          <Trash2 data-icon="inline-start" aria-hidden />
          Remove
        </Button>
      )}
    </div>
  );
}

function LogWeightDialog({
  open,
  onOpenChange,
  onLogged,
  unit,
  weights,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged: () => void;
  unit: string;
  /** Ascending by date — the last entry is the most recent weigh-in. */
  weights: WeightLogDTO[];
}) {
  const today = todayISO();
  const previous = weights.length ? weights[weights.length - 1] : null;
  // Opens on the last reading rather than a blank field: the number moves by a
  // tenth or two, so the common case becomes confirm-and-save. The parent keys
  // this component on `open`, so these initialisers re-run each time it opens
  // and a stale draft never carries over.
  const [weight, setWeight] = useState(previous ? String(previous.weightValue) : "");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);

  const value = Number(weight);
  const valid = Number.isFinite(value) && value > 0;
  // What this entry would replace, which is the previous reading unless you
  // have back-dated the entry past it.
  const comparedTo = previousReading(weights, date);
  const delta = valid ? weightDelta(value, comparedTo) : null;
  const overwrites = weights.some((w) => w.date === date);

  function nudge(by: number) {
    haptic("light");
    setWeight(String(stepWeight(valid ? value : (previous?.weightValue ?? 70), by)));
  }

  async function save() {
    if (!valid) {
      toast.error("Enter a valid weight");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/progress/weight", {
        method: "POST",
        body: JSON.stringify({ date, weightValue: value }),
      });
      haptic("success");
      toast.success(
        delta != null && delta !== 0
          ? `Logged ${value} ${unit} · ${delta > 0 ? "+" : ""}${delta} ${unit}`
          : "Weight logged",
      );
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
          <DialogDescription>One entry per day — logging again replaces it</DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label htmlFor="weight-value">Weight ({unit})</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label={`Down ${WEIGHT_STEP} ${unit}`}
              onClick={() => nudge(-WEIGHT_STEP)}
            >
              <Minus aria-hidden />
            </Button>
            <Input
              id="weight-value"
              type="number"
              inputMode="decimal"
              min={0.1}
              step={WEIGHT_STEP}
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              className="h-11 text-center text-lg font-bold tabular-nums"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label={`Up ${WEIGHT_STEP} ${unit}`}
              onClick={() => nudge(WEIGHT_STEP)}
            >
              <Plus aria-hidden />
            </Button>
          </div>
          <p className="min-h-4 px-1 text-xs text-muted-foreground">
            {comparedTo ? (
              <>
                Last {comparedTo.weightValue} {unit} ·{" "}
                {relativeDayLabel(comparedTo.date, today)}
                {delta != null && delta !== 0 ? (
                  <span
                    className={cn(
                      "ml-1.5 font-semibold",
                      delta < 0 ? "text-[var(--success,var(--primary))]" : "text-[var(--warning)]",
                    )}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta} {unit}
                  </span>
                ) : null}
              </>
            ) : (
              "Your first weigh-in starts the trend line"
            )}
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="weight-date">Date</Label>
          <Input
            id="weight-date"
            type="date"
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value || today)}
            className="h-9 w-full appearance-none text-left"
          />
          <p className="min-h-4 px-1 text-xs text-muted-foreground">
            {overwrites
              ? `Replaces the reading already saved for ${relativeDayLabel(date, today)}`
              : date === today
                ? "Logging for today"
                : `Filling in ${relativeDayLabel(date, today)}`}
          </p>
        </div>

        <Button disabled={busy || !valid} onClick={save}>
          {busy ? (
            <>
              <Spinner data-icon="inline-start" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** The optional circumferences, behind a disclosure so the dialog stays short. */
const EXTRA_GIRTHS = [
  { key: "hip", label: "Hip" },
  { key: "chest", label: "Chest" },
  { key: "arm", label: "Arm" },
  { key: "thigh", label: "Thigh" },
] as const;
type GirthKey = "waist" | "neck" | (typeof EXTRA_GIRTHS)[number]["key"];

function LogMetricsDialog({
  open,
  onOpenChange,
  onLogged,
  heightCm,
  sex,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged: () => void;
  heightCm: number | null;
  sex: BiologicalSexDTO | null;
}) {
  const [bodyFat, setBodyFat] = useState("");
  const [girths, setGirths] = useState<Record<GirthKey, string>>({
    waist: "", neck: "", hip: "", chest: "", arm: "", thigh: "",
  });
  const [showMore, setShowMore] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const num = (key: GirthKey) => (girths[key] ? Number(girths[key]) : null);
  const setGirth = (key: GirthKey, value: string) =>
    setGirths((prev) => ({ ...prev, [key]: value }));

  // Shown live as you type, so you can see the estimate before saving.
  const estimated = navyBodyFatPct({
    sex, heightCm, waistCm: num("waist"), neckCm: num("neck"), hipCm: num("hip"),
  });
  const whtr = waistToHeight(num("waist"), heightCm);

  async function save() {
    const bodyFatPct = bodyFat ? Number(bodyFat) : (estimated ?? undefined);
    const body: Record<string, unknown> = { date: todayISO(), bodyFatPct };
    for (const key of ["waist", "neck", "hip", "chest", "arm", "thigh"] as GirthKey[]) {
      const v = num(key);
      if (v != null) body[`${key}Cm`] = v;
    }
    if (notes.trim()) body.notes = notes.trim();
    if (bodyFatPct == null && Object.keys(body).length === 2) {
      toast.error("Log at least one metric");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/progress/body-metrics", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success("Body metrics logged");
      setBodyFat("");
      setGirths({ waist: "", neck: "", hip: "", chest: "", arm: "", thigh: "" });
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
          <DialogDescription>
            Measure first thing, before eating. Waist at the navel, neck just below
            the larynx.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["waist", "Waist (cm)"],
              ["neck", "Neck (cm)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="number"
                inputMode="decimal"
                min={1}
                step={0.1}
                value={girths[key]}
                onChange={(event) => setGirth(key, event.target.value)}
              />
            </div>
          ))}
        </div>

        {/* What those two measurements imply, before anything is saved. */}
        {estimated != null || whtr ? (
          <div className="space-y-1 rounded-xl bg-muted/60 px-3 py-2 text-sm">
            {estimated != null ? (
              <p>
                Estimated body fat{" "}
                <span className="font-semibold text-primary">{estimated}%</span>
                <span className="text-muted-foreground"> · Navy method, ±3–4%</span>
              </p>
            ) : null}
            {whtr ? (
              <p>
                Waist-to-height{" "}
                <span className="font-semibold text-primary">{whtr.ratio.toFixed(2)}</span>
                <span className="text-muted-foreground"> · {whtr.label}</span>
                {whtr.nextBandCm != null ? (
                  <span className="text-muted-foreground">
                    {" "}— {whtr.nextBandCm} cm reaches the next band
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          className="self-start text-sm font-semibold text-primary"
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "Fewer measurements" : "More measurements (hip, chest, arm, thigh)"}
        </button>
        {showMore ? (
          <div className="animate-fade-up grid grid-cols-2 gap-3">
            {EXTRA_GIRTHS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={key}>{label} (cm)</Label>
                <Input
                  id={key}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={0.1}
                  value={girths[key]}
                  onChange={(event) => setGirth(key, event.target.value)}
                />
              </div>
            ))}
          </div>
        ) : null}

        <div className="space-y-1">
          <Label htmlFor="body-fat">
            Body fat % {estimated != null ? "(leave blank to use the estimate)" : ""}
          </Label>
          <Input
            id="body-fat"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.1}
            placeholder={estimated != null ? String(estimated) : undefined}
            value={bodyFat}
            onChange={(event) => setBodyFat(event.target.value)}
          />
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
          {busy ? (
            <>
              <Spinner data-icon="inline-start" />
              Saving…
            </>
          ) : (
            "Save"
          )}
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
  const [weightChartOpen, setWeightChartOpen] = useState(false);
  const [inspected, setInspected] = useState<string | null>(null);
  const [metricsChartOpen, setMetricsChartOpen] = useState(false);

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
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Consistency</CardTitle>
            </CardHeader>
            <CardContent>
              <LoggedDaysHeatmap
                loggedDates={overview.loggedDates}
                todayISO={todayISO()}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Weight ({overview.weightUnit})</CardTitle>
              <div className="flex items-center gap-1">
                {overview.weights.length > 0 ? (
                  <ExpandChartButton
                    label="Expand weight chart"
                    onClick={() => setWeightChartOpen(true)}
                  />
                ) : null}
                <Button size="sm" variant="secondary" onClick={() => setWeightOpen(true)}>
                  <Plus data-icon="inline-start" aria-hidden />
                  Log
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {overview.weights.length === 0 ? (
                <EmptyState
                  icon={Scale}
                  title="No weight logged yet"
                  body="Log your first weigh-in to start the trend line."
                />
              ) : (
                <>
                  <WeightChart data={overview.weights} unit={overview.weightUnit} />
                  <p className="mt-1 text-center text-[10px] text-muted-foreground">
                    Bold line is your smoothed trend, faint dots are daily readings
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Body metrics</CardTitle>
              <div className="flex items-center gap-1">
                {overview.bodyMetrics.length > 0 ? (
                  <ExpandChartButton
                    label="Expand body metrics chart"
                    onClick={() => setMetricsChartOpen(true)}
                  />
                ) : null}
                <Button size="sm" variant="secondary" onClick={() => setMetricsOpen(true)}>
                  <Plus data-icon="inline-start" aria-hidden />
                  Log
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {overview.bodyMetrics.length === 0 ? (
                <EmptyState
                  icon={Ruler}
                  title="No measurements yet"
                  body="Waist and neck are enough to estimate body fat."
                />
              ) : (
                <>
                  <LatestComposition overview={overview} />
                  <BodyMetricChart
                    metrics={overview.bodyMetrics}
                    weights={overview.weights}
                    heightCm={overview.heightCm}
                    sex={overview.sex}
                    weightUnit={overview.weightUnit}
                  />
                  <ul className="divide-y text-sm">
                    {[...overview.bodyMetrics].reverse().map((metric) => {
                      const parts = [
                        metric.bodyFatPct != null ? `${metric.bodyFatPct}% bf` : null,
                        metric.waistCm != null ? `${metric.waistCm} cm waist` : null,
                        metric.neckCm != null ? `${metric.neckCm} cm neck` : null,
                      ].filter(Boolean);
                      return (
                        <li key={metric.id} className="flex justify-between gap-3 py-2">
                          <span className="text-muted-foreground">{metric.date}</span>
                          <span className="tabular-nums">
                            {parts.length ? parts.join(" · ") : (metric.notes ?? "")}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <LogWeightDialog
        key={weightOpen ? "weigh-in-open" : "weigh-in-closed"}
        open={weightOpen}
        onOpenChange={setWeightOpen}
        onLogged={load}
        unit={overview?.weightUnit ?? "kg"}
        weights={overview?.weights ?? []}
      />
      <LogMetricsDialog
        open={metricsOpen}
        onOpenChange={setMetricsOpen}
        onLogged={load}
        heightCm={overview?.heightCm ?? null}
        sex={overview?.sex ?? null}
      />

      {overview ? (
        <>
          <ExpandedChartSheet
            open={weightChartOpen}
            onOpenChange={(next) => {
              setWeightChartOpen(next);
              if (!next) setInspected(null);
            }}
            title={`Weight (${overview.weightUnit})`}
            subtitle="Tap the chart to inspect a reading. Scroll sideways to reach every one."
          >
            <div className="flex h-full flex-col gap-2">
              <div className="min-h-0 flex-1">
                <WeightChart
                  data={overview.weights}
                  unit={overview.weightUnit}
                  expanded
                  onSelectDate={setInspected}
                  selectedDate={inspected}
                />
              </div>
              <InspectedReading
                reading={
                  inspected
                    ? (overview.weights.find((w) => w.date === inspected) ?? null)
                    : null
                }
                unit={overview.weightUnit}
                onDeleted={() => {
                  setInspected(null);
                  load();
                }}
              />
            </div>
          </ExpandedChartSheet>

          <ExpandedChartSheet
            open={metricsChartOpen}
            onOpenChange={setMetricsChartOpen}
            title="Body metrics"
            subtitle="One measurement at a time — they sit on different scales. Scroll sideways to reach every reading."
          >
            <BodyMetricChart
              metrics={overview.bodyMetrics}
              weights={overview.weights}
              heightCm={overview.heightCm}
              sex={overview.sex}
              weightUnit={overview.weightUnit}
              expanded
            />
          </ExpandedChartSheet>
        </>
      ) : null}
    </main>
  );
}
