"use client";

import { ArrowRight, CheckCircle2, TrendingUp, TriangleAlert } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";
import type { DaySummary } from "@/types/summary";

function scoreTone(score: number): string {
  if (score >= 85) return "bg-primary/15 text-primary";
  if (score >= 65) return "bg-warning/15 text-warning";
  return "bg-destructive/15 text-destructive";
}

function Stat({ stat }: { stat: DaySummary["stats"][number] }) {
  const unit = stat.key === "calories" ? "" : " g";
  const pct = stat.target ? Math.round((stat.actual / stat.target) * 100) : null;
  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs text-muted-foreground">{stat.label}</p>
      <p className="text-sm font-semibold tabular-nums">
        {stat.actual.toLocaleString("en-US")}
        {unit}
        {stat.target != null ? (
          <span className="font-normal text-muted-foreground">
            {" "}
            / {stat.target.toLocaleString("en-US")}
          </span>
        ) : null}
      </p>
      {pct != null ? (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className={cn(
              "h-full rounded-full",
              Math.abs(pct - 100) <= 10 ? "bg-primary" : "bg-warning",
            )}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  lines,
  icon: Icon,
  iconClass,
}: {
  title: string;
  lines: string[];
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  iconClass: string;
}) {
  if (lines.length === 0) return null;
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <ul className="space-y-1.5">
        {lines.map((line, index) => (
          <li key={index} className="flex gap-2 text-sm leading-snug">
            <Icon className={cn("mt-0.5 size-4 shrink-0", iconClass)} aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The end-of-day summary: verdict, macro line, then wins / fixes / tomorrow. */
export function DaySummaryView({ summary }: { summary: DaySummary }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        {summary.score != null ? (
          <div
            className={cn(
              "flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl",
              scoreTone(summary.score),
            )}
            aria-label={`Day score ${summary.score} out of 100`}
          >
            <span className="text-lg leading-none font-extrabold tabular-nums">
              {summary.score}
            </span>
            <span className="text-[0.625rem] leading-none opacity-80">score</span>
          </div>
        ) : null}
        <p className="text-base leading-snug font-semibold">{summary.headline}</p>
      </div>

      <div className="flex gap-3 rounded-xl bg-muted/50 p-3">
        {summary.stats.map((stat) => (
          <Stat key={stat.key} stat={stat} />
        ))}
      </div>

      {summary.trend ? (
        <p className="flex gap-2 text-xs text-muted-foreground">
          <TrendingUp className="mt-px size-3.5 shrink-0" aria-hidden />
          {summary.trend}
        </p>
      ) : null}

      <Section title="What went well" lines={summary.wins} icon={CheckCircle2} iconClass="text-primary" />
      <Section title="What to fix" lines={summary.improve} icon={TriangleAlert} iconClass="text-warning" />
      <Section title="Tomorrow" lines={summary.tomorrow} icon={ArrowRight} iconClass="text-primary" />
    </div>
  );
}
