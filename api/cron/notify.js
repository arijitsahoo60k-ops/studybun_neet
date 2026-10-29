import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { buildUserContext } from "../_lib/buildUserContext.js";
import { generateNotification } from "../_lib/notificationEngine.js";
import { sendPush } from "../_lib/webPush.js";
import { todayIST } from "../../src/lib/dateIST.js";

// Actual duration cap is set in vercel.json ("functions" → maxDuration), so
// it stays in one place. Default there is 60s (Hobby-plan safe). If you're
// on Pro and have a large user base, raise both that value and
// TIME_BUDGET_MS below together.
const VALID_SLOTS = new Set(["morning", "afternoon", "evening"]);
const CONCURRENCY = 6;
const TIME_BUDGET_MS = 50 * 1000; // leave headroom under a 60s function limit

function isAuthorized(req) {
  // Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on real
  // cron invocations once CRON_SECRET is set as an env var — this rejects
  // anyone who just guesses the URL. Manual/admin testing can pass the same
  // secret as ?secret=... instead of a header.
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured — allow (dev-only situation, document this)
  const header = req.headers.authorization || "";
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(req.url, "http://localhost");
  return url.searchParams.get("secret") === secret;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = [];
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function processUser(admin, userId, slot, sendDate) {
  // Hard guard against double-sends even if the cron fires twice for any reason.
  const { data: already } = await admin
    .from("notification_log")
    .select("id")
    .eq("user_id", userId).eq("slot", slot).eq("send_date", sendDate)
    .maybeSingle();
  if (already) return { userId, status: "skipped_already_sent" };

  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", userId);
  if (!subs || subs.length === 0) return { userId, status: "skipped_no_subs" };

  const context = await buildUserContext(admin, userId);
  const notif = await generateNotification(slot, context);

  const results = await Promise.all(
    subs.map(async (sub) => {
      const res = await sendPush(sub, {
        title: notif.title,
        body: notif.body,
        page: notif.deep_link,
        slot,
      });
      if (!res.ok && res.expired) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      }
      return res;
    })
  );

  const anySent = results.some((r) => r.ok);

  await admin.from("notification_log").insert({
    user_id: userId,
    slot,
    send_date: sendDate,
    title: notif.title,
    body: notif.body,
    model_used: notif.model,
    status: anySent ? (notif.source === "ai" ? "sent" : "ai_failed_used_fallback") : "error",
    error: anySent ? null : "All push sends failed for this user's subscriptions.",
  }).select().maybeSingle().catch(() => {}); // unique-constraint races are fine to swallow

  return { userId, status: anySent ? "sent" : "error" };
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const url = new URL(req.url, "http://localhost");
  const slot = url.searchParams.get("slot");
  if (!VALID_SLOTS.has(slot)) {
    return res.status(400).json({ error: `Missing/invalid ?slot= (expected one of ${[...VALID_SLOTS].join(", ")})` });
  }

  const admin = getSupabaseAdmin();
  const sendDate = todayIST();
  const startedAt = Date.now();

  // Only users who actually have a device registered are worth processing —
  // and who haven't disabled this slot in their prefs (default = enabled,
  // matching the notification_prefs table defaults, if they never opened Settings).
  const { data: subRows, error: subErr } = await admin.from("push_subscriptions").select("user_id");
  if (subErr) return res.status(500).json({ error: subErr.message });

  const userIds = [...new Set((subRows || []).map((r) => r.user_id))];
  if (userIds.length === 0) return res.status(200).json({ slot, sendDate, processed: 0, note: "No push subscriptions on file." });

  const { data: prefRows } = await admin
    .from("notification_prefs")
    .select("user_id, enabled, morning, afternoon, evening")
    .in("user_id", userIds);
  const prefsByUser = new Map((prefRows || []).map((p) => [p.user_id, p]));

  const eligible = userIds.filter((uid) => {
    const p = prefsByUser.get(uid);
    if (!p) return true; // no row yet = defaults = enabled
    if (p.enabled === false) return false;
    return p[slot] !== false;
  });

  const summary = { sent: 0, skipped_already_sent: 0, skipped_no_subs: 0, error: 0, skipped_time_budget: 0 };
  const outcomes = await mapWithConcurrency(eligible, CONCURRENCY, async (uid) => {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      summary.skipped_time_budget++;
      return { userId: uid, status: "skipped_time_budget" };
    }
    try {
      const r = await processUser(admin, uid, slot, sendDate);
      summary[r.status] = (summary[r.status] || 0) + 1;
      return r;
    } catch (err) {
      summary.error++;
      return { userId: uid, status: "error", error: err.message };
    }
  });

  return res.status(200).json({
    slot,
    sendDate,
    eligibleUsers: eligible.length,
    summary,
    durationMs: Date.now() - startedAt,
    details: outcomes,
  });
}
