/** One macro line of a day summary: what was eaten against the day's target. */
export interface SummaryStat {
  key: "calories" | "proteinG" | "carbsG" | "fatG";
  label: string;
  actual: number;
  target: number | null;
}

/**
 * The saved end-of-day summary (diary_days.analysis_json). Every number in the
 * text is computed from the day's entries; the AI pass only rewords it.
 */
export interface DaySummary {
  version: 2;
  date: string;
  generatedAt: string;
  source: "ai" | "rules";
  /**
   * Entry count + totals + target at generation time. When the diary no longer
   * matches, the summary is stale and gets regenerated.
   */
  fingerprint: string;
  /** One-line verdict on the day. */
  headline: string;
  /** 0–100 adherence to the day's targets; null without a goal. */
  score: number | null;
  stats: SummaryStat[];
  /** How the day compares with the user's recent days, when there's history. */
  trend: string | null;
  wins: string[];
  improve: string[];
  tomorrow: string[];
}
