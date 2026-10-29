"use client";

import { Maximize2 } from "lucide-react";
import { useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { bodyComposition, navyBodyFatPct } from "@/lib/body/composition";
import { cn } from "@/lib/utils";
import type {
  BodyMetricLogDTO,
  ProgressOverviewDTO,
  WeightLogDTO,
} from "@/types/api";

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
const GRID = { stroke: "var(--border)", strokeOpacity: 0.5 };

/**
 * A trend chart renders at two sizes. In a card it is a glanceable 192px strip.
 * Expanded it fills the sheet and, crucially, guarantees each reading at least
 * `PX_PER_POINT` of horizontal room — three months of daily weigh-ins are only
 * a few pixels apart in a phone-width card, which is what makes individual
 * points impossible to hit. Past that width the chart scrolls sideways rather
 * than compressing further.
 */
const PX_PER_POINT = 46;

interface ChartSize {
  /** Tailwind height class for the plot area. */
  heightClass: string;
  /** Radius of a plotted reading, and of the one under the finger. */
  dotR: number;
  activeDotR: number;
  /** Expanded charts label every reading; cards label only the ends. */
  tickInterval: "preserveStartEnd" | 0;
}

export function chartSize(expanded: boolean): ChartSize {
  return expanded
    ? { heightClass: "h-full", dotR: 4, activeDotR: 8, tickInterval: 0 }
    : { heightClass: "h-48", dotR: 2.5, activeDotR: 4, tickInterval: "preserveStartEnd" };
}

/**
 * Minimum plot width needed for `points` readings to stay individually
 * reachable. Zero means "no minimum" — let ResponsiveContainer fill its parent,
 * which is what a card-sized chart always wants.
 */
export function plotMinWidth(expanded: boolean, points: number): number {
  if (!expanded || points <= 0) return 0;
  return points * PX_PER_POINT;
}

/**
 * Wraps the plot so an expanded chart can overflow horizontally. The inner
 * width is only forced when the points would otherwise be closer together than
 * a fingertip; otherwise it stays 100% and ResponsiveContainer behaves normally.
 */
function PlotArea({
  expanded,
  points,
  label,
  children,
}: {
  expanded: boolean;
  points: number;
  label: string;
  children: React.ReactElement;
}) {
  const { heightClass } = chartSize(expanded);
  const minWidth = plotMinWidth(expanded, points);
  return (
    <div
      className={cn(heightClass, expanded && "overflow-x-auto overflow-y-hidden")}
      role="img"
      aria-label={label}
    >
      <div className="h-full" style={minWidth ? { minWidth } : undefined}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

const tooltipContentStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

/** 14-day calories (gradient bars) with the day's goal as a dashed reference line. */
export function CalorieHistoryChart({
  data,
}: {
  data: ProgressOverviewDTO["calorieHistory"];
}) {
  const rows = data.map((row) => ({ ...row, label: dayLabel(row.date) }));
  return (
    <div className="h-48" role="img" aria-label="Calories per day for the last 14 days">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="calBars" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={1} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} {...GRID} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            interval={3}
          />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            formatter={(value, name) => [
              `${Math.round(Number(value ?? 0))} kcal`,
              name === "calories" ? "Eaten" : "Goal",
            ]}
          />
          <Bar
            dataKey="calories"
            fill="url(#calBars)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
          <Line
            dataKey="goal"
            stroke="var(--chart-4)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Exponentially-weighted trend weight — the smoothed signal under daily noise. */
function withTrend(data: WeightLogDTO[], alpha = 0.25) {
  let ema: number | null = null;
  return data.map((row) => {
    ema = ema == null ? row.weightValue : alpha * row.weightValue + (1 - alpha) * ema;
    return {
      label: dayLabel(row.date),
      weight: row.weightValue,
      trend: Math.round(ema * 10) / 10,
    };
  });
}

/** Weight: faint raw readings plus a bold trend line (the number that matters). */
export function WeightChart({
  data,
  unit = "",
  expanded = false,
}: {
  data: WeightLogDTO[];
  unit?: string;
  expanded?: boolean;
}) {
  const rows = withTrend(data);
  const suffix = unit ? ` ${unit}` : "";
  const size = chartSize(expanded);
  return (
    <PlotArea expanded={expanded} points={rows.length} label="Weight trend">
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="weightTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} {...GRID} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            interval={size.tickInterval}
            angle={expanded ? -35 : 0}
            textAnchor={expanded ? "end" : "middle"}
            height={expanded ? 52 : 30}
          />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={tooltipContentStyle}
            formatter={(value, name) => [
              `${value ?? ""}${suffix}`,
              name === "trend" ? "Trend" : "Logged",
            ]}
          />
          <Area
            dataKey="trend"
            stroke="var(--primary)"
            strokeWidth={2.5}
            fill="url(#weightTrend)"
            dot={false}
            connectNulls
          />
          <Line
            dataKey="weight"
            stroke="var(--muted-foreground)"
            strokeOpacity={0.55}
            strokeWidth={1.5}
            dot={{ r: size.dotR, fill: "var(--muted-foreground)", strokeWidth: 0 }}
            activeDot={{ r: size.activeDotR }}
          />
      </ComposedChart>
    </PlotArea>
  );
}

type MetricKey = "waist" | "bodyFat" | "lean";

const METRIC_SERIES: Array<{ key: MetricKey; label: string }> = [
  { key: "waist", label: "Waist" },
  { key: "bodyFat", label: "Body fat" },
  { key: "lean", label: "Lean mass" },
];

/** The most recent weight on or before `date`, so a measurement taken on a day
 *  with no weigh-in still has something to compute lean mass against. */
export function weightOnOrBefore(weights: WeightLogDTO[], date: string): number | null {
  let best: WeightLogDTO | null = null;
  for (const w of weights) {
    if (w.date <= date && (!best || w.date > best.date)) best = w;
  }
  return best?.weightValue ?? null;
}

/**
 * Body measurements over time. Waist (cm), body fat (%) and lean mass (kg) are
 * on incompatible scales, so one is plotted at a time rather than crowded onto
 * a shared axis. Body fat falls back to the Navy estimate when it was not
 * entered, and lean mass needs a weight to divide, so a series only appears
 * when it has at least two points to draw a line between.
 */
export function BodyMetricChart({
  metrics,
  weights,
  heightCm,
  sex,
  weightUnit,
  expanded = false,
}: {
  metrics: BodyMetricLogDTO[];
  weights: WeightLogDTO[];
  heightCm: number | null;
  sex: ProgressOverviewDTO["sex"];
  weightUnit: string;
  expanded?: boolean;
}) {
  const rows = metrics.map((m) => {
    const bodyFat =
      m.bodyFatPct ??
      navyBodyFatPct({
        sex,
        heightCm,
        waistCm: m.waistCm,
        neckCm: m.neckCm,
        hipCm: m.hipCm,
      });
    const split = bodyComposition(weightOnOrBefore(weights, m.date), bodyFat);
    return {
      label: dayLabel(m.date),
      waist: m.waistCm,
      bodyFat,
      lean: split?.leanKg ?? null,
    };
  });

  const available = METRIC_SERIES.filter(
    (s) => rows.filter((r) => r[s.key] != null).length >= 2,
  );
  const [active, setActive] = useState<MetricKey>(available[0]?.key ?? "waist");
  // Keep the selection valid as measurements arrive and series appear.
  const selected = available.some((s) => s.key === active) ? active : available[0]?.key;

  if (!selected) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Log a measurement on two different days to see a trend.
      </p>
    );
  }

  const suffix = selected === "waist" ? " cm" : selected === "bodyFat" ? "%" : ` ${weightUnit}`;
  const seriesLabel = METRIC_SERIES.find((s) => s.key === selected)!.label;

  const size = chartSize(expanded);

  return (
    <div className={cn("space-y-2", expanded && "flex h-full flex-col")}>
      {available.length > 1 ? (
        <div className="flex shrink-0 gap-1" role="tablist" aria-label="Measurement">
          {available.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={s.key === selected}
              onClick={() => setActive(s.key)}
              className={cn(
                "min-h-8 rounded-lg px-2.5 text-xs font-semibold transition-colors",
                s.key === selected
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className={cn(expanded && "min-h-0 flex-1")}>
        <PlotArea
          expanded={expanded}
          points={rows.length}
          label={`${seriesLabel} trend`}
        >
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="bodyMetricTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} {...GRID} />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              interval={size.tickInterval}
              angle={expanded ? -35 : 0}
              textAnchor={expanded ? "end" : "middle"}
              height={expanded ? 52 : 30}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={tooltipContentStyle}
              formatter={(value) => [`${value ?? ""}${suffix}`, seriesLabel]}
            />
            <Area
              dataKey={selected}
              stroke="var(--primary)"
              strokeWidth={2.5}
              fill="url(#bodyMetricTrend)"
              dot={{ r: size.dotR, fill: "var(--primary)", strokeWidth: 0 }}
              activeDot={{ r: size.activeDotR }}
              connectNulls
            />
          </ComposedChart>
        </PlotArea>
      </div>
    </div>
  );
}

/**
 * Full-screen wrapper for a trend chart. The card view is a glance; this is
 * for reading individual points, so it hands the chart the whole viewport and
 * lets it scroll sideways when the readings are dense.
 */
export function ExpandedChartSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92dvh] max-w-[calc(100%-1rem)] flex-col gap-3 p-4 sm:max-w-2xl">
        <DialogHeader className="shrink-0 text-left">
          <DialogTitle className="text-base">{title}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

/** The button that opens it — paired with the "Log" action in a card header. */
export function ExpandChartButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <Button size="sm" variant="ghost" aria-label={label} onClick={onClick}>
      <Maximize2 aria-hidden />
    </Button>
  );
}

function cellISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WEEKS = 12;

/**
 * GitHub-style consistency grid — 12 weeks × 7 days, one cell per day, filled
 * when that day had at least one logged entry. Columns are weeks (Sun→Sat).
 */
export function LoggedDaysHeatmap({
  loggedDates,
  todayISO,
}: {
  loggedDates: string[];
  todayISO: string;
}) {
  const logged = new Set(loggedDates);
  const end = new Date(`${todayISO}T00:00:00`);
  // Extend to the Saturday of the current week so the grid ends on a week edge.
  const lastCell = new Date(end);
  lastCell.setDate(end.getDate() + (6 - end.getDay()));

  const total = WEEKS * 7;
  // Chronological order → 7 consecutive days per week, so grid-flow-col fills
  // each column as one Sun→Sat week.
  const cells = Array.from({ length: total }, (_, i) => {
    const d = new Date(lastCell);
    d.setDate(lastCell.getDate() - (total - 1 - i));
    const iso = cellISO(d);
    return { iso, logged: logged.has(iso), future: iso > todayISO };
  });

  const loggedCount = cells.filter((c) => c.logged).length;

  return (
    <div>
      <div
        className="grid auto-cols-fr grid-flow-col grid-rows-7 gap-1"
        role="img"
        aria-label={`${loggedCount} days logged in the last 12 weeks`}
      >
        {cells.map((c) => (
          <div
            key={c.iso}
            title={c.future ? undefined : `${c.iso}${c.logged ? " · logged" : ""}`}
            className="aspect-square w-full rounded-[3px]"
            style={{
              backgroundColor: c.future
                ? "transparent"
                : c.logged
                  ? "var(--primary)"
                  : "var(--muted)",
              opacity: c.future ? 0 : c.logged ? 1 : 0.6,
            }}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        {loggedCount} of the last 84 days logged
      </p>
    </div>
  );
}
