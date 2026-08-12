"use client";

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

import type { ProgressOverviewDTO, WeightLogDTO } from "@/types/api";

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
const GRID = { stroke: "var(--border)", strokeOpacity: 0.5 };

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
export function WeightChart({ data, unit = "" }: { data: WeightLogDTO[]; unit?: string }) {
  const rows = withTrend(data);
  const suffix = unit ? ` ${unit}` : "";
  return (
    <div className="h-48" role="img" aria-label="Weight trend">
      <ResponsiveContainer>
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
            interval="preserveStartEnd"
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
            dot={{ r: 2.5, fill: "var(--muted-foreground)", strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
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
