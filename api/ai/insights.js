import { getUserFromAuthHeader } from "../_lib/supabaseAdmin.js";
import { geminiComplete } from "../_lib/geminiClient.js";
import { checkRateLimit } from "../_lib/rateLimit.js";

const MAX_PAYLOAD_CHARS = 20_000; // generous for a stats snapshot, bounded against abuse

function buildInsightsPrompt(stats) {
  return `You are the analysis engine inside StudyBun, a cozy productivity app for a NEET UG (Indian medical entrance exam — Biology [Botany & Zoology], Physics, Chemistry, and optional Mathematics) aspirant.
Analyze ONLY the real data below. Never invent numbers. Never give generic motivational quotes — every sentence must reference
something specific from the data. If a section has no relevant data, say so plainly instead of guessing.

DATA:
${JSON.stringify(stats, null, 2)}

Return ONLY valid JSON (no markdown fences) matching this exact shape:
{
  "going_well": ["short data-backed observation", "..."],
  "needs_attention": ["short data-backed observation", "..."],
  "top_priorities": ["actionable next step", "..."],
  "performance_trends": "1-3 sentence summary of trend direction across study hours, questions, and mocks",
  "recommended_chapters": ["chapter name to focus on next, based on backlog/weightage", "..."],
  "backlog_strategy": "1-3 sentence concrete plan to reduce backlog given the pending counts",
  "mock_suggestions": "1-3 sentence note on mock performance and what to change next attempt (or 'not enough mock data yet')",
  "revision_advice": "1-3 sentence note on overdue/upcoming revisions",
  "productivity_tips": ["short, specific tip tied to the data", "..."],
  "predictions": {
    "estimated_syllabus_completion": "date estimate or 'not enough data'",
    "estimated_backlog_completion": "date estimate or 'not enough data'",
    "confidence": "low | medium | high",
    "reasoning": "one sentence on why this confidence level"
  }
}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ success: false, error: authError || "Not signed in." });

  const rl = checkRateLimit(`insights:${user.id}`, 6);
  if (!rl.ok) return res.status(429).json({ success: false, error: "Too many requests — please wait a moment and try again." });

  const stats = req.body?.stats;
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
    return res.status(400).json({ success: false, error: "Missing or invalid 'stats' payload." });
  }
  const serialized = JSON.stringify(stats);
  if (serialized.length > MAX_PAYLOAD_CHARS) {
    return res.status(400).json({ success: false, error: "Stats payload too large." });
  }

  try {
    const prompt = buildInsightsPrompt(stats);
    const { text } = await geminiComplete({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
    });

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ success: false, error: "AI returned malformed data. Try regenerating." });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    const isNoKeys = err.code === "no_keys";
    return res.status(isNoKeys ? 503 : 502).json({
      success: false,
      error: isNoKeys ? "AI Insights aren't configured yet." : "AI service temporarily unavailable.",
      code: err.code,
    });
  }
}
