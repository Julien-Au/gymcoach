// ============================================================
// In-memory fixed-window rate limiter
// ============================================================
// Lightweight protection for auth endpoints on a single-process self-hosted
// deployment. Not shared across instances; for a multi-instance deployment,
// back this with Redis instead.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

// Allows `limit` calls per `windowMs` for a given key. `now` is injectable for
// deterministic tests.
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  if (bucket.count < limit) {
    bucket.count += 1;
    return { ok: true, retryAfterSec: 0 };
  }
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
}

// Best-effort client IP from common proxy headers (the app runs behind a
// reverse proxy in production).
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip') ?? 'unknown';
}

// Test helper: clears all buckets.
export function resetRateLimits(): void {
  buckets.clear();
}
