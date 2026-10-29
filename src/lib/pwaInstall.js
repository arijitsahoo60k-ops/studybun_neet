/**
 * PWA install helpers.
 *
 * Why this file exists: the browser fires `beforeinstallprompt` VERY early --
 * often before the React bundle has even finished parsing -- so a component
 * that only starts listening on mount can miss it entirely and then think the
 * app "isn't installable". index.html now captures that event at the top of
 * <head> and parks it on `window.__sbInstallPrompt`, re-broadcasting it as a
 * `sb:installprompt` CustomEvent. Everything below reads from that parked
 * copy, so we can never miss the window.
 *
 * The second half of the file covers the browsers that have NO such event at
 * all (iOS Safari, desktop Safari, Firefox, and any in-app webview like the
 * Instagram/Facebook browser). There we can't trigger an install ourselves --
 * only show the correct manual "Add to Home Screen" steps for that exact
 * platform, which is what `installHowTo()` returns.
 */

const SNOOZE_KEY = "sb-install-snoozed-at";
// Deliberately short. "Later" should mean later, not never -- the whole point
// of this banner is that people who never install never come back to the app.
// After this window the full banner reappears on the next visit; in between,
// the small corner pill stays up so the option is never fully gone.
const SNOOZE_MS = 24 * 60 * 60 * 1000;

/* ---------------------------------------------------------------- installed */

/**
 * True when the app is already running as an installed PWA, in which case we
 * must render nothing at all. Checked three ways because no single one covers
 * every platform: display-mode media queries (Chromium/Android/desktop),
 * navigator.standalone (iOS Safari only), and the android-app referrer (TWA).
 */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  try {
    const modes = ["standalone", "minimal-ui", "fullscreen", "window-controls-overlay"];
    if (modes.some((m) => window.matchMedia?.(`(display-mode: ${m})`)?.matches)) return true;
    if (window.navigator?.standalone === true) return true;
    if (typeof document !== "undefined" && document.referrer?.startsWith("android-app://")) return true;
  } catch {
    /* matchMedia can throw in exotic webviews -- treat as "not installed" */
  }
  return false;
}

/** Subscribe to display-mode changes (fires if the user installs mid-session). */
export function watchStandalone(cb) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(display-mode: standalone)");
  const handler = () => cb(isStandalone());
  mq.addEventListener?.("change", handler);
  return () => mq.removeEventListener?.("change", handler);
}

/* ------------------------------------------------------------- the prompt */

/** The deferred `beforeinstallprompt` event, if this browser gave us one. */
export function getInstallPrompt() {
  if (typeof window === "undefined") return null;
  return window.__sbInstallPrompt || null;
}

/** Listen for the prompt arriving later than mount. Returns an unsubscribe fn. */
export function watchInstallPrompt(cb) {
  if (typeof window === "undefined") return () => {};
  const onPrompt = () => cb(getInstallPrompt());
  // Both: the re-broadcast from index.html AND the native event, in case the
  // inline capture script was stripped/blocked by some browser extension.
  window.addEventListener("sb:installprompt", onPrompt);
  window.addEventListener("beforeinstallprompt", onPrompt);
  return () => {
    window.removeEventListener("sb:installprompt", onPrompt);
    window.removeEventListener("beforeinstallprompt", onPrompt);
  };
}

/** Listen for a successful install. Returns an unsubscribe fn. */
export function watchAppInstalled(cb) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("appinstalled", cb);
  window.addEventListener("sb:appinstalled", cb);
  return () => {
    window.removeEventListener("appinstalled", cb);
    window.removeEventListener("sb:appinstalled", cb);
  };
}

/**
 * Fire the native install dialog. Returns "accepted" | "dismissed" | "unavailable".
 * The event is single-use: once prompted it can never be prompted again, so we
 * clear the parked copy either way.
 */
export async function triggerInstall() {
  const evt = getInstallPrompt();
  if (!evt) return "unavailable";
  try {
    evt.prompt();
    const choice = await evt.userChoice;
    window.__sbInstallPrompt = null;
    return choice?.outcome === "accepted" ? "accepted" : "dismissed";
  } catch {
    window.__sbInstallPrompt = null;
    return "dismissed";
  }
}

/* --------------------------------------------------------------- snoozing */

export function isSnoozed() {
  try {
    const at = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

export function snoozeInstall() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  } catch {
    /* private mode / storage blocked -- banner just reappears next reload */
  }
}

export function clearSnooze() {
  try {
    localStorage.removeItem(SNOOZE_KEY);
  } catch {
    /* no-op */
  }
}

/* ------------------------------------------------------------- platform */

/**
 * Coarse platform sniff, used ONLY to pick which manual install instructions
 * to show. Never used to gate functionality, so a wrong guess just means
 * slightly-off wording, never a broken screen.
 */
export function detectPlatform() {
  if (typeof navigator === "undefined") return { os: "desktop", browser: "other", inApp: false };
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports itself as a Mac; the touch point count gives it away.
    (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  const isAndroid = /Android/.test(ua);

  // In-app webviews (Instagram, Facebook, Snapchat, LinkedIn, Line, Android
  // WebView) physically cannot install a PWA -- the user has to reopen the
  // link in a real browser first, so those get their own instructions.
  const inApp =
    /FBAN|FBAV|Instagram|Snapchat|LinkedInApp|Line\//i.test(ua) ||
    (isAndroid && /; wv\)/.test(ua));

  let browser = "other";
  if (/Firefox|FxiOS/i.test(ua)) browser = "firefox";
  else if (/EdgA?\//i.test(ua)) browser = "edge";
  else if (/CriOS/i.test(ua)) browser = "chrome-ios";
  else if (/Chrome|Chromium/i.test(ua)) browser = "chrome";
  else if (/Safari/i.test(ua)) browser = "safari";

  const os = isIOS ? "ios" : isAndroid ? "android" : "desktop";
  return { os, browser, inApp };
}

/**
 * Manual "Add to Home Screen" steps for browsers with no install event.
 * `icon` is a plain string the banner renders inline so the step reads the
 * same as what the user is actually looking at in their browser chrome.
 */
export function installHowTo(platform = detectPlatform()) {
  const { os, browser, inApp } = platform;

  if (inApp) {
    return {
      title: "Open StudyBun in your browser first",
      note: "In-app browsers can't install apps.",
      steps: [
        "Tap the ⋯ menu in the top corner of this screen.",
        os === "ios" ? "Choose \"Open in Safari\"." : "Choose \"Open in Chrome\" or \"Open in browser\".",
        "Then come back to this banner and tap Install.",
      ],
    };
  }

  if (os === "ios") {
    if (browser !== "safari") {
      return {
        title: "Open StudyBun in Safari",
        note: "On iPhone/iPad only Safari can add apps to the home screen.",
        steps: [
          "Copy this page's link.",
          "Open Safari and paste it in.",
          "Tap Share → Add to Home Screen.",
        ],
      };
    }
    return {
      title: "Add StudyBun to your Home Screen",
      note: "Takes about 5 seconds.",
      steps: [
        "Tap the Share button (the square with an arrow) at the bottom of Safari.",
        "Scroll down and tap \"Add to Home Screen\".",
        "Tap \"Add\" — StudyBun now opens like a real app.",
      ],
    };
  }

  if (os === "android") {
    return {
      title: "Add StudyBun to your Home Screen",
      note: "Takes about 5 seconds.",
      steps: [
        "Tap the ⋮ menu at the top-right of your browser.",
        "Tap \"Install app\" (or \"Add to Home screen\").",
        "Confirm — StudyBun now opens like a real app.",
      ],
    };
  }

  if (browser === "firefox") {
    return {
      title: "Pin StudyBun for quick access",
      note: "Firefox on desktop doesn't install web apps.",
      steps: [
        "Right-click this tab and choose \"Pin Tab\", or",
        "Open StudyBun in Chrome or Edge to install it properly.",
      ],
    };
  }

  return {
    title: "Install StudyBun on this computer",
    note: "It opens in its own window, no tabs, no distractions.",
    steps: [
      "Look for the install icon (a screen with a ↓) at the right of the address bar.",
      "Or open the browser menu → \"Cast, save and share\" → \"Install page as app\".",
      "Confirm, and StudyBun gets its own desktop icon.",
    ],
  };
}
