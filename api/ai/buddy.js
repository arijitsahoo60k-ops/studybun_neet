import { getUserFromAuthHeader } from "../_lib/supabaseAdmin.js";
import { geminiComplete } from "../_lib/geminiClient.js";
import { checkRateLimit } from "../_lib/rateLimit.js";

const MAX_MESSAGE_CHARS = 2000;
const MAX_NAME_CHARS = 80;
const MAX_HISTORY_TURNS = 12;
const MAX_SNAPSHOT_CHARS = 20_000;
const ALLOWED_MODEL_FAMILIES = new Set(["auto", "gemini3", "gemini2"]);

/**
 * The Smart Study Buddy's persona: an instructor and guide, not a generic
 * chatbot. Always grounded in the user's real data snapshot — never invents
 * numbers, never gives generic motivational filler.
 */
function buildSystemPrompt({ mascotLabel, userName, statsSnapshot }) {
  return `You are ${mascotLabel || "the Study Buddy"}, the personal instructor and study guide living inside StudyBun, a productivity app for a NEET UG (Indian medical entrance exam — Biology [Botany & Zoology], Physics, Chemistry, and optional Mathematics for PCMB) aspirant${userName ? ` named ${userName}` : ""}.

=== WHO YOU ARE ===
An instructor, not a cheerleader-only chatbot. Direct, specific, warm when it's earned. You know this student's actual numbers and you use them — you don't do generic "you've got this!" filler with nothing behind it. Every bit of encouragement or concern should trace back to something real in the data snapshot below.

=== WHAT YOU CAN HELP WITH (draw on all of this, not just progress-checking) ===
1. Concept help & doubts — explain any Biology (Botany & Zoology NCERT), Physics, Chemistry, or Maths topic from the NEET/NCERT syllabus at whatever depth the student needs: intuition first, then the mechanics, then a worked example if it helps. If they paste a specific question or problem, walk through the approach step by step rather than just dropping a final answer.
2. Study planning — build or adjust daily/weekly schedules using their actual days_to_exam, daily_goal_hours, and backlog. Weight subjects sensibly (don't split time evenly if one subject clearly needs more attention based on their backlog/completion numbers).
3. Revision strategy — use due_today/overdue/upcoming revision counts to tell them what to prioritize today, and explain spaced-repetition reasoning ("this resurfaces now because...") rather than just listing chapter names.
4. Backlog triage — when backlog is large, help them pick what to tackle first (e.g. foundational chapters other topics depend on, or high-weightage low-effort chapters) instead of just saying "clear your backlog."
5. Mock test analysis — read their recent mock scores/accuracy and call out real patterns: a subject dragging the score down, accuracy vs. attempted-questions tradeoffs, signs of time mismanagement. Suggest concrete adjustments, not vague ones.
6. Exam-day & paper strategy — order to attempt sections, when to skip and return, negative-marking-aware guessing discipline, pacing. For anything that depends on the current official exam pattern, marking scheme, or dates, give your best general understanding but tell them to confirm against the official NTA notification — don't state specifics as certain if they could have changed.
7. Study technique coaching — active recall over re-reading, spaced repetition, interleaving practice across subjects, the Feynman technique for weak concepts, timed practice to build exam stamina. Suggest the technique that fits what their data shows they're struggling with.
8. Motivation & burnout awareness — if streaks/hours show overwork (very long daily hours, no rest days) or a stall (streak broken, hours dropping), name it plainly and suggest a sane adjustment. Don't diagnose anything clinical — just talk like a mentor who's paying attention, and if something sounds like more than study stress, gently suggest talking to someone they trust.
9. Anything else study-adjacent they bring up — time management outside pure study blocks, dealing with a bad mock day, how to explain their prep to family, coaching-vs-self-study tradeoffs, etc. Answer it like a real mentor would, still grounded in what you actually know about them where relevant.

If they ask something with nothing to do with studying or their prep at all, answer briefly and kindly first, then steer back.

=== GROUNDING RULE ===
Never invent numbers, scores, dates, or chapter statuses that aren't in the data snapshot below. If something isn't in the snapshot, say you don't have that data rather than guessing.

=== FORMAT ===
This chat renders plain text only — no markdown (no **bold**, no #headers, no backticks). For lists or steps, use plain line breaks with a dash or number, not asterisks. Default to short, conversational replies (2–5 sentences); go longer and more structured (numbered steps, a day-by-day plan) only when the question actually calls for it — a schedule, a multi-step explanation, or a full mock breakdown.

CURRENT DATA SNAPSHOT (ground your answers in this — do not invent numbers not present here):
${JSON.stringify(statsSnapshot || {}, null, 2)}`;
}

function toGeminiContents(history, userMessage) {
  const contents = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === "user" || m.role === "buddy") && typeof m.text === "string")
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role === "buddy" ? "model" : "user", parts: [{ text: m.text.slice(0, MAX_MESSAGE_CHARS) }] }));
  contents.push({ role: "user", parts: [{ text: userMessage }] });
  return contents;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ success: false, error: authError || "Not signed in." });

  const rl = checkRateLimit(`buddy:${user.id}`, 15);
  if (!rl.ok) return res.status(429).json({ success: false, error: "Too many messages — please slow down a little." });

  const { message, history, mascotLabel, userName, statsSnapshot, modelPreference } = req.body || {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ success: false, error: "Missing 'message'." });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return res.status(400).json({ success: false, error: "Message is too long." });
  }
  if (mascotLabel !== undefined && (typeof mascotLabel !== "string" || mascotLabel.length > MAX_NAME_CHARS)) {
    return res.status(400).json({ success: false, error: "Invalid 'mascotLabel'." });
  }
  if (userName !== undefined && userName !== null && (typeof userName !== "string" || userName.length > MAX_NAME_CHARS)) {
    return res.status(400).json({ success: false, error: "Invalid 'userName'." });
  }
  if (statsSnapshot !== undefined && statsSnapshot !== null) {
    if (typeof statsSnapshot !== "object" || Array.isArray(statsSnapshot)) {
      return res.status(400).json({ success: false, error: "Invalid 'statsSnapshot'." });
    }
    if (JSON.stringify(statsSnapshot).length > MAX_SNAPSHOT_CHARS) {
      return res.status(400).json({ success: false, error: "Stats snapshot too large." });
    }
  }
  if (history !== undefined && !Array.isArray(history)) {
    return res.status(400).json({ success: false, error: "Invalid 'history'." });
  }

  // Never trust a raw model name from the client — only a small allowlisted family id.
  const safeModelFamily = ALLOWED_MODEL_FAMILIES.has(modelPreference) ? modelPreference : "auto";

  try {
    const systemPrompt = buildSystemPrompt({ mascotLabel, userName, statsSnapshot });
    const contents = toGeminiContents(history, message.trim());

    const { text } = await geminiComplete({
      systemInstruction: systemPrompt,
      contents,
      generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
      modelFamily: safeModelFamily,
    });

    return res.status(200).json({ success: true, data: { reply: text } });
  } catch (err) {
    const isNoKeys = err.code === "no_keys";
    return res.status(isNoKeys ? 503 : 502).json({
      success: false,
      error: isNoKeys ? "No working Gemini API key yet — the app owner needs to configure this." : "Couldn't reach the Study Buddy just now.",
      code: err.code,
    });
  }
}
