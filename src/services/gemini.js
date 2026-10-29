import { authedApiPost } from "../lib/apiClient";

/**
 * Calls StudyBun's server-side AI Insights endpoint with the user's real
 * aggregated stats. The server holds the Gemini key and picks/falls back
 * across configured models automatically — see api/ai/insights.js and
 * api/_lib/geminiClient.js.
 * This function must only be invoked from a "Generate AI Insights" click handler —
 * never on a timer, on mount, or in the background.
 */
export async function generateAIInsights(stats) {
  return authedApiPost("/api/ai/insights", { stats });
}

/**
 * Looks exclusively at the user's revision history (nothing else — no sessions,
 * questions, mocks, or backlog) and suggests which chapters to revise next,
 * via StudyBun's server-side endpoint. See api/ai/revision.js.
 * Must only be invoked from a user click — never on a timer, on mount, or in the background.
 */
export async function generateRevisionSuggestions(revisions) {
  return authedApiPost("/api/ai/revision", { revisions });
}
