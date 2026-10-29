/**
 * Single shared multi-key pool for every Gemini-powered feature in the app —
 * AI Insights, the Revision Planner's AI suggestions (both in gemini.js), and
 * the Smart Study Buddy chat (buddyAI.js). One pool, one env var, used
 * everywhere: no more juggling separate key lists per feature.
 *
 * Set as many keys as you want, comma-separated:
 *   VITE_GEMINI_API_KEYS=key_one,key_two,key_three
 *
 * If that's not set, falls back to a single VITE_GEMINI_API_KEY so
 * everything keeps working with just one key configured.
 *
 * Rotation strategy: round-robin across keys that aren't currently on
 * cooldown/invalid for this page session. Each caller (AI Insights,
 * Revision Planner, Buddy chat) shares the same pointer and cooldown
 * state, so a key that's rate-limited from one feature is correctly
 * skipped by the others too, rather than each feature tracking its own
 * (stale) view of which keys are healthy.
 * - 429 (rate limit / quota) -> key goes on a short cooldown, tried again later.
 * - 400/403 with an API-key-shaped error -> key is marked invalid for this
 *   session (it's a bad key — no point retrying it until you fix .env).
 */

const RATE_LIMIT_COOLDOWN_MS = 60 * 1000; // 1 minute

function parseKeys() {
  const raw = import.meta.env.VITE_GEMINI_API_KEYS?.trim();
  const single = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  const list = raw
    ? raw.split(",").map((k) => k.trim()).filter(Boolean)
    : (single && !single.includes("YOUR-GEMINI") ? [single] : []);
  return list.map((key, i) => ({
    id: `gemini_key_${i}`,
    label: `Key ${i + 1}`,
    key,
    status: "unknown", // unknown | ok | rate_limited | invalid
    disabledUntil: 0,
    lastError: null,
  }));
}

// Module-level state, shared by every importer — resets on page reload,
// which is fine: it's just short-lived rotation/cooldown bookkeeping.
const KEYS = parseKeys();
let ptr = 0;

export function getKeys() {
  return KEYS;
}

export function hasUsableKeys() {
  const now = Date.now();
  return KEYS.some((k) => k.status !== "invalid" && k.disabledUntil < now);
}

/** Ordered list of keys to attempt this call, round-robin starting after the last-used pointer. */
export function getRotationOrder() {
  const now = Date.now();
  const usable = KEYS.filter((k) => k.status !== "invalid" && k.disabledUntil < now);
  if (usable.length === 0) return [];
  const start = ptr % usable.length;
  return [...usable.slice(start), ...usable.slice(0, start)];
}

export function advancePointer() {
  const usable = KEYS.filter((k) => k.status !== "invalid");
  if (usable.length === 0) return;
  ptr = (ptr + 1) % usable.length;
}

export function markKeySuccess(id) {
  const k = KEYS.find((k) => k.id === id);
  if (k) { k.status = "ok"; k.disabledUntil = 0; k.lastError = null; }
}

export function markKeyRateLimited(id) {
  const k = KEYS.find((k) => k.id === id);
  if (k) { k.status = "rate_limited"; k.disabledUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS; k.lastError = "Rate limited — cooling down briefly."; }
}

export function markKeyInvalid(id, message) {
  const k = KEYS.find((k) => k.id === id);
  if (k) { k.status = "invalid"; k.lastError = message || "Key rejected by Gemini."; }
}

export function markKeyError(id, message) {
  const k = KEYS.find((k) => k.id === id);
  if (k) k.lastError = message || "Request failed.";
}
