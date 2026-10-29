import { supabase } from "./supabaseClient";

// The public VAPID key is NOT a secret — it's meant to be shipped to the
// browser (that's how Web Push works: the browser needs it to create a
// subscription). The private key that actually signs pushes never leaves
// the Vercel server. Generate the pair once with `npx web-push generate-vapid-keys`.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();

export const isPushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

export const isPushConfigured = () => Boolean(VAPID_PUBLIC_KEY);

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function authedFetch(path, body) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("You need to be signed in to manage notifications.");

  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

/** Current subscription state for this browser/device, or null if not subscribed. */
export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * Requests notification permission (if needed), creates a Web Push
 * subscription for this device, and registers it with the server.
 * Throws with a friendly message on any failure (denied permission, no
 * VAPID key configured, etc.) — callers should surface err.message.
 */
export async function enablePushNotifications() {
  if (!isPushSupported()) throw new Error("This browser doesn't support push notifications.");
  if (!isPushConfigured()) throw new Error("Notifications aren't set up yet — the app owner needs to configure VAPID keys.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const reg = await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await authedFetch("/api/push/subscribe", { subscription: subscription.toJSON() });
  return subscription;
}

/** Unsubscribes this device both locally and on the server. */
export async function disablePushNotifications() {
  const subscription = await getCurrentSubscription();
  if (subscription) {
    await authedFetch("/api/push/unsubscribe", { endpoint: subscription.endpoint }).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  }
}

/** Fires an immediate AI-generated test notification to every device this user has registered. */
export async function sendTestNotification() {
  return authedFetch("/api/push/test");
}

/* ---------------- per-slot preferences (read/write directly via RLS) ---------------- */

export async function getNotificationPrefs(userId) {
  const { data, error } = await supabase.from("notification_prefs").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data || { user_id: userId, enabled: true, morning: true, afternoon: true, evening: true };
}

export async function setNotificationPrefs(userId, patch) {
  const { error } = await supabase.from("notification_prefs").upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
  if (error) throw error;
}
