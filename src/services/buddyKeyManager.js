import { authedApiGet } from "../lib/apiClient";

/**
 * Key management for every Gemini-powered feature now lives entirely
 * server-side (api/_lib/geminiClient.js) — the client no longer holds,
 * parses, or rotates API keys at all. This file now only holds:
 *  - the Buddy's model-family preference (not a secret — a UI choice)
 *  - a cached, non-secret "is the server configured?" status used to
 *    drive the Settings/BuddyGuide readiness UI.
 */

const MODEL_PREF_STORAGE = "studybun_buddy_model_pref";

export function getModelPreference() {
  try {
    return localStorage.getItem(MODEL_PREF_STORAGE) || "auto";
  } catch {
    return "auto";
  }
}

export function setModelPreference(pref) {
  try {
    localStorage.setItem(MODEL_PREF_STORAGE, pref || "auto");
  } catch {
    /* ignore */
  }
}

// Optimistic default before the first successful status check completes —
// avoids flashing a "not set up" state on every load while the request is
// in flight. Corrected as soon as /api/ai/status responds.
let cachedStatus = { geminiReady: true, groqReady: true };

export function getCachedAIStatus() {
  return cachedStatus;
}

/** Fetches the server's (non-secret) AI-configuration status and updates the cache. */
export async function fetchAIStatus() {
  const data = await authedApiGet("/api/ai/status");
  if (data) cachedStatus = data;
  return cachedStatus;
}

/** Convenience wrapper used by the Buddy chat UI specifically. */
export async function hasUsableKeys() {
  const status = await fetchAIStatus();
  return Boolean(status.geminiReady);
}
