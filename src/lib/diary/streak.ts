import { addDaysISO } from "@/lib/dates";

export interface StreakResult {
  /** Consecutive logged days ending today or yesterday. */
  current: number;
  /** Longest consecutive run ever. */
  longest: number;
  todayLogged: boolean;
}

/**
 * MyFitnessPal-style streak: a day counts when it has at least one diary
 * entry. The current streak is the consecutive run ending today — or ending
 * yesterday if today has no entries yet (the streak is only broken once the
 * day is over).
 *
 * @param loggedDates distinct YYYY-MM-DD dates that have entries, any order
 * @param today the user's local date
 */
export function computeStreak(loggedDates: string[], today: string): StreakResult {
  const logged = new Set(loggedDates);
  const todayLogged = logged.has(today);

  let current = 0;
  let cursor = todayLogged ? today : addDaysISO(today, -1);
  while (logged.has(cursor)) {
    current++;
    cursor = addDaysISO(cursor, -1);
  }

  let longest = 0;
  const sorted = [...logged].sort();
  let run = 0;
  let previous: string | null = null;
  for (const date of sorted) {
    run = previous !== null && addDaysISO(previous, 1) === date ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = date;
  }

  return { current, longest, todayLogged };
}
