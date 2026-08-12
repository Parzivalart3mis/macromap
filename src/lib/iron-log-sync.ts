type IronLogBodyPayload = {
  date: string; // YYYY-MM-DD
  weightKg?: number;
  bodyFatPct?: number;
  notes?: string;
};

type IronLogNutritionPayload = {
  date: string; // YYYY-MM-DD
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
};

/**
 * Best-effort POST to an Iron Log integration endpoint. Fires only for the
 * single configured user, is time-bounded, and never throws — a sync failure
 * must never break or slow the caller.
 */
async function postToIronLog(
  path: "body" | "nutrition",
  userId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const base = process.env.IRON_LOG_SYNC_BASE;
  const secret = process.env.IRON_LOG_SYNC_SECRET;
  const syncUserId = process.env.IRON_LOG_SYNC_USER_ID;
  // Not configured, or not the linked user → no-op.
  if (!base || !secret || !syncUserId || userId !== syncUserId) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(`${base}/${path}`, {
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
    // Best-effort: the originating save already succeeded.
  }
}

/** Mirror a body measurement (weight / body fat / notes) to Iron Log on save. */
export async function pushToIronLog(
  userId: string,
  payload: IronLogBodyPayload,
): Promise<void> {
  if (payload.weightKg == null && payload.bodyFatPct == null && payload.notes == null) return;
  await postToIronLog("body", userId, payload);
}

/** Mirror a day's finalized macro totals to Iron Log (daily cron). */
export async function pushNutritionToIronLog(
  userId: string,
  payload: IronLogNutritionPayload,
): Promise<void> {
  if (
    payload.calories == null &&
    payload.proteinG == null &&
    payload.carbsG == null &&
    payload.fatG == null
  ) {
    return;
  }
  await postToIronLog("nutrition", userId, payload);
}
