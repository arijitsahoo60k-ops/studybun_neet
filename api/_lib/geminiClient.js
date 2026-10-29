/**
 * Server-side Gemini client for AI Insights, the Revision Planner's AI
 * suggestions, and the Smart Study Buddy chat.
 *
 * Everything here runs on Vercel, never in the browser — keys are read from
 * plain server env vars (no VITE_ prefix, so Vite never inlines them into
 * the client bundle).
 *
 *   GEMINI_API_KEYS=key_one,key_two,key_three   (comma-separated, preferred)
 *   GEMINI_API_KEY=key_one                      (fallback if only one key)
 *   GEMINI_MODEL=                               (optional — pin a specific model)
 *
 * MULTI-KEY ROTATION
 * Round-robin across every key that isn't currently on cooldown/invalid,
 * same strategy as api/_lib/groqClient.js:
 * - 429 (rate limit / quota) -> key cools down for 60s, tried again later.
 * - 400/403 with an API-key-shaped error -> key marked invalid for this
 *   process lifetime.
 * - 404 / "limit: 0" 429 (model unavailable on this key) -> NOT a key
 *   problem — try the next model on the SAME key before rotating keys.
 * Serverless functions are stateless between cold starts, so this state is
 * "best effort" — it still helps across the many warm invocations a
 * function sees in a burst.
 *
 * The model catalog itself is reused from the client-side, non-secret
 * src/services/geminiModels.js (just labels/ids — no keys), so there's one
 * source of truth for "which Gemini models exist" shared between the
 * Settings model-family picker and this server client.
 */

import { MODEL_FAMILIES, ALL_GEMINI_MODELS } from "../../src/services/geminiModels.js";

const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;

function parseKeys() {
  const raw = (process.env.GEMINI_API_KEYS || "").trim();
  const single = (process.env.GEMINI_API_KEY || "").trim();
  const list = raw ? raw.split(",").map((k) => k.trim()).filter(Boolean) : single ? [single] : [];
  return list.map((key, i) => ({
    id: `gemini_srv_key_${i}`,
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
  if (k) { k.status = "invalid"; k.lastError = message || "Key rejected by Gemini."; }
}
function markKeyError(id, message) {
  const k = KEYS.find((k) => k.id === id);
  if (k) k.lastError = message || "Request failed.";
}

function classifyError(err) {
  if (err.status === 429) {
    // "limit: 0" means this specific model has NO free-tier quota on this
    // key at all — permanent for this model, not temporary. Move on to the
    // next model on the SAME key instead of benching the whole key.
    const raw = err.raw || "";
    if (/"limit"\s*:\s*0\b/.test(raw)) return "model_unavailable";
    return "rate_limited";
  }
  if (err.status === 400 || err.status === 403) {
    const raw = (err.raw || "").toLowerCase();
    if (raw.includes("api key") || raw.includes("api_key") || err.status === 403) return "invalid_key";
    return "bad_request";
  }
  if (err.status === 404) return "model_unavailable";
  return "other";
}

/**
 * Resolves a model try-list from a small allowlisted "family" id rather than
 * trusting a caller-supplied model name — keeps callers from pinning an
 * arbitrary/expensive model via the request body.
 */
function resolveModels(modelFamily) {
  const configured = (process.env.GEMINI_MODEL || "").trim();
  const base = modelFamily && MODEL_FAMILIES[modelFamily] ? MODEL_FAMILIES[modelFamily].models : ALL_GEMINI_MODELS;
  return configured ? [configured, ...base.filter((m) => m !== configured)] : base;
}

async function callGemini(model, apiKey, { systemInstruction, contents, generationConfig }) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(systemInstruction ? { system_instruction: { parts: [{ text: systemInstruction }] } } : {}),
        contents,
        generationConfig: generationConfig || { temperature: 0.6, maxOutputTokens: 1024 },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Gemini request failed (${res.status})`);
    err.status = res.status;
    err.raw = text;
    throw err;
  }

  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("");
  if (!reply) {
    const blockReason = data?.promptFeedback?.blockReason;
    throw new Error(blockReason ? `Gemini declined to respond (${blockReason}).` : "Gemini returned an empty response.");
  }
  return { text: reply.trim(), model };
}

/**
 * Runs one Gemini generateContent call, rotating across every usable server
 * key and, per key, across the resolved model list — only advancing to the
 * next key/model when the failure is clearly key- or model-specific.
 *
 * `contents` follows Gemini's chat-turn shape: [{ role, parts: [{ text }] }].
 * For single-shot JSON generation, pass a single-turn contents array.
 * `modelFamily` is an optional allowlisted id ("auto" | "gemini3" | "gemini2")
 * — never a raw model name from the caller.
 *
 * Returns { text, model, keyLabel }. Throws (with `.code`) if every
 * key/model combination fails.
 */
export async function geminiComplete({ systemInstruction, contents, generationConfig, modelFamily }) {
  if (!hasUsableKeys()) {
    const e = new Error("No Gemini API key configured on the server (GEMINI_API_KEYS / GEMINI_API_KEY).");
    e.code = "no_keys";
    throw e;
  }

  const models = resolveModels(modelFamily);
  const rotation = getRotationOrder();
  let lastError;

  for (const keyEntry of rotation) {
    let modelUnavailableCount = 0;
    for (const model of models) {
      try {
        const out = await callGemini(model, keyEntry.key, { systemInstruction, contents, generationConfig });
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
      markKeyError(keyEntry.id, "No configured Gemini model is available on this key.");
    }
  }

  advancePointer();
  const e = new Error(lastError ? lastError.message : "All Gemini keys/models failed.");
  e.code = "all_failed";
  throw e;
}

export function getKeyPoolStatus() {
  return KEYS.map(({ key, ...rest }) => rest); // never leak raw keys, even to server logs by accident
}
