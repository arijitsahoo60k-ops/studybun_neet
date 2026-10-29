/**
 * Shared catalog of Gemini models the Smart Study Buddy is allowed to use.
 * Grouped by generation so Settings can offer "Auto", "Gemini 3.0 family",
 * or "Gemini 2.0 family" without duplicating model id lists everywhere.
 *
 * Order inside each family is "most capable/current first". The runtime
 * (buddyAI.js) walks this list and only advances to the next model on a
 * 404/400 "model not found / not supported" style response — so if Google
 * renames, deprecates, or regionally restricts one model name, the buddy
 * quietly falls back instead of breaking.
 */

export const GEMINI_3_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3-pro-preview",
  "gemini-3.1-pro-preview",
];

export const GEMINI_2_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-thinking-exp",
  "gemini-2.5-pro",
  "gemini-2.0-pro-exp",
];

/** Every model the buddy knows about, 3.0 family first, 2.0 family as the safety net. */
export const ALL_GEMINI_MODELS = [...GEMINI_3_MODELS, ...GEMINI_2_MODELS];

export const MODEL_FAMILIES = {
  auto: { label: "Auto (recommended)", models: ALL_GEMINI_MODELS },
  gemini3: { label: "Gemini 3.0 family only", models: GEMINI_3_MODELS },
  gemini2: { label: "Gemini 2.0 family only", models: GEMINI_2_MODELS },
};

/** Resolve a stored model-family preference (or a single pinned model id) to a try-list. */
export function resolveModelList(pref) {
  if (!pref || pref === "auto") return MODEL_FAMILIES.auto.models;
  if (MODEL_FAMILIES[pref]) return MODEL_FAMILIES[pref].models;
  // Treat anything else as a single pinned model id — try it first, then fall back to auto.
  return [pref, ...ALL_GEMINI_MODELS.filter((m) => m !== pref)];
}
