/** Local-timezone date as YYYY-MM-DD (the diary is keyed by the user's day). */
export function todayISO(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export function addDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatDisplayDate(date: string): string {
  if (date === todayISO()) return "Today";
  if (date === addDaysISO(todayISO(), -1)) return "Yesterday";
  if (date === addDaysISO(todayISO(), 1)) return "Tomorrow";
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "14:05" → "2:05 PM"; passes through anything not HH:MM. */
export function formatClock(hhmm: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) return hhmm;
  const hour = Number(match[1]);
  const period = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${match[2]} ${period}`;
}

/** Monday of the week containing the given date. */
export function weekStartISO(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  return addDaysISO(date, -dow);
}

/**
 * "today" / "yesterday" / "3 days ago" / an absolute date past a week. Used
 * where a logged entry needs context ("you last weighed in …") and a bare
 * YYYY-MM-DD would make the reader do the arithmetic.
 */
export function relativeDayLabel(date: string, today: string): string {
  if (date === today) return "today";
  if (date === addDaysISO(today, -1)) return "yesterday";
  if (date === addDaysISO(today, 1)) return "tomorrow";
  const days = daysBetweenISO(date, today);
  if (days > 1 && days <= 7) return `${days} days ago`;
  if (days < -1 && days >= -7) return `in ${-days} days`;
  return formatDisplayDate(date);
}

/** Whole days from `date` to `today` — positive when `date` is in the past. */
export function daysBetweenISO(date: string, today: string): number {
  const a = Date.parse(`${date}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
