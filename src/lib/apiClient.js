import { supabase } from "./supabaseClient";

/**
 * POSTs to one of StudyBun's own authenticated /api/* endpoints, attaching
 * the current Supabase session token (same pattern as pushClient.js).
 * The browser never talks to a third-party AI provider directly or holds
 * any provider API key — the server does that, using its own env vars.
 */
export async function authedApiPost(path, body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    const e = new Error("You need to be signed in to use this feature.");
    e.code = "not_signed_in";
    throw e;
  }

  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON error body — payload stays null, handled below */
  }

  if (!res.ok || !payload?.success) {
    const message = payload?.error || `Request failed (${res.status}).`;
    const e = new Error(message);
    e.code = payload?.code || (res.status === 429 ? "rate_limited" : res.status === 503 ? "no_keys" : undefined);
    throw e;
  }

  return payload.data;
}

/**
 * GETs one of StudyBun's own authenticated /api/* endpoints. Returns null
 * on any failure (not signed in, network error, non-2xx) rather than
 * throwing — callers use this for optional status checks, not user-facing
 * actions that need a hard error.
 */
export async function authedApiGet(path) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return null;

  try {
    const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success) return null;
    return payload.data;
  } catch {
    return null;
  }
}
