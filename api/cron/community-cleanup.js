import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { todayIST } from "../../src/lib/dateIST.js";

// Physically deletes chat messages whose expires_at has passed. Uses the
// service-role admin client (bypasses RLS by design — this is the one job
// that's *allowed* to touch every user's rows), same pattern as
// api/cron/notify.js. Safe to run repeatedly: a run that finds nothing to
// delete is a no-op, not an error.
//
// Deletion happens here, in Postgres — not by hiding old rows in the
// React query — so `DELETE FROM community_messages WHERE expires_at <=
// now()` really does remove the rows, and Supabase Realtime broadcasts a
// DELETE event to every connected client's chat subscription.
//
// Also expires stale accountability goals: nothing previously flipped a
// goal a student never reported back on, so it just sat showing
// "Studying" forever on their card and everyone else's check-ins list.
// This runs at 20:00 UTC (1:30am IST) — well after IST midnight — and
// marks anything from a past IST calendar day still in "planned" or
// "studying" as "missed", same as if the student had reported it
// themselves.
//
// Deliberately forward-only: goals from before this fix shipped are left
// exactly as they are (some students genuinely finished those and just
// never clicked "complete") — only goal_date values from GOALS_EXPIRE_FROM
// onward get auto-expired. Set to the deploy date; bump it if this file
// is redeployed later and you don't want the cutoff to move.
const GOALS_EXPIRE_FROM = "2026-08-19";

const CHAT_IMAGE_BUCKET = "community-chat-images";
const BATCH_SIZE = 100;
const MAX_BATCHES = 100;
const TIME_BUDGET_MS = 20000; // vercel.json caps this function at 30s

// Public URL -> "<userId>/<uuid>.<ext>" storage path. Deliberately strict:
// anything that isn't exactly the shape the app's uploader produces is
// ignored (never removed), so a malformed/foreign URL can't delete a file.
const PUBLIC_MARKER = `/object/public/${CHAT_IMAGE_BUCKET}/`;
const PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpeg|jpg|png|webp)$/i;
export function storagePathFromUrl(url) {
  if (typeof url !== "string") return null;
  const i = url.indexOf(PUBLIC_MARKER);
  if (i === -1) return null;
  let rest = url.slice(i + PUBLIC_MARKER.length).split(/[?#]/)[0];
  try { rest = decodeURIComponent(rest); } catch { return null; }
  return PATH_RE.test(rest) ? rest : null;
}

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured — dev-only situation, document this
  const header = req.headers.authorization || "";
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(req.url, "http://localhost");
  return url.searchParams.get("secret") === secret;
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  // Work through expired messages in small batches instead of one giant
  // select + `.in("id", allIds)`. The old version had two ways to get stuck
  // for good: PostgREST returns at most 1000 rows per select (so a backlog
  // was only ever drained 1000 at a time), and `.in()` with ~1000 UUIDs
  // builds a ~40 KB URL that the API gateway rejects — after which EVERY
  // nightly run failed the same way and nothing was ever deleted again.
  // Small batches keep the URL short and drain any backlog across the run.
  const startedAt = Date.now();
  let found = 0;
  let deleted = 0;
  let imagesRemoved = 0;
  // A message-cleanup failure must not stop the goal-expiry step below from
  // running (they're independent jobs that just share a schedule): remember
  // the error, carry on, and report it with a 500 at the very end.
  let messageError = null;
  let drained = false;
  for (let batch = 0; batch < MAX_BATCHES && Date.now() - startedAt < TIME_BUDGET_MS; batch += 1) {
    const { data: rows, error: selErr } = await admin
      .from("community_messages")
      .select("id, image_url")
      .lte("expires_at", nowIso)
      .order("expires_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (selErr) { messageError = selErr.message; break; }
    if (!rows || rows.length === 0) { drained = true; break; }
    found += rows.length;

    // Chat photos live in a storage bucket, not in the row — deleting the
    // row alone left every expired photo in storage forever. Best-effort:
    // a failure here must never block deleting the messages themselves.
    const paths = rows.map((r) => storagePathFromUrl(r.image_url)).filter(Boolean);
    if (paths.length > 0) {
      const { error: rmErr } = await admin.storage.from(CHAT_IMAGE_BUCKET).remove(paths);
      if (rmErr) console.error("[community-cleanup] image removal failed:", rmErr.message);
      else imagesRemoved += paths.length;
    }

    const { error: delErr, count } = await admin
      .from("community_messages")
      .delete({ count: "exact" })
      .in("id", rows.map((r) => r.id));
    if (delErr) { messageError = delErr.message; break; }
    const n = count ?? rows.length;
    deleted += n;
    if (n === 0) break; // nothing removed -> don't spin on the same rows
  }

  const today = todayIST();
  const { data: staleGoals, error: staleSelErr } = await admin
    .from("accountability_goals")
    .select("id")
    .gte("goal_date", GOALS_EXPIRE_FROM)
    .lt("goal_date", today)
    .in("status", ["planned", "studying"]);
  if (staleSelErr) return res.status(500).json({ error: staleSelErr.message });

  const staleIds = (staleGoals || []).map((r) => r.id);
  let goalsExpired = 0;
  if (staleIds.length > 0) {
    const { error: expireErr, count } = await admin
      .from("accountability_goals")
      .update({ status: "missed", completed_at: nowIso }, { count: "exact" })
      .in("id", staleIds);
    if (expireErr) return res.status(500).json({ error: expireErr.message });
    goalsExpired = count ?? staleIds.length;
  }

  return res.status(messageError ? 500 : 200).json({
    ...(messageError ? { error: messageError } : {}),
    ranAt: nowIso,
    expiredMessagesFound: found,
    deleted,
    imagesRemoved,
    // false = stopped early (time/batch cap or an error); the next nightly
    // run picks up whatever is left.
    messagesDrained: drained,
    staleGoalsFound: staleIds.length,
    goalsExpired,
  });
}
