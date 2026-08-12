type IronLogBodyPayload = {
  date: string; // YYYY-MM-DD
  weightKg?: number;
  bodyFatPct?: number;
  notes?: string;
};

/**
 * Best-effort push of a body measurement to Iron Log. Fires only for the single
 * configured user, is time-bounded, and never throws — a sync failure must never
 * break or slow the user's MacroMap save.
 */
export async function pushToIronLog(
  userId: string,
  payload: IronLogBodyPayload,
): Promise<void> {
  const url = process.env.IRON_LOG_SYNC_URL;
  const secret = process.env.IRON_LOG_SYNC_SECRET;
  const syncUserId = process.env.IRON_LOG_SYNC_USER_ID;
  // Not configured, or not the linked user → no-op.
  if (!url || !secret || !syncUserId || userId !== syncUserId) return;

  // Nothing to sync (e.g. a waist-only body-metric save).
  if (payload.weightKg == null && payload.bodyFatPct == null && payload.notes == null) {
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch {
    // Best-effort: the MacroMap save already succeeded.
  }
}
