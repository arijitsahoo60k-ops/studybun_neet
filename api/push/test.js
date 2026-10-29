import { getSupabaseAdmin, getUserFromAuthHeader } from "../_lib/supabaseAdmin.js";
import { buildUserContext } from "../_lib/buildUserContext.js";
import { generateNotification } from "../_lib/notificationEngine.js";
import { sendPush } from "../_lib/webPush.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ error: authError || "Not signed in." });

  const admin = getSupabaseAdmin();
  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", user.id);
  if (!subs || subs.length === 0) {
    return res.status(400).json({ error: "No push subscription found for this device yet — enable notifications first." });
  }

  const context = await buildUserContext(admin, user.id);
  const notif = await generateNotification("test", context);

  const results = await Promise.all(
    subs.map((sub) => sendPush(sub, { title: notif.title, body: notif.body, page: notif.deep_link, slot: "test" }))
  );
  const anySent = results.some((r) => r.ok);

  return res.status(anySent ? 200 : 502).json({
    ok: anySent,
    notification: notif,
    devicesTried: subs.length,
    devicesSucceeded: results.filter((r) => r.ok).length,
  });
}
