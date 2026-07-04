import { describe, expect, it } from "vitest";

import { reportToCsv } from "@/lib/reports/csv-generator";
import { buildWeeklySummary, type ReportData } from "@/lib/reports/data";
import type { BodyMetricLog, WeightLog } from "@/lib/db/schema";

function weight(date: string, value: number): WeightLog {
  return { id: `w-${date}`, userId: "u1", date, weightValue: value };
}

const sampleData: ReportData = {
  from: "2026-06-29",
  to: "2026-07-05",
  days: [
    {
      date: "2026-06-29",
      totals: { calories: 2000, proteinG: 150, carbsG: 200, fatG: 60 },
      entries: [
        {
          mealName: "Lunch",
          label: 'Sandwich, "The Big One"',
          quantity: 1,
          nutrition: { calories: 2000, proteinG: 150, carbsG: 200, fatG: 60 },
        },
      ],
    },
    {
      date: "2026-06-30",
      totals: { calories: 1800, proteinG: 130, carbsG: 180, fatG: 55 },
      entries: [
        {
          mealName: "Dinner",
          label: "Chicken,\nrice",
          quantity: 2,
          nutrition: { calories: 1800, proteinG: 130, carbsG: 180, fatG: 55 },
        },
      ],
    },
    {
      date: "2026-07-01",
      totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      entries: [],
    },
  ],
  weights: [weight("2026-06-29", 84.0), weight("2026-07-05", 83.2)],
  bodyMetrics: [
    {
      id: "b1",
      userId: "u1",
      date: "2026-07-01",
      bodyFatPct: 20,
      waistCm: 85,
      notes: null,
    } as BodyMetricLog,
  ],
};

describe("buildWeeklySummary", () => {
  it("averages only days with entries", () => {
    const summary = buildWeeklySummary(sampleData);
    expect(summary.daysLogged).toBe(2);
    expect(summary.averages.calories).toBe(1900);
    expect(summary.averages.proteinG).toBe(140);
  });

  it("computes weight change from first to last log", () => {
    const summary = buildWeeklySummary(sampleData);
    expect(summary.weightChange).toBe(-0.8);
  });

  it("handles empty data", () => {
    const summary = buildWeeklySummary({
      from: "2026-06-29",
      to: "2026-07-05",
      days: [],
      weights: [],
      bodyMetrics: [],
    });
    expect(summary.daysLogged).toBe(0);
    expect(summary.averages.calories).toBe(0);
    expect(summary.weightChange).toBeNull();
  });
});

describe("reportToCsv", () => {
  const csv = reportToCsv(sampleData);
  const lines = csv.trim().split("\n");

  it("starts with the header row", () => {
    expect(lines[0].startsWith("record_type,date,meal,item")).toBe(true);
  });

  it("escapes quotes and newlines in labels", () => {
    expect(csv).toContain('"Sandwich, ""The Big One"""');
    expect(csv).toContain('"Chicken,\nrice"');
  });

  it("includes day totals, weights, and body metrics", () => {
    expect(lines.filter((l) => l.startsWith("day_total,")).length).toBe(3);
    expect(lines.filter((l) => l.startsWith("weight,")).length).toBe(2);
    expect(lines.filter((l) => l.startsWith("body_metric,")).length).toBe(1);
  });
});
