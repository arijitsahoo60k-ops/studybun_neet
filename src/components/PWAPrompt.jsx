import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Download, X, Check, ChevronRight } from "lucide-react";
import {
  isStandalone,
  watchStandalone,
  getInstallPrompt,
  watchInstallPrompt,
  watchAppInstalled,
  triggerInstall,
  isSnoozed,
  snoozeInstall,
  clearSnooze,
  detectPlatform,
  installHowTo,
} from "../lib/pwaInstall";

/**
 * Handles PWA installability + update UX.
 *
 * INSTALL (the important half): most users never install StudyBun, and users
 * who don't install mostly don't come back -- there's no icon on their home
 * screen reminding them. So the install nudge is now *persistent until the app
 * is actually installed*, not a one-shot banner:
 *
 *   full banner  -> shown on load (short delay so it doesn't fight the first
 *                   paint). "Later" snoozes it for 24h, it does NOT kill it.
 *   corner pill  -> what's left while snoozed. Small, out of the way, always
 *                   there, one tap re-opens the full banner.
 *   nothing      -> only once the app is genuinely installed (display-mode
 *                   standalone / navigator.standalone / `appinstalled`).
 *
 * It also works on browsers that never fire `beforeinstallprompt` -- iOS
 * Safari, desktop Safari/Firefox, in-app webviews. Those can't be installed
 * programmatically, so the same banner flips to the exact manual
 * "Add to Home Screen" steps for that platform instead of staying silent
 * (the old behaviour, which is why no iPhone user ever installed it).
 *
 * UPDATE: registers the service worker and shows a "new version available"
 * banner, letting the user refresh on their terms instead of the app silently
 * swapping code underneath them. The update banner takes priority over the
 * install nudge whenever both are pending.
 */

// Long enough that the banner never lands on top of the first paint / login,
// short enough that a user who opens the app and reads one screen still sees it.
const SHOW_DELAY_MS = 6000;

export default function PWAPrompt() {
  const [installed, setInstalled] = useState(() => isStandalone());
  const [promptEvent, setPromptEvent] = useState(() => getInstallPrompt());
  // "waiting" -> nothing on screen yet | "banner" -> full card | "mini" -> pill
  const [view, setView] = useState("waiting");
  const [showSteps, setShowSteps] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  const platform = useMemo(() => detectPlatform(), []);
  const howTo = useMemo(() => installHowTo(platform), [platform]);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new service worker periodically so long-lived tabs still
      // get offered updates.
      if (registration) {
        setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
      }
    },
  });

  /* ---- installability signals -------------------------------------- */

  useEffect(() => {
    const offPrompt = watchInstallPrompt((e) => setPromptEvent(e));
    const offInstalled = watchAppInstalled(() => {
      clearSnooze();
      setPromptEvent(null);
      setJustInstalled(true);
      // Keep the little "installed!" confirmation up briefly, then retire the
      // whole component for good.
      setTimeout(() => setInstalled(true), 3500);
    });
    const offMode = watchStandalone((standalone) => {
      if (standalone) setInstalled(true);
    });
    return () => {
      offPrompt();
      offInstalled();
      offMode();
    };
  }, []);

  /* ---- decide what to show, and when ------------------------------- */

  useEffect(() => {
    if (installed || justInstalled) return undefined;
    // Already snoozed from a previous visit -> go straight to the pill, no
    // delay, so the option is visible but never in the way.
    if (isSnoozed()) {
      setView("mini");
      return undefined;
    }
    const t = setTimeout(() => {
      setView((v) => (v === "waiting" ? "banner" : v));
    }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [installed, justInstalled]);

  /* ---- actions ------------------------------------------------------ */

  const handleInstall = useCallback(async () => {
    const outcome = await triggerInstall();
    if (outcome === "unavailable") {
      // No native prompt on this browser -- show the manual steps instead of
      // a dead button.
      setShowSteps(true);
      return;
    }
    if (outcome === "dismissed") {
      // They saw the OS dialog and backed out. Don't nag with the full card
      // again this session, but keep the pill so it's one tap away.
      setPromptEvent(null);
      setShowSteps(false);
      setView("mini");
    }
    // "accepted" is handled by the `appinstalled` listener above.
  }, []);

  const handleLater = useCallback(() => {
    snoozeInstall();
    setShowSteps(false);
    setView("mini");
  }, []);

  const openBanner = useCallback(() => {
    clearSnooze();
    setView("banner");
  }, []);

  /* ---- render ------------------------------------------------------- */

  // The update banner wins whenever both want the same corner.
  if (needRefresh) {
    return (
      <div className="sb-pwa-banner" role="status">
        <span className="sb-pwa-banner-text">A new version of StudyBun is ready.</span>
        <div className="sb-pwa-banner-actions">
          <button className="sb-pwa-btn" onClick={() => updateServiceWorker(true)}>Refresh</button>
          <button className="sb-pwa-dismiss" onClick={() => setNeedRefresh(false)} aria-label="Dismiss">×</button>
        </div>
      </div>
    );
  }

  if (installed) return null;

  if (justInstalled) {
    return (
      <div className="sb-install-toast" role="status">
        <span className="sb-install-toast-icon"><Check size={15} strokeWidth={3} /></span>
        StudyBun is on your home screen — open it from there next time!
      </div>
    );
  }

  if (view === "mini") {
    return (
      <button className="sb-install-mini" onClick={openBanner} aria-label="Install StudyBun as an app">
        <span className="sb-install-mini-dot" aria-hidden="true" />
        <Download size={15} strokeWidth={2.6} />
        <span className="sb-install-mini-label">Install app</span>
      </button>
    );
  }

  if (view !== "banner") return null;

  const canPromptNatively = Boolean(promptEvent);
  const stepsMode = showSteps || !canPromptNatively;

  return (
    <div className="sb-install-card" role="dialog" aria-label="Install StudyBun">
      <button className="sb-install-close" onClick={handleLater} aria-label="Not now">
        <X size={15} strokeWidth={3} />
      </button>

      <div className="sb-install-head">
        <span className="sb-install-bun" aria-hidden="true">🐰</span>
        <div className="sb-install-head-text">
          <p className="sb-install-title">{stepsMode ? howTo.title : "Install StudyBun"}</p>
          <p className="sb-install-sub">
            {stepsMode ? howTo.note : "Get it on your home screen so studying is one tap away."}
          </p>
        </div>
      </div>

      {stepsMode ? (
        <ol className="sb-install-steps">
          {howTo.steps.map((step, i) => (
            <li key={i} className="sb-install-step">
              <span className="sb-install-step-num">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="sb-install-perks">
          <li><Check size={13} strokeWidth={3} /> Opens instantly, no browser tabs</li>
          <li><Check size={13} strokeWidth={3} /> Works offline for the app shell</li>
          <li><Check size={13} strokeWidth={3} /> Study reminders reach you properly</li>
        </ul>
      )}

      <div className="sb-install-actions">
        {stepsMode ? (
          <button className="sb-pwa-btn" onClick={handleLater}>Got it</button>
        ) : (
          <>
            <button className="sb-pwa-btn sb-install-cta" onClick={handleInstall}>
              <Download size={15} strokeWidth={2.8} /> Install
            </button>
            <button className="sb-pwa-btn ghost" onClick={handleLater}>Later</button>
          </>
        )}
        {!stepsMode && (
          <button className="sb-install-how" onClick={() => setShowSteps(true)}>
            How? <ChevronRight size={13} strokeWidth={3} />
          </button>
        )}
      </div>
    </div>
  );
}
