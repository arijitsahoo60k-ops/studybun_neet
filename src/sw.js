/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

// IMPORTANT: no unconditional self.skipWaiting() here. Calling it
// automatically on install makes a new service worker jump straight past the
// "waiting" state into activating -- which is also the exact state
// vite-plugin-pwa's registerType: "prompt" watches for to flip `needRefresh`
// and show the "new version available" banner (see PWAPrompt.jsx). With
// auto-skipWaiting, the update had usually already installed itself by the
// time the banner would've appeared, so it showed inconsistently (or not at
// all) even though a hard refresh always picked up the new version -- the
// new SW was already active, just never announced. Waiting for this message
// (sent by updateServiceWorker(true) when the user clicks "Refresh") is what
// makes the prompt-then-refresh flow actually work as designed.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
clientsClaim();
cleanupOutdatedCaches();

// vite-plugin-pwa (injectManifest strategy) replaces this at build time with
// the real list of hashed app-shell assets to precache.
precacheAndRoute(self.__WB_MANIFEST);

/**
 * SMART NOTIFICATIONS — push handling
 * The server (api/cron/notify.js) sends a JSON payload shaped like:
 *   { title, body, url, slot }
 * via Web Push. This is the browser-side half: turn that payload into an
 * actual system notification, and route a tap on it to the right in-app page.
 */
self.addEventListener("push", (event) => {
  // `page` is one of StudyBun's internal SPA page ids (dashboard, planner,
  // revision, backlog, analytics, goals) — the app isn't path-routed, so we
  // pass an id, not a URL, and resolve it to a URL only when opening a tab.
  let payload = { title: "StudyBun", body: "You have a new update.", page: "dashboard" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Non-JSON push payload (shouldn't happen from our own server) — fall back to defaults.
  }

  const options = {
    body: payload.body,
    icon: "/pwa-192.png",
    badge: "/pwa-192.png",
    tag: `studybun-${payload.slot || "notify"}`, // replaces a same-slot notification instead of stacking duplicates
    renotify: true,
    data: { page: payload.page || "dashboard" },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const page = event.notification.data?.page || "dashboard";
  const targetUrl = `${self.registration.scope}?page=${encodeURIComponent(page)}`;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // If StudyBun is already open in a tab, focus it and hand it the
      // target page via postMessage rather than force-navigating — gentler
      // on whatever the user was doing there.
      const existing = allClients.find((c) => "focus" in c);
      if (existing) {
        existing.postMessage({ type: "studybun-notification-click", page });
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    })()
  );
});
