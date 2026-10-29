import { getSupabaseAdmin, getUserFromAuthHeader } from "../_lib/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ error: authError || "Not signed in." });

  const { subscription } = req.body || {};
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const authKey = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !authKey) {
    return res.status(400).json({ error: "Malformed push subscription payload." });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth_key: authKey,
      user_agent: req.headers["user-agent"] || null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) return res.status(500).json({ error: error.message });

  // Make sure a prefs row exists so Settings has something to read/update immediately.
  await admin.from("notification_prefs").upsert(
    { user_id: user.id },
    { onConflict: "user_id", ignoreDuplicates: true }
  );

  return res.status(200).json({ ok: true });
}
