/**
 * Recurring activities that are still in force on `today`.
 *
 * An activity is retired by ending it (`effectiveUntil`) rather than deleting
 * it, so past days keep the targets they were planned with: a day's target is
 * re-layered from its activities every time it is read, and editing a row in
 * place would rewrite history. The goal editor only shows what still applies,
 * so a retired row and its replacement never sit side by side there.
 */
export function currentActivities<T extends { effectiveUntil: string | null }>(
  rows: T[],
  today: string,
): T[] {
  return rows.filter((row) => row.effectiveUntil === null || row.effectiveUntil >= today);
}
