// Server-only Supabase client using the SERVICE ROLE key. This key bypasses
// Row Level Security entirely, which is exactly what the notification cron
// needs (it has to read every user's tasks/revisions/study time to build
// their daily digest) — and exactly why this file must never be imported
// from anything that ships to the browser. It lives under /api, which Vite
// never bundles into the client build, so that's enforced structurally,
// not just by convention.
import { createClient } from "@supabase/supabase-js";

let cached = null;

export function getSupabaseAdmin() {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY server env vars. " +
        "Set these in Vercel → Project → Settings → Environment Variables (server-side only, no VITE_ prefix)."
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

// A second, lightweight client used only to *verify* a end-user's access
// token sent up from the browser (e.g. on /api/push/subscribe). This uses
// the public anon key — verifying a JWT doesn't require elevated privileges.
export async function getUserFromAuthHeader(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return { user: null, error: "Missing Authorization bearer token." };

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { user: null, error: error?.message || "Invalid or expired session." };
  return { user: data.user, error: null };
}
