import type { ReportData } from "./data";

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function row(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(",");
}

/**
 * Single CSV with a `record_type` discriminator so diary entries, weight logs,
 * and body metrics export together and stay spreadsheet-friendly.
 */
export function reportToCsv(data: ReportData): string {
  const lines: string[] = [
    row([
      "record_type",
      "date",
      "meal",
      "item",
      "quantity",
      "calories",
      "protein_g",
      "carbs_g",
      "fat_g",
      "fiber_g",
      "sugar_g",
      "sat_fat_g",
      "sodium_mg",
      "weight",
      "body_fat_pct",
      "waist_cm",
      "notes",
    ]),
  ];

  for (const day of data.days) {
    for (const entry of day.entries) {
      lines.push(
        row([
          "diary_entry",
          day.date,
          entry.mealName,
          entry.label,
          entry.quantity,
          entry.nutrition.calories,
          entry.nutrition.proteinG,
          entry.nutrition.carbsG,
          entry.nutrition.fatG,
          entry.nutrition.fiberG,
          entry.nutrition.sugarG,
          entry.nutrition.satFatG,
          entry.nutrition.sodiumMg,
          null,
          null,
          null,
          null,
        ]),
      );
    }
    lines.push(
      row([
        "day_total",
        day.date,
        null,
        null,
        null,
        day.totals.calories,
        day.totals.proteinG,
        day.totals.carbsG,
        day.totals.fatG,
        day.totals.fiberG,
        day.totals.sugarG,
        day.totals.satFatG,
        day.totals.sodiumMg,
        null,
        null,
        null,
        null,
      ]),
    );
  }

  for (const weight of data.weights) {
    lines.push(
      row([
        "weight",
        weight.date,
        ...Array(11).fill(null),
        weight.weightValue,
        null,
        null,
        null,
      ]),
    );
  }

  for (const metric of data.bodyMetrics) {
    lines.push(
      row([
        "body_metric",
        metric.date,
        ...Array(11).fill(null),
        null,
        metric.bodyFatPct,
        metric.waistCm,
        metric.notes,
      ]),
    );
  }

  return lines.join("\n") + "\n";
}
