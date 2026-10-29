/**
 * Server-side Groq client for the Smart Notification pipeline.
 *
 * Everything here runs on Vercel, never in the browser — keys are read from
 * plain server env vars (no VITE_ prefix, so Vite never inlines them into
 * the client bundle).
 *
 *   GROQ_API_KEYS=key_one,key_two,key_three     (comma-separated, preferred)
 *   GROQ_API_KEY=key_one                        (fallback if only one key)
 *
 * MULTI-KEY ROTATION
 * Round-robin across every key that isn't currently on cooldown/invalid.
 * - 429 (rate limit)      -> key cools down for 60s, tried again later.
 * - 401/403 (bad key)     -> key marked invalid for this process lifetime.
 * - 404/400 (model gone)  -> NOT a key problem — try the next model on the
 *                            SAME key before rotating keys.
 * Serverless functions are stateless between cold starts, so this state is
 * "best effort" — it still helps a lot across the many warm invocations a
 * function sees during a burst (e.g. a cron job fanning out to hundreds of
 * users in one run).
 *
 * MODEL COMPATIBILITY — "all new models", automatically
 * Rather than hard-coding one model name (which breaks the day Groq
 * deprecates it), this fetches Groq's live model catalog from
 * GET /openai/v1/models, filters it down to models actually suited to
 * short JSON-generation tasks (drops audio/TTS/moderation-only models),
 * and orders it by a preference list of keywords — newest/most-capable
 * families first. Any model Groq adds in the future that matches a known
 * family slots in automatically; anything totally new still gets tried
 * (just lower priority). If the catalog fetch itself fails (network hiccup),
 * a hard-coded fallback list keeps things working.
 */

const GROQ_BASE = "https://api.groq.com/openai/v1";
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;
const MODEL_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — plenty fresh, avoids hammering /models

// Preference order — keyword-matched against live model ids, most-capable/
// newest first. Update this list over time; worst case an unmatched model
// still gets tried, just after the ones we recognize.
const PREFERRED_MODEL_KEYWORDS = [
  "gpt-oss-120b",
  "gpt-oss-20b",
  "kimi-k2",
  "qwen3.6",
  "qwen3",
  "llama-3.3-70b",
  "llama-4-maverick",
  "llama-4-scout",
  "llama-3.1-8b",
  "gemma2",
  "deepseek-r1-distill",
];

// Never use these for notification-copy generation even if returned by the
// catalog: audio (whisper/tts), safety-classifier, and agentic "compound"
// system models don't fit a single short JSON completion call.
const EXCLUDE_PATTERNS = [/whisper/i, /tts/i, /guard/i, /safeguard/i, /^compound/i, /moderation/i];

const HARD_FALLBACK_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "moonshotai/kimi-k2-instruct-0905",
  "qwen/qwen3-32b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
];

function parseKeys() {
  const raw = (process.env.GROQ_API_KEYS || "").trim();
  const single = (process.env.GROQ_API_KEY || "").trim();
  const list = raw ? raw.split(",").map((k) => k.trim()).filter(Boolean) : single ? [single] : [];
  return list.map((key, i) => ({
    id: `groq_srv_key_${i}`,
    label: `Server Key ${i + 1}`,
    key,
    status: "unknown", // unknown | ok | rate_limited | invalid
    disabledUntil: 0,
    lastError: null,
  }));
}

// Module-level state persists across warm invocations of the same lambda
// instance (helpful), and resets cleanly on cold start (harmless).
const KEYS = parseKeys();
let ptr = 0;
let modelCache = { list: null, fetchedAt: 0 };

export function hasUsableKeys() {
  const now = Date.now();
  return KEYS.some((k) => k.status !== "invalid" && k.disabledUntil < now);
}

function getRotationOrder() {
  const now = Date.now();
  const usable = KEYS.filter((k) => k.status !== "invalid" && k.disabledUntil < now);
  if (usable.length === 0) return [];
  const start = ptr % usable.length;
  return [...usable.slice(start), ...usable.slice(0, start)];
}

function advancePointer() {
  const usable = KEYS.filter((k) => k.status !== "invalid");
  if (usable.length === 0) return;
  ptr = (ptr + 1) % usable.length;
}

function markKeySuccess(id) {
  const k = KEYS.find((k) => k.id === id);
  if (k) { k.status = "ok"; k.disabledUntil = 0; k.lastError = null; }
}
function markKeyRateLimited(id) {
  const k = KEYS.find((k) => k.id === id);
  if (k) { k.status = "rate_limited"; k.disabledUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS; k.lastError = "Rate limited — cooling down."; }
}
function markKeyInvalid(id, message) {
  const k = KEYS.find((k) => k.id === id);
  if (k) { k.status = "invalid"; k.lastError = message || "Key rejected by Groq."; }
}
function markKeyError(id, message) {
  const k = KEYS.find((k) => k.id === id);
  if (k) k.lastError = message || "Request failed.";
}

function classifyError(err) {
  if (err.status === 429) return "rate_limited";
  if (err.status === 401 || err.status === 403) return "invalid_key";
  if (err.status === 404 || err.status === 400) return "model_unavailable";
  return "other";
}

function scoreModel(id) {
  const idx = PREFERRED_MODEL_KEYWORDS.findIndex((kw) => id.toLowerCase().includes(kw));
  return idx === -1 ? PREFERRED_MODEL_KEYWORDS.length : idx;
}

/** Fetches + caches Groq's live model catalog, ordered by preference. Falls back to a hard-coded list on any failure. */
async function getModelsToTry() {
  const now = Date.now();
  if (modelCache.list && now - modelCache.fetchedAt < MODEL_CACHE_TTL_MS) {
    return modelCache.list;
  }

  const rotation = getRotationOrder();
  const probeKey = rotation[0]?.key;
  if (!probeKey) return dedupeWithConfigured(HARD_FALLBACK_MODELS);

  try {
    const res = await fetch(`${GROQ_BASE}/models`, {
      headers: { Authorization: `Bearer ${probeKey}` },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    const ids = (data?.data || [])
      .map((m) => m.id)
      .filter((id) => id && !EXCLUDE_PATTERNS.some((re) => re.test(id)));

    if (ids.length === 0) throw new Error("empty catalog");

    const ordered = ids.sort((a, b) => scoreModel(a) - scoreModel(b));
    const list = dedupeWithConfigured(ordered);
    modelCache = { list, fetchedAt: now };
    return list;
  } catch {
    // Network hiccup / bad probe key — don't cache a failure, just fall back for this call.
    return dedupeWithConfigured(HARD_FALLBACK_MODELS);
  }
}

function dedupeWithConfigured(list) {
  const configured = (process.env.GROQ_MODEL || "").trim();
  const merged = configured ? [configured, ...list.filter((m) => m !== configured)] : list;
  return [...new Set(merged)];
}

async function callGroq(model, apiKey, { systemPrompt, userPrompt, temperature, jsonMode }) {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: userPrompt },
      ],
      temperature: temperature ?? 0.6,
      max_tokens: 700,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Groq request failed (${res.status}): ${text || res.statusText}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned no content.");
  return { content, model };
}

/**
 * Runs a single chat completion, rotating across every usable key and, per
 * key, across the live/ordered model list — so a deprecated or renamed
 * model on Groq's end never takes the whole feature down.
 *
 * Returns { content, model, keyLabel }. Throws if every key/model
 * combination fails (caller should fall back to a template notification,
 * never leave the user with nothing).
 */
export async function groqComplete({ systemPrompt, userPrompt, temperature, jsonMode = true }) {
  if (!hasUsableKeys()) {
    const e = new Error("No Groq API key configured on the server (GROQ_API_KEYS / GROQ_API_KEY).");
    e.code = "no_keys";
    throw e;
  }

  const models = await getModelsToTry();
  const rotation = getRotationOrder();
  let lastError;

  for (const keyEntry of rotation) {
    let modelUnavailableCount = 0;
    for (const model of models) {
      try {
        const out = await callGroq(model, keyEntry.key, { systemPrompt, userPrompt, temperature, jsonMode });
        markKeySuccess(keyEntry.id);
        return { ...out, keyLabel: keyEntry.label };
      } catch (err) {
        lastError = err;
        const kind = classifyError(err);
        if (kind === "model_unavailable") { modelUnavailableCount++; continue; }
        if (kind === "rate_limited") { markKeyRateLimited(keyEntry.id); break; }
        if (kind === "invalid_key") { markKeyInvalid(keyEntry.id, err.message); break; }
        markKeyError(keyEntry.id, err.message);
        break;
      }
    }
    if (modelUnavailableCount === models.length) {
      markKeyError(keyEntry.id, "No usable Groq model responded on this key.");
    }
  }

  advancePointer();
  const e = new Error(lastError ? lastError.message : "All Groq keys/models failed.");
  e.code = "all_failed";
  throw e;
}

export function getKeyPoolStatus() {
  return KEYS.map(({ key, ...rest }) => rest); // never leak raw keys, even to server logs by accident
}
