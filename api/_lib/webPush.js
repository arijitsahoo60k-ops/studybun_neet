import webpush from "web-push";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@studybun.app";

  if (!publicKey || !privateKey) {
    throw new Error(
      "Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY server env vars. Generate a pair with `npx web-push generate-vapid-keys` and set them in Vercel (VAPID_PUBLIC_KEY must match VITE_VAPID_PUBLIC_KEY used in the client)."
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

/**
 * Sends one Web Push message to one subscription. Returns
 * { ok: true } or { ok: false, expired: boolean, error }.
 * `expired: true` means the subscription is gone (410/404) and the caller
 * should delete it from push_subscriptions — anything else is transient.
 */
export async function sendPush(subscription, payload) {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 6 } // 6h — a stale "study now" ping from this morning isn't worth surfacing at midnight
    );
    return { ok: true };
  } catch (err) {
    const status = err?.statusCode;
    const expired = status === 404 || status === 410;
    return { ok: false, expired, error: err?.body || err?.message || String(err) };
  }
}
