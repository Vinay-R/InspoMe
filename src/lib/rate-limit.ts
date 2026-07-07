import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/env";

// Lazy singleton — only created when Upstash creds are present.
let _rl: Ratelimit | null = null;

// Warn loudly (but only once per process) when rate limiting is disabled in
// production — a silent no-op limiter is an easy misconfiguration to miss.
let warnedDisabled = false;

function getRatelimiter(): Ratelimit | null {
  if (_rl) return _rl;
  const url = serverEnv.upstashRedisRestUrl;
  const token = serverEnv.upstashRedisRestToken;
  if (!url || !token) return null;
  _rl = new Ratelimit({
    redis: new Redis({ url, token }),
    // 10 saves or retries per user per hour, sliding window.
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "inspome:rl",
  });
  return _rl;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Epoch ms when the limit resets (undefined when Upstash not configured). */
  resetAt?: number;
}

/**
 * Check whether `userId` is within the per-user save/retry quota.
 * Falls back to "allow" when Upstash is not configured (local dev / CI).
 */
export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  const rl = getRatelimiter();
  if (!rl) {
    if (!warnedDisabled && serverEnv.isProduction) {
      warnedDisabled = true;
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting is DISABLED in production. All requests are allowed.",
      );
    }
    return { allowed: true };
  }

  try {
    const { success, reset } = await rl.limit(userId);
    return { allowed: success, resetAt: reset };
  } catch (e) {
    // Explicit decision: fail OPEN on Upstash outages. Saves are low-risk and
    // an unavailable rate limiter must not turn every save into a 500.
    console.error("[rate-limit] Upstash check failed — failing open", e);
    return { allowed: true };
  }
}
