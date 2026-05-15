/**
 * Sliding-window rate limiter, in-memory per process.
 *
 * Good enough for a single dev server, a single-instance deploy, or a small
 * fleet where each instance independently throttling is acceptable. For a
 * cleanly distributed limit across many lambdas, swap the underlying store
 * for Upstash Redis or Vercel KV (same interface).
 *
 * Records per key are pruned both lazily on each call and periodically by a
 * background sweeper, so the map can't grow unbounded under sustained load.
 */

type Window = number[]; // request timestamps within the window

const buckets = new Map<string, Window>();

const SWEEP_INTERVAL_MS = 60_000;
const SWEEP_RETENTION_MS = 60 * 60_000; // drop entries older than 1h

// Background sweeper. Only initialized once; uses unref so it doesn't keep
// the process alive in tests / scripts. Guarded for non-Node environments.
let sweeperStarted = false;
function ensureSweeper() {
  if (sweeperStarted) return;
  sweeperStarted = true;
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of buckets) {
      const cutoff = now - SWEEP_RETENTION_MS;
      const fresh = ts.filter((t) => t > cutoff);
      if (fresh.length === 0) buckets.delete(key);
      else if (fresh.length !== ts.length) buckets.set(key, fresh);
    }
  }, SWEEP_INTERVAL_MS);
  if (typeof interval.unref === "function") interval.unref();
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number; limit: number; windowMs: number };

/**
 * Sliding-window rate check. Returns { allowed: true } and records the hit,
 * or { allowed: false, retryAfterMs } if the caller has exceeded the limit.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  ensureSweeper();
  const now = Date.now();
  const cutoff = now - windowMs;
  const existing = buckets.get(key);
  const fresh = existing ? existing.filter((t) => t > cutoff) : [];

  if (fresh.length >= limit) {
    const oldest = fresh[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    buckets.set(key, fresh);
    return { allowed: false, retryAfterMs, limit, windowMs };
  }

  fresh.push(now);
  buckets.set(key, fresh);
  return { allowed: true };
}

/**
 * Extract the client IP from common proxy headers, falling back to "unknown"
 * so unidentifiable clients still share a single bucket (still rate-limited,
 * just collectively).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
