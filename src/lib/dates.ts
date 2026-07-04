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

/** Monday of the week containing the given date. */
export function weekStartISO(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  return addDaysISO(date, -dow);
}
