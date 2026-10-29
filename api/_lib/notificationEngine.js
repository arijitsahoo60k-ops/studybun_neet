import { groqComplete } from "./groqClient.js";

const SLOT_BRIEF = {
  morning: "It's morning. The student is about to start their study day. Help them see, at a glance, what today actually needs from them.",
  afternoon: "It's early-mid afternoon. The student has likely already studied some today (or hasn't started yet). This is a check-in nudge, not a fresh plan.",
  evening: "It's evening, the study day is winding down. Reflect on today briefly and point them at tomorrow's most important pending item (a revision, an overdue task, or backlog).",
  test: "This is a one-off test notification the student triggered themselves from Settings to confirm notifications are working.",
};

// "Check-in" = a row in accountability_goals for today (Community page's
// daily accountability feature, see src/hooks/useAccountability.js) — a
// student posts a goal for the day, then later marks it
// completed/partial/missed. This is separate from study_sessions/timer_sessions.

function buildSystemPrompt() {
  return `You are the notification-writing engine inside StudyBun, a cozy productivity app for a NEET UG (Indian medical entrance exam) aspirant. You write ONE short push notification, 3 times a day, grounded entirely in real data about this specific student's day — never generic motivational filler, never invented numbers.

RULES:
- Ground every claim in the DATA JSON given to you. If a field is null/0/empty, don't fabricate around it — either skip that angle or say so plainly.
- Be specific: name the actual subject/chapter/task/count when you have one, not "your tasks" or "your revisions".
- Tone: warm, direct, like a sharp study buddy who's actually paying attention — never guilt-trippy, never hollow hype ("You've got this! 💪" with nothing behind it is bad).
- Vary the angle by time of day (see the SLOT context you're given) — don't just restate a to-do list three times a day.
- If there is genuinely nothing notable today (no tasks, no revisions, low urgency), it's fine to send something light — acknowledge the calm, don't invent urgency.
- CHECK-IN handling (data fields: has_checked_in_today, checkins_today_count, checkins_open_count, checkins_completed_count, checkins_open_sample): a "check-in" is a daily goal the student posts on the Community page, then later marks done. If has_checked_in_today is false, and this isn't the very first morning ping, it's fair game to nudge them to post today's check-in — but don't force it into every single notification if something more pressing (overdue revisions, due tasks) is happening. If has_checked_in_today is true and checkins_open_count > 0, they've posted a goal but never closed it out — remind them to go mark it done/partial (name the actual goal text from checkins_open_sample if present) rather than telling them to "check in" again. If checkins_open_count is 0 and checkins_completed_count > 0, they're fully wrapped up on check-ins — don't nag about it.
- title: max 45 characters. body: max 110 characters. Both plain text, no markdown, no emoji spam (0-1 emoji max, only if it fits naturally).
- deep_link must be exactly one of: "dashboard", "planner", "revision", "backlog", "analytics", "goals", "community" — pick whichever page this notification is actually about. Use "community" for check-in prompts/reminders.

Return ONLY valid JSON, no markdown fences, matching exactly:
{"title": "...", "body": "...", "deep_link": "dashboard"}`;
}

function buildUserPrompt(slot, context) {
  return `SLOT: ${slot}
${SLOT_BRIEF[slot] || ""}

DATA:
${JSON.stringify(context, null, 2)}`;
}

function sanitize(title, body) {
  const t = String(title || "").trim().slice(0, 60);
  const b = String(body || "").trim().slice(0, 140);
  return { title: t, body: b };
}

const VALID_LINKS = new Set(["dashboard", "planner", "revision", "backlog", "analytics", "goals", "community"]);

/** Rule-based, always-available fallback — used only if the AI call fails outright. Never leaves the user with nothing. */
function fallbackNotification(slot, ctx) {
  const name = ctx.student_name ? `${ctx.student_name}, ` : "";

  if (ctx.revisions_overdue_count > 0) {
    return {
      title: "Revisions are piling up",
      body: `${name}${ctx.revisions_overdue_count} revision${ctx.revisions_overdue_count > 1 ? "s" : ""} overdue. A quick pass today keeps them from stacking further.`,
      deep_link: "revision",
    };
  }
  if (slot === "morning" && ctx.tasks_due_today_count > 0) {
    return {
      title: "Today's plan is ready",
      body: `${name}${ctx.tasks_due_today_count} task${ctx.tasks_due_today_count > 1 ? "s" : ""} lined up for today. First one first.`,
      deep_link: "planner",
    };
  }
  // Already posted a check-in but never closed it out — remind them to
  // mark it, don't tell them to "check in" again.
  if (ctx.checkins_open_count > 0) {
    const goal = ctx.checkins_open_sample?.[0]?.text;
    return {
      title: "Close out today's check-in",
      body: goal
        ? `${name}your check-in "${goal}" is still open. Mark it done (or partial) when you wrap up.`
        : `${name}you've got an open check-in from earlier — mark it done or partial when you wrap up.`,
      deep_link: "community",
    };
  }
  // Hasn't posted a check-in yet today — nudge for afternoon/evening only,
  // morning gets a fresh planning ping instead (handled above/below).
  if (!ctx.has_checked_in_today && slot !== "morning") {
    return {
      title: "Post today's check-in",
      body: `${name}you haven't logged a check-in yet today. Post today's goal on Community so others can see you're in.`,
      deep_link: "community",
    };
  }
  if (slot === "evening" && ctx.study_minutes_today < 30) {
    return {
      title: "Day's not over yet",
      body: `${name}not much logged today — even a focused 25-minute session moves the needle.`,
      deep_link: "dashboard",
    };
  }
  if (ctx.backlog_open_count > 0) {
    return {
      title: "Backlog check-in",
      body: `${name}${ctx.backlog_open_count} item${ctx.backlog_open_count > 1 ? "s" : ""} sitting in backlog. Pick one small thing to clear.`,
      deep_link: "backlog",
    };
  }
  return {
    title: "StudyBun check-in",
    body: `${name}quiet day on the data — good moment to plan tomorrow or squeeze in revision.`,
    deep_link: "dashboard",
  };
}

/**
 * Generates one notification for one user/slot. Always resolves — on any
 * AI failure it silently falls back to the rule-based generator, so a
 * flaky key/model never means the user gets nothing. Returns
 * { title, body, deep_link, model, source }.
 */
export async function generateNotification(slot, context) {
  try {
    const { content, model } = await groqComplete({
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt(slot, context),
      temperature: 0.7,
      jsonMode: true,
    });

    const parsed = JSON.parse(content);
    const { title, body } = sanitize(parsed.title, parsed.body);
    const deep_link = VALID_LINKS.has(parsed.deep_link) ? parsed.deep_link : "dashboard";
    if (!title || !body) throw new Error("AI returned empty title/body");

    return { title, body, deep_link, model, source: "ai" };
  } catch {
    const fb = fallbackNotification(slot, context);
    return { ...fb, model: null, source: "fallback" };
  }
}
