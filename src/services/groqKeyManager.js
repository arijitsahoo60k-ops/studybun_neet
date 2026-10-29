/**
 * Multi-key system for the Groq-powered "Smart AI Comparison" on the Mock
 * Tests page — configured by the app owner (you), not the end user. Keys
 * live in your .env / host env vars, the same way VITE_GEMINI_BUDDY_API_KEYS
 * already works for the Smart Study Buddy. There is no in-app UI for users
 * to type in their own keys.
 *
 * Groq's free tier is generous but still rate-limited per key, so set as
 * many keys as you want, comma-separated:
 *   VITE_GROQ_API_KEYS=key_one,key_two,key_three
 *
 * If that's not set, it falls back to a single VITE_GROQ_API_KEY.
 *
 * Rotation strategy: round-robin across keys that aren't currently on
 * cooldown/invalid for this page session.
 * - 429 (rate limit / quota) -> key goes on a short cooldown, tried again later.
 * - 401/403 (bad key) -> key is marked invalid for this session (no point
 *   retrying it until you fix .env).
 */

const RATE_LIMIT_COOLDOWN_MS = 60 * 1000; // 1 minute

function parseKeys() {
  const raw = import.meta.env.VITE_GROQ_API_KEYS?.trim();
  const single = import.meta.env.VITE_GROQ_API_KEY?.trim();
  const list = raw
    ? raw.split(",").map((k) => k.trim()).filter(Boolean)
    : (single && !single.includes("YOUR-GROQ") ? [single] : []);
  return list.map((key, i) => ({
    id: `groq_key_${i}`,
    label: `Key ${i + 1}`,
    key,
    status: "unknown", // unknown | ok | rate_limited | invalid
    disabledUntil: 0,
    lastError: null,
  }));
}

// Module-level state — resets on page reload, which is fine: it's just
// short-lived rotation/cooldown bookkeeping, not anything that needs to persist.
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
  if (k) { k.status = "invalid"; k.lastError = message || "Key rejected by Groq."; }
}

export function markKeyError(id, message) {
  const k = KEYS.find((k) => k.id === id);
  if (k) k.lastError = message || "Request failed.";
}
