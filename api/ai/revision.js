import { getUserFromAuthHeader } from "../_lib/supabaseAdmin.js";
import { geminiComplete } from "../_lib/geminiClient.js";
import { checkRateLimit } from "../_lib/rateLimit.js";

const MAX_PAYLOAD_CHARS = 20_000;

function buildRevisionPrompt(revisions) {
  return `You are the revision-planning engine inside StudyBun, a cozy productivity app for a NEET UG (Indian medical entrance exam) aspirant.
You are given ONLY this user's revision history below — no other study data. Base every suggestion strictly on this list: which
chapters have been revised, how many times, how recently, and which are overdue or never revised. Never invent chapters that
aren't in this data. If the list is too sparse to say anything meaningful, say so plainly instead of guessing.

REVISION HISTORY (each entry: subject, chapter, revision_number, due_date, status):
${JSON.stringify(revisions, null, 2)}

Return ONLY valid JSON (no markdown fences) matching this exact shape:
{
  "summary": "1-2 sentence read on this user's revision pattern (e.g. neglected subjects, overdue clusters, good habits)",
  "suggested_chapters": [
    { "subject": "subject name", "chapter": "chapter name", "reason": "short reason grounded in this specific history (e.g. 'overdue by 5 days', 'never revised a 2nd time', 'last revised 12 days ago')" }
  ]
}
Order suggested_chapters by urgency, most urgent first. Include at most 8 chapters.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ success: false, error: authError || "Not signed in." });

  const rl = checkRateLimit(`revision:${user.id}`, 6);
  if (!rl.ok) return res.status(429).json({ success: false, error: "Too many requests — please wait a moment and try again." });

  const revisions = req.body?.revisions;
  if (!Array.isArray(revisions)) {
    return res.status(400).json({ success: false, error: "Missing or invalid 'revisions' payload." });
  }
  const serialized = JSON.stringify(revisions);
  if (serialized.length > MAX_PAYLOAD_CHARS) {
    return res.status(400).json({ success: false, error: "Revision history payload too large." });
  }

  try {
    const prompt = buildRevisionPrompt(revisions);
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
      error: isNoKeys ? "Revision suggestions aren't configured yet." : "AI service temporarily unavailable.",
      code: err.code,
    });
  }
}
