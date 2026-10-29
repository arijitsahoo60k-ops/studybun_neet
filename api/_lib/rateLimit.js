/**
 * Best-effort, in-memory per-key rate limiter for the AI endpoints.
 *
 * Serverless functions don't share memory across instances, so this only
 * throttles requests hitting the same warm lambda instance — it is not a
 * substitute for a real distributed limiter (Redis/Upstash) at large scale.
 * For a personal/small-audience deployment (this project doesn't already
 * depend on an external store) it's enough to blunt accidental loops and
 * casual abuse of quota-limited third-party AI calls without adding new
 * infrastructure.
 */

const WINDOW_MS = 60 * 1000;
const buckets = new Map(); // key -> { count, windowStart }

/**
 * Returns { ok: true } if the caller is within `limit` requests per rolling
 * minute for this key, or { ok: false, retryAfterMs } otherwise.
 */
export function checkRateLimit(key, limit = 8) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterMs: WINDOW_MS - (now - bucket.windowStart) };
  }
  return { ok: true };
}
