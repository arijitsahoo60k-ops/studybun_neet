import { getSupabaseAdmin, getUserFromAuthHeader } from "../_lib/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ error: authError || "Not signed in." });

  const { endpoint } = req.body || {};
  const admin = getSupabaseAdmin();

  const query = admin.from("push_subscriptions").delete().eq("user_id", user.id);
  const { error } = endpoint ? await query.eq("endpoint", endpoint) : await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true });
}
