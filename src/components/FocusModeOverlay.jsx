import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Play, Pause, Minimize2, RefreshCw, Save, ChevronUp, PictureInPicture2, Maximize2 } from "lucide-react";
import Mascot from "./Mascot";
import FocusModeAmbient from "./FocusModeAmbient";
import { AMBIENT_ENVIRONMENTS } from "../lib/focusAmbience";
import { MOTIVATIONAL } from "../data/motivationalQuotes";
import { todayIST, dateStrToUTCms } from "../lib/dateIST";
import { STOPWATCH_MODE } from "../hooks/useFocusTimer";
import { pauseDecor } from "../lib/decorPause";

const ENV_KEYS = Object.keys(AMBIENT_ENVIRONMENTS);

// Fallback memory for the current app session, used until the saved scene
// arrives from Supabase (focus_mode_settings, see App.jsx) or if that table
// isn't available. Nothing is written to localStorage.
let lastEnvKey = "rain";

/* ── Fullscreen helpers (unprefixed + WebKit, for older Safari) ─────────── */
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
function requestFs(el) {
  try {
    const fn = el?.requestFullscreen || el?.webkitRequestFullscreen;
    return fn ? Promise.resolve(fn.call(el)).catch(() => {}) : Promise.resolve();
  } catch { return Promise.resolve(); }
}
// Resolves once the browser has *actually* left fullscreen (not merely once we
// asked it to), with a timeout so a browser that never fires the event can't
// strand us. That gap is exactly what used to glitch: the overlay unmounted
// mid-transition while the save card was already trying to paint.
function leaveFs(timeoutMs = 900) {
  return new Promise((resolve) => {
    if (!fsElement()) { resolve(); return; }
    let done = false;
    let tm;
    const onChange = () => { if (!fsElement()) finish(); };
    const finish = () => {
      if (done) return;
      done = true;
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
      clearTimeout(tm);
      // one extra frame so the browser has repainted the normal page
      requestAnimationFrame(() => resolve());
    };
    tm = setTimeout(finish, timeoutMs);
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    try {
      const fn = document.exitFullscreen || document.webkitExitFullscreen;
      if (!fn) { finish(); return; }
      Promise.resolve(fn.call(document)).catch(finish);
    } catch { finish(); }
  });
}

/* ── Rotating quote ─────────────────────────────────────────────────────────
   Starts on the same line the Dashboard shows today, then steps through the
   pool with a stride coprime to its length, so consecutive quotes feel
   unrelated but nothing repeats until the whole pool has been shown.
   It only advances while the timer is actually running, and how long a line
   stays up scales with its word count -- a 6-word line doesn't linger, a
   17-word one gets time to be read. Paused/idle: the current line just sits. */
const QUOTE_STRIDE = 37; // gcd(37, 192) = 1
function quoteStart() {
  const day = Math.floor(dateStrToUTCms(todayIST()) / 86400000);
  const n = MOTIVATIONAL.length;
  return ((day % n) + n) % n;
}
const holdFor = (text) => Math.min(11500, Math.max(6500, 3800 + text.split(/\s+/).length * 420));

function FocusQuote({ active }) {
  const [idx, setIdx] = useState(quoteStart);
  const [phase, setPhase] = useState("in");
  const text = MOTIVATIONAL[idx];
  const next = useCallback(() => { setIdx((i) => (i + QUOTE_STRIDE) % MOTIVATIONAL.length); setPhase("in"); }, []);

  useEffect(() => {
    if (!active) { setPhase("in"); return undefined; }
    const hold = holdFor(text);
    const t1 = setTimeout(() => setPhase("out"), hold);
    const t2 = setTimeout(next, hold + 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [idx, active, text, next]);

  const words = text.split(/\s+/);
  return (
    <button
      type="button"
      className={`sb-focusmode-quote ${phase === "out" ? "out" : ""}`}
      onClick={next}
      title="Tap for another line"
      aria-label={`${text} — tap for another line`}
    >
      <span className="sb-focusmode-quote-rule" aria-hidden="true" />
      <span className="sb-focusmode-quote-text" key={idx} aria-hidden="true">
        {words.map((w, i) => (
          <span key={i} className="sb-focusmode-word" style={{ animationDelay: `${i * 70}ms` }}>{w}&nbsp;</span>
        ))}
      </span>
    </button>
  );
}

/**
 * FocusModeOverlay — a distraction-free fullscreen wrapper around the running
 * timer, opened from the Focus Mode button on FocusTimer.jsx.
 *
 * Theming: portaled into `.sb-app`, NOT document.body. Every theme colour
 * (--card, --ink, --outline, --accent...) and the display font are defined as
 * inline custom properties on that node only (see the WARNING in App.jsx), so
 * a body portal renders the mascot with no colours at all -- that's what made
 * it a black silhouette before. The Fullscreen API is happy with an element
 * anywhere in the tree; custom properties keep inheriting in the top layer.
 *
 * Leaving: Minimize, Escape, or the browser's own fullscreen-exit control all
 * end up in closeOnce(), which is idempotent so overlapping exit paths can
 * never double-fire onClose.
 *
 * Finishing: the moment the timer ends (or Save is pressed) `t.askDone` flips
 * true. The overlay LOCKS -- controls disabled, Escape/exit ignored, quotes
 * stopped -- shows a short "session complete" beat, then leaves fullscreen,
 * waits for the browser to confirm it, and only then hands back to the page
 * where the save card lives. It never exits and unmounts in one tick.
 */
export default function FocusModeOverlay({ t, mascot, onClose, savedScene, onSceneChange }) {
  const rootRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closedRef = useRef(false);
  const lockedRef = useRef(false);
  const savedByUserRef = useRef(false);
  const idleRef = useRef(false);
  const swallowRef = useRef(false);
  // Windowed = dropped out of OS fullscreen while staying mounted and
  // running, as opposed to Minimize/exit below which tears the whole
  // overlay down. windowedRef exists so the fullscreenchange listener
  // (which fires async, after our own leaveFs()) can tell "we did that on
  // purpose" apart from "the browser kicked us out of fullscreen" without
  // waiting on a state update.
  const windowedRef = useRef(false);

  const [envKey, setEnvKey] = useState(() => {
    const start = AMBIENT_ENVIRONMENTS[savedScene] ? savedScene : lastEnvKey;
    return AMBIENT_ENVIRONMENTS[start] ? start : "rain";
  });
  const pickedRef = useRef(false); // once you choose a scene here, a late-arriving saved value must not override it
  const [pickerOpen, setPickerOpen] = useState(false);
  const [windowed, setWindowed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [idle, setIdle] = useState(false);
  // Same "don't wipe an active session on one stray tap" gate FocusTimer.jsx
  // uses for its own Reset button: an idle timer resets instantly, an active
  // session needs a second tap to confirm.
  const [confirmReset, setConfirmReset] = useState(false);

  const env = AMBIENT_ENVIRONMENTS[envKey];
  const mm = String(Math.floor(t.secondsLeft / 60)).padStart(2, "0");
  const ss = String(t.secondsLeft % 60).padStart(2, "0");
  const isStopwatch = t.mode === STOPWATCH_MODE;

  const closeOnce = useCallback((info) => {
    if (closedRef.current) return;
    closedRef.current = true;
    onCloseRef.current?.(info);
  }, []);

  // User-initiated leave (Minimize / Escape). Ends the session view entirely
  // -- fullscreen exits AND the overlay unmounts. Ignored while locked -- the
  // finish hand-off owns the exit then.
  const exit = useCallback(() => {
    if (lockedRef.current || closedRef.current) return;
    leaveFs().then(() => closeOnce());
  }, [closeOnce]);

  // Float button (top-right corner): drops out of OS fullscreen WITHOUT
  // closing the overlay -- Focus Mode keeps filling the browser window
  // exactly as before and the timer keeps running, but the OS taskbar and
  // your other windows/apps become reachable again, same as any normal
  // browser tab. Tapping it again restores fullscreen. This is deliberately
  // a different action from `exit` above, which closes Focus Mode entirely.
  const toggleWindowed = useCallback(() => {
    if (lockedRef.current || closedRef.current) return;
    if (!windowedRef.current) {
      windowedRef.current = true; // set first: the async fullscreenchange event must see this
      setWindowed(true);
      leaveFs();
    } else {
      windowedRef.current = false;
      setWindowed(false);
      requestFs(rootRef.current);
    }
  }, []);

  // Enter fullscreen, best-effort. Quietly no-ops if unsupported/refused
  // (iOS Safari has no element fullscreen) -- still a fixed full-viewport view.
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    requestFs(rootRef.current);
    return () => {
      // Unmounting for any reason (page change, error boundary) must not
      // leave the browser stuck in fullscreen on an element that's gone.
      if (fsElement()) {
        try { (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); } catch { /* ignore */ }
      }
    };
  }, []);

  // Every way fullscreen can end that isn't our own exit(): the browser's
  // native X / "Exit full screen", Escape handled by the browser itself,
  // swipe-away on mobile. Without this the browser would leave fullscreen
  // but the overlay would stay up with no obvious way out.
  useEffect(() => {
    const onFsChange = () => {
      // A leaveFs() triggered by the float button (windowedRef already true)
      // must not tear the overlay down -- only an unrequested exit should.
      if (!fsElement() && !windowedRef.current) closeOnce({ finished: lockedRef.current });
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, [closeOnce]);

  // Escape when the browser did NOT handle it (no Fullscreen API at all, or
  // the request was refused).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (pickerOpen) setPickerOpen(false); else exit();
    };
    window.addEventListener("keydown", onKey);
    const resumeDecor = pauseDecor();
    return () => { window.removeEventListener("keydown", onKey); resumeDecor(); };
  }, [exit, pickerOpen]);

  // ── Lock + hand-off when the session ends ──
  useEffect(() => {
    if (!t.askDone) return undefined;
    lockedRef.current = true;
    setLocked(true);
    setPickerOpen(false);
    setConfirmReset(false);
    const hold = savedByUserRef.current ? 900 : 1900; // natural finish gets a longer beat
    const id = setTimeout(async () => {
      await leaveFs();
      closeOnce({ finished: true });
    }, hold);
    return () => {
      clearTimeout(id);
      // askDone went false again (e.g. discarded from another tab) before the
      // hand-off ran: unlock instead of stranding a dead-looking screen.
      if (!closedRef.current) { lockedRef.current = false; setLocked(false); }
    };
  }, [t.askDone, closeOnce]);

  useEffect(() => { lastEnvKey = envKey; }, [envKey]);

  // The saved scene can land just after the overlay opens (row still loading).
  useEffect(() => {
    if (!pickedRef.current && AMBIENT_ENVIRONMENTS[savedScene]) setEnvKey(savedScene);
  }, [savedScene]);

  const chooseScene = (k) => {
    pickedRef.current = true;
    setEnvKey(k);
    setPickerOpen(false);
    if (k !== savedScene) onSceneChange?.(k);
  };
  useEffect(() => { if (!t.sessionActive) setConfirmReset(false); }, [t.sessionActive]);

  // Fade the chrome away after a few idle seconds while the timer runs; any
  // movement/tap/key brings it back. The tap that wakes it is swallowed so it
  // can't land on a button that was invisible a moment ago.
  useEffect(() => {
    const canHide = t.running && !locked && !pickerOpen && !confirmReset;
    if (!canHide) { idleRef.current = false; setIdle(false); return undefined; }
    let tm;
    const arm = (e) => {
      if (idleRef.current && e && (e.type === "pointerdown" || e.type === "touchstart")) {
        swallowRef.current = true;
        setTimeout(() => { swallowRef.current = false; }, 450);
      }
      idleRef.current = false; setIdle(false);
      clearTimeout(tm);
      tm = setTimeout(() => { idleRef.current = true; setIdle(true); }, 4200);
    };
    arm();
    const evs = ["pointermove", "pointerdown", "keydown", "touchstart"];
    evs.forEach((n) => window.addEventListener(n, arm, { passive: true }));
    return () => { clearTimeout(tm); evs.forEach((n) => window.removeEventListener(n, arm)); };
  }, [t.running, locked, pickerOpen, confirmReset]);

  const handleResetClick = () => {
    if (t.sessionActive) setConfirmReset(true);
    else t.reset();
  };
  const handleSave = () => { savedByUserRef.current = true; t.saveEarly(); };

  const naturalFinish = locked && !savedByUserRef.current;

  const overlay = (
    <div
      ref={rootRef}
      className={`sb-focusmode-root ${idle ? "is-idle" : ""} ${locked ? "is-locked" : ""} ${t.running ? "is-running" : ""}`}
      style={{ "--fm-base": env.base }}
      role="dialog"
      aria-modal="true"
      aria-label="Focus Mode"
      tabIndex={-1}
      onClickCapture={(e) => { if (swallowRef.current) { e.stopPropagation(); e.preventDefault(); swallowRef.current = false; } }}
      onPointerDown={(e) => {
        // tap outside the scene picker closes it
        if (pickerOpen && !e.target.closest?.(".sb-focusmode-env-picker")) setPickerOpen(false);
      }}
    >
      <FocusModeAmbient envKey={envKey} />
      <div className="sb-focusmode-scrim" aria-hidden="true" />

      <button
        type="button"
        className="sb-focusmode-float-btn"
        onClick={toggleWindowed}
        disabled={locked}
        title={windowed ? "Restore full screen" : "Exit full screen — keeps running so you can use the rest of your computer"}
        aria-label={windowed ? "Restore Focus Mode to full screen" : "Exit full screen, keep Focus Mode running"}
      >
        {windowed ? <Maximize2 size={16} /> : <PictureInPicture2 size={16} />}
      </button>

      <div className="sb-focusmode-content">
        <span className="sb-focusmode-mode-label">
          <span className="sb-focusmode-live-dot" aria-hidden="true" />
          {t.mode}
        </span>

        <div className="sb-focusmode-medallion">
          <span className="sb-focusmode-ring" aria-hidden="true" />
          <Mascot species={mascot} mood={locked ? "celebrate" : t.running ? "studying" : "idle"} size={92} />
        </div>

        <div className="sb-focusmode-time" aria-live="off">
          {mm}<span className="sb-focusmode-colon">:</span>{ss}
        </div>

        {isStopwatch ? (
          <p className="sb-focusmode-hint">Counting up — save whenever you're done.</p>
        ) : (
          <div className="sb-focusmode-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(t.pct || 0)}>
            <div className="sb-focusmode-fill" style={{ width: `${Math.min(100, Math.max(0, t.pct || 0))}%` }} />
          </div>
        )}

        <div className="sb-focusmode-controls">
          {!t.running ? (
            <button className="sb-focusmode-btn primary" onClick={t.start} disabled={t.askDone || locked}>
              <Play size={17} /> Start
            </button>
          ) : (
            <button className="sb-focusmode-btn primary" onClick={t.pause} disabled={locked}>
              <Pause size={17} /> Pause
            </button>
          )}
          {!t.askDone && (
            <button
              className="sb-focusmode-btn sb-focusmode-btn-save"
              onClick={handleSave}
              disabled={!t.canSave || locked}
              title={t.canSave ? `Save ${Math.round(t.elapsedSeconds / 60)} min so far` : "Runs for 5+ min before you can save early"}
            >
              <Save size={17} /> Save
            </button>
          )}
          {confirmReset ? (
            <button
              className="sb-focusmode-btn sb-focusmode-btn-reset danger"
              onClick={() => { setConfirmReset(false); t.reset(); }}
              disabled={locked}
              title="Tap again to confirm — this discards the session"
            >
              <RefreshCw size={17} /> Confirm reset
            </button>
          ) : (
            <button className="sb-focusmode-btn sb-focusmode-btn-reset icon" onClick={handleResetClick} disabled={locked} title="Reset this session" aria-label="Reset this session">
              <RefreshCw size={17} />
            </button>
          )}
          <button className="sb-focusmode-btn sb-focusmode-btn-exit" onClick={exit} disabled={locked} title="Leave Focus Mode entirely">
            <Minimize2 size={17} /> Exit
          </button>
        </div>
        {confirmReset && (
          <p className="sb-focusmode-reset-hint">
            You've put in time on this session — resetting throws it away. Tap "Confirm reset" again, or Minimize/Save instead.
          </p>
        )}

        <div className="sb-focusmode-slot">
          {locked ? (
            <div className="sb-focusmode-done" role="status">
              <strong>{naturalFinish ? "Session complete ✨" : "Wrapping up…"}</strong>
              <span>Taking you to your save card</span>
            </div>
          ) : (
            <FocusQuote active={t.running} />
          )}
        </div>
      </div>

      <div className="sb-focusmode-env-picker">
        {pickerOpen && (
          <div className="sb-focusmode-env-list" role="listbox" aria-label="Ambient scene">
            {ENV_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                role="option"
                aria-selected={envKey === k}
                className={`sb-focusmode-env-chip ${envKey === k ? "active" : ""}`}
                onClick={() => chooseScene(k)}
              >
                <span className="sb-focusmode-env-emoji">{AMBIENT_ENVIRONMENTS[k].icon}</span>
                <span className="sb-focusmode-env-name">{AMBIENT_ENVIRONMENTS[k].label}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="sb-focusmode-env-toggle"
          onClick={() => setPickerOpen((v) => !v)}
          disabled={locked}
          aria-expanded={pickerOpen}
          title="Change ambient scene"
        >
          <span>{env.icon}</span>
          <span className="sb-focusmode-env-label">{env.label}</span>
          <ChevronUp size={14} className={pickerOpen ? "flip" : ""} />
        </button>
      </div>
    </div>
  );

  // See the doc comment above: must live inside .sb-app to inherit theme vars.
  return createPortal(overlay, document.querySelector(".sb-app") || document.body);
}
