import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { ApiError } from "@/lib/api";

const LIMITS = {
  diaryWrite: { tokens: 100, window: "1 h" },
  foodCreate: { tokens: 20, window: "1 h" },
  barcodeLookup: { tokens: 10, window: "1 m" },
  aiParse: { tokens: 20, window: "1 h" },
} as const;

export type RateLimitKind = keyof typeof LIMITS;

const limiters = new Map<RateLimitKind, Ratelimit>();

function getLimiter(kind: RateLimitKind): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null; // No Redis configured (local dev) — skip limiting.
  }
  let limiter = limiters.get(kind);
  if (!limiter) {
    const { tokens, window } = LIMITS[kind];
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(tokens, window),
      prefix: `macromap:${kind}`,
    });
    limiters.set(kind, limiter);
  }
  return limiter;
}

export async function enforceRateLimit(kind: RateLimitKind, userId: string) {
  const limiter = getLimiter(kind);
  if (!limiter) return;
  const { success } = await limiter.limit(userId);
  if (!success) {
    throw new ApiError("rate_limited", "Too many requests, try again later", 429);
  }
}
