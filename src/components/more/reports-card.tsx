"use client";

import { Download, FileText } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/client/fetcher";
import { addDaysISO, todayISO, weekStartISO } from "@/lib/dates";

interface WeeklySummaryPayload {
  summary: {
    daysLogged: number;
    averages: { calories: number; proteinG: number };
    weightChange: number | null;
  };
}

export function ReportsCard() {
  const [summary, setSummary] = useState<WeeklySummaryPayload["summary"] | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const from30 = addDaysISO(todayISO(), -29);
  const to = todayISO();

  useEffect(() => {
    apiFetch<WeeklySummaryPayload>(
      `/api/reports/weekly?weekStart=${weekStartISO(todayISO())}`,
    )
      .then((data) => setSummary(data.summary))
      .catch(() => setSummaryError(true));
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">This week</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl bg-muted/60 p-3 text-sm">
          {summaryError ? (
            <p className="text-muted-foreground">Weekly summary unavailable</p>
          ) : !summary ? (
            <p className="text-muted-foreground">Loading summary...</p>
          ) : (
            <p>
              {summary.daysLogged} days logged · avg{" "}
              {Math.round(summary.averages.calories)} kcal ·{" "}
              {Math.round(summary.averages.proteinG)} g protein
              {summary.weightChange != null
                ? ` · weight ${summary.weightChange > 0 ? "+" : ""}${summary.weightChange}`
                : ""}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" asChild>
            <a href={`/api/reports/export.csv?from=${from30}&to=${to}`} download>
              <Download data-icon="inline-start" aria-hidden />
              CSV, 30 days
            </a>
          </Button>
          <Button variant="outline" className="flex-1" asChild>
            <a href={`/api/reports/export.pdf?from=${from30}&to=${to}`} download>
              <FileText data-icon="inline-start" aria-hidden />
              PDF, 30 days
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
