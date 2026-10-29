import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "sb.focusTimer.v1";
// Web Locks name for "a focus session is actively running on this device
// right now" -- scoped per-origin by the browser itself, shared by every
// tab/window of this same site, independent of the STORAGE_KEY sync above.
const LOCK_NAME = "sb-focus-timer-active-session";

export const DEFAULT_MODE_MINUTES = {
  "Deep Focus": 50,
  Pomodoro: 25,
  Lecture: 45,
  Practice: 30,
  Revision: 20,
};

// Stopwatch is intentionally NOT in DEFAULT_MODE_MINUTES/modeMinutes — it has
// no fixed duration by design (counts up, stopped manually), unlike every
// other mode which counts down from a set number of minutes. Every branch
// below that treats mode === STOPWATCH_MODE differently is there because of
// this one structural difference; everything else about the session
// lifecycle (pause/resume/save/reset, persistence, points) is shared.
export const STOPWATCH_MODE = "Stopwatch";

// Hard ceiling matching the DB's CHECK constraints on timer_sessions and
// study_sessions (see supabase/migration_leaderboard.sql —
// timer_sessions_actual_range / study_sessions_minutes_range both cap at
// 600). A countdown mode can never exceed this (setCustomMinutes clamps
// every mode to <=240 min), but an indefinite Stopwatch left running by
// accident could — clamping defensively here means a forgotten Stopwatch
// can NEVER produce an insert that the database rejects.
const MAX_LOGGABLE_MINUTES = 600;

// A countdown noticed more than this long after its end time is treated as a
// late finish (app was closed/asleep) and dated at its real end time.
const LATE_FINISH_GRACE_MS = 5000;

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function savePersisted(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode etc.) — timer still works in-memory */
  }
}

/* ---------------- kawaii sound design (Web Audio, no assets needed) ---------------- */

function makeCtx(ref) {
  if (!ref.current) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ref.current = new AC();
  }
  // Browsers suspend contexts created/left outside a user gesture — resume defensively.
  if (ref.current && ref.current.state === "suspended") ref.current.resume();
  return ref.current;
}

// A soft bell tone: two slightly-detuned partials for a toy-piano/kawaii timbre,
// with a fast attack and short decay so it never feels sluggish.
function bellNote(ctx, freq, at, dur, gainPeak = 0.06) {
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  gain.connect(ctx.destination);
  [1, 2.01].forEach((mult, i) => {
    const osc = ctx.createOscillator();
    osc.type = i === 0 ? "sine" : "triangle";
    osc.frequency.value = freq * mult;
    const g = ctx.createGain();
    g.gain.value = i === 0 ? 1 : 0.18;
    osc.connect(g);
    g.connect(gain);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  });
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(gainPeak, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
}

// Quick two-note "boop-beep" — plays the moment a session starts.
function playStartChime(ctx) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  bellNote(ctx, 880, t0, 0.11, 0.05);
  bellNote(ctx, 1318.5, t0 + 0.09, 0.14, 0.055);
}

// Bright four-note ascending arpeggio — snappy (fires in ~0.4s total, not ~1s+).
function playEndChime(ctx) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C6 E6 G6 C7
  notes.forEach((freq, i) => bellNote(ctx, freq, t0 + i * 0.09, 0.22, 0.065));
}

function startDroneOsc(ctx, droneRef) {
  if (!ctx || droneRef.current) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 220;
  gain.gain.value = 0.0001;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  gain.gain.linearRampToValueAtTime(0.018, ctx.currentTime + 1.2);
  droneRef.current = { osc, gain };
}

function stopDroneOsc(ctx, droneRef) {
  if (!droneRef.current || !ctx) return;
  const { osc, gain } = droneRef.current;
  gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
  osc.stop(ctx.currentTime + 0.5);
  droneRef.current = null;
}

/**
 * Focus timer state, lifted out of the page component so it survives page
 * switches. Countdown is computed from an absolute end timestamp (not a
 * decrementing tick count), so it self-corrects after the interval gets
 * throttled by a backgrounded tab, and is persisted to localStorage so it
 * also survives a full reload or the app being reopened from recents.
 *
 * Mount this once near the app root and pass the returned object down —
 * do NOT call it per-page, or every page will keep its own timer.
 */
export function useFocusTimer({ onComplete, onSessionSettled } = {}) {
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  // A finished/early-saved session is logged to timer_sessions by onComplete
  // the instant it ends (so it can never be lost), well BEFORE the person
  // answers the "What did you study?" card. onSessionSettled({ discarded })
  // fires once that card is resolved: discarded:false = they kept it (Save
  // session), discarded:true = they threw it away (Discard, or Reset while
  // the card was still up) and the caller must remove the already-logged
  // row, otherwise "discarded" minutes keep showing up in study hours.
  const onSessionSettledRef = useRef(onSessionSettled);
  useEffect(() => { onSessionSettledRef.current = onSessionSettled; }, [onSessionSettled]);

  const persisted = useRef(loadPersisted()).current;

  const [modeMinutes, setModeMinutesState] = useState(() => ({
    ...DEFAULT_MODE_MINUTES,
    ...(persisted?.modeMinutes || {}),
  }));
  const [mode, setModeRaw] = useState(persisted?.mode || "Pomodoro");
  const [running, setRunning] = useState(!!persisted?.running);
  const [askDone, setAskDone] = useState(!!persisted?.askDone);
  const [soundOn, setSoundOn] = useState(persisted?.soundOn ?? true);
  // Aggressive Focus Mode -- opt-in, off by default, persisted per-device
  // exactly like soundOn/radioChoice above. When on AND a session is
  // actually running, App.jsx's setPage wrapper blocks switching to any
  // other page. Purely a UI-layer guard -- never touches Supabase, so
  // there's nothing here that can break for anyone who never turns it on.
  const [aggressiveMode, setAggressiveMode] = useState(!!persisted?.aggressiveMode);
  const [radioChoice, setRadioChoice] = useState(persisted?.radioChoice || "none");
  const [radioCustomUrl, setRadioCustomUrl] = useState(persisted?.radioCustomUrl || "");
  const [startedMinutes, setStartedMinutes] = useState(persisted?.startedMinutes || 0);
  // Explicit source of truth for "is a real session in progress" (running,
  // or paused mid-session, or awaiting the post-session log). Only ever set
  // by start()/reset()/resetForNewSession() below — deliberately NOT derived
  // from comparing startedMinutes/secondsLeft, because that comparison goes
  // stale (e.g. after a mode switch or a custom-duration edit) and used to
  // cause modes to appear "locked" even though the timer was never started.
  // Falls back to running/askDone for state persisted before this field
  // existed, so it self-heals for anyone already carrying the stale bug.
  const [sessionInProgress, setSessionInProgress] = useState(
    typeof persisted?.sessionInProgress === "boolean"
      ? persisted.sessionInProgress
      : !!(persisted?.running || persisted?.askDone)
  );

  // ISO time the countdown REALLY ended, set only when the app was closed /
  // backgrounded past the end time and noticed late (see finish()). null for
  // a normal on-time finish or early save (those end "now"). Lets the logged
  // session be dated when it actually ended instead of when the app was
  // reopened -- matters for anyone studying across midnight. Persisted so the
  // "What did you study?" card still knows it after a reload.
  const [finishedAt, setFinishedAt] = useState(persisted?.finishedAt || null);

  const endAtRef = useRef(
    persisted?.running && persisted?.mode !== STOPWATCH_MODE ? persisted?.endAt || null : null
  );
  // Stopwatch's equivalent of endAtRef: an absolute "counting started at"
  // timestamp that elapsed time is derived from, so (like the countdown's
  // endAt) it self-corrects after a throttled/backgrounded tab and survives
  // a full reload instead of drifting from decrementing/incrementing a
  // plain counter every tick.
  const stopwatchAnchorRef = useRef(
    persisted?.running && persisted?.mode === STOPWATCH_MODE ? persisted?.stopwatchAnchor || null : null
  );
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (persisted?.mode === STOPWATCH_MODE) {
      if (persisted?.running && persisted?.stopwatchAnchor) {
        return Math.max(0, Math.round((Date.now() - persisted.stopwatchAnchor) / 1000));
      }
      return typeof persisted?.secondsLeft === "number" ? persisted.secondsLeft : 0;
    }
    if (persisted?.running && persisted?.endAt) {
      return Math.max(0, Math.round((persisted.endAt - Date.now()) / 1000));
    }
    if (typeof persisted?.secondsLeft === "number") return persisted.secondsLeft;
    const mins = (persisted?.modeMinutes || DEFAULT_MODE_MINUTES)[persisted?.mode || "Pomodoro"];
    return (mins ?? 25) * 60;
  });

  const finishedRef = useRef(false);
  const audioCtxRef = useRef(null);
  const droneRef = useRef(null);
  const intervalRef = useRef(null);
  const notifiedPermissionRef = useRef(false);
  // Holds the resolve() for the Web Lock's holding promise while this tab
  // owns the "active session" lock -- calling it releases the lock. null
  // when this tab doesn't currently hold it.
  const lockReleaseRef = useRef(null);
  const lockBlockedTimeoutRef = useRef(null);
  // True for a few seconds right after this tab tried to Start while
  // another tab/window already held the active-session lock. Surfaced to
  // the UI so the person sees *why* Start didn't do anything, instead of it
  // silently no-op'ing.
  const [lockBlocked, setLockBlocked] = useState(false);

  const releaseTimerLock = useCallback(() => {
    if (lockReleaseRef.current) {
      lockReleaseRef.current();
      lockReleaseRef.current = null;
    }
  }, []);

  // Persist on every change relevant to resuming later.
  useEffect(() => {
    savePersisted({
      modeMinutes, mode, running, askDone, soundOn, radioChoice, radioCustomUrl, startedMinutes,
      secondsLeft, endAt: endAtRef.current, stopwatchAnchor: stopwatchAnchorRef.current,
      sessionInProgress, aggressiveMode, finishedAt,
    });
  }, [modeMinutes, mode, running, askDone, soundOn, radioChoice, radioCustomUrl, startedMinutes, secondsLeft, sessionInProgress, aggressiveMode, finishedAt]);

  useEffect(() => () => stopDroneOsc(audioCtxRef.current, droneRef), []);
  useEffect(() => () => {
    releaseTimerLock();
    clearTimeout(lockBlockedTimeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // BUG FIX (multi-tab clobbering): this hook has no leader election -- if
  // the app is open in more than one tab/window (very normal for a PWA:
  // relaunching from the home-screen icon while a browser tab was already
  // open, or two tabs of the same site), every instance independently ticks
  // its own countdown AND independently re-persists its own snapshot to the
  // same STORAGE_KEY every second, unaware of what any other instance is
  // doing. Repro that motivated this: Tab A saves/finishes a session (writes
  // running:false) but Tab B, still open and still ticking on its own stale
  // in-memory copy, overwrites that with running:true + its own leftover
  // remaining time on its very next 1s tick -- so a save (or a Reset) done
  // in one tab gets silently reverted a moment later by another tab that
  // never learned about it.
  //
  // The fix: listen for the native `storage` event, which the browser fires
  // in every OTHER tab/window (never the one that made the write) whenever
  // this key changes. On receiving one, treat the incoming payload as the
  // new source of truth and adopt it wholesale, instead of letting this
  // tab's own stale state keep winning the next race to write. This doesn't
  // need a lock: once every tab adopts every foreign write, they converge on
  // whichever tab acted most recently instead of fighting over which one's
  // clock wins. If two tabs happen to both reach a natural finish() in the
  // exact same instant (before either's write has propagated), each will
  // still log its own completion -- a narrow residual edge case a full
  // cross-tab lock would close, but not the "my save/reset didn't stick"
  // symptom this fixes.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      let incoming;
      try { incoming = JSON.parse(e.newValue); } catch { return; }

      const incomingMode = incoming.mode || "Pomodoro";
      const wasRunning = running;
      const nowRunning = !!incoming.running;

      setModeMinutesState((prev) => incoming.modeMinutes || prev);
      setModeRaw(incomingMode);
      setSoundOn(incoming.soundOn ?? true);
      setRadioChoice(incoming.radioChoice || "none");
      setRadioCustomUrl(incoming.radioCustomUrl || "");
      setStartedMinutes(incoming.startedMinutes || 0);
      setAskDone(!!incoming.askDone);
      setSessionInProgress(!!incoming.sessionInProgress);
      setAggressiveMode(!!incoming.aggressiveMode);
      setFinishedAt(incoming.finishedAt || null);

      endAtRef.current = incomingMode !== STOPWATCH_MODE && nowRunning ? (incoming.endAt || null) : null;
      stopwatchAnchorRef.current = incomingMode === STOPWATCH_MODE && nowRunning ? (incoming.stopwatchAnchor || null) : null;

      if (incomingMode === STOPWATCH_MODE) {
        setSecondsLeft(
          nowRunning && stopwatchAnchorRef.current
            ? Math.max(0, Math.round((Date.now() - stopwatchAnchorRef.current) / 1000))
            : (typeof incoming.secondsLeft === "number" ? incoming.secondsLeft : 0)
        );
      } else {
        setSecondsLeft(
          nowRunning && endAtRef.current
            ? Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000))
            : (typeof incoming.secondsLeft === "number" ? incoming.secondsLeft : 0)
        );
      }

      // A foreign tab just became the source of truth -- this tab's own
      // finishedRef guard is only meaningful for ITS OWN in-flight
      // finish()/saveEarly() call, not for a session another tab now owns.
      finishedRef.current = false;
      // If this tab had its own drone/chime running for a session that
      // another tab has now ended (saved/paused/reset), stop it here --
      // nothing else will, since none of this tab's own callbacks fired.
      if (wasRunning && !nowRunning) {
        stopDroneOsc(audioCtxRef.current, droneRef);
        // Another tab is now the authority saying this session is over --
        // if we were (or thought we were) the lock holder, let it go rather
        // than sit on it for a session that, as far as every tab agrees, has
        // already ended.
        releaseTimerLock();
      }
      setRunning(nowRunning);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, releaseTimerLock]);

  // Mount-time lock reacquisition. If we're hydrating into an
  // already-running session (persisted.running was true -- e.g. this very
  // tab was reloaded, or an install was relaunched into a session started
  // earlier), that happens by reading state directly rather than by calling
  // start(), so it would otherwise never actually claim the lock. Do it here
  // instead, once, right after mount. If some other context still genuinely
  // holds the lock (see the note on start() below for why that should only
  // ever be a fleeting race), we simply don't get it -- storage-event sync
  // is what keeps this tab's display honest either way.
  useEffect(() => {
    if (!running || typeof navigator === "undefined" || !navigator.locks || !navigator.locks.request) return;
    let cancelled = false;
    navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
      if (!lock || cancelled) return;
      return new Promise((resolve) => { lockReleaseRef.current = resolve; });
    }).catch(() => {});
    return () => { cancelled = true; };
    // Mount-only by design -- start()/pause()/reset()/saveEarly()/finish()
    // own acquisition and release from here on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    // If the app was closed/backgrounded past the end time and is only
    // noticing now, the session really ended at endAt, not now. Only treat it
    // as "late" past a small grace so a normal on-time finish (tick lag of
    // ~1s) is left completely untouched. Never in the future.
    const nowMs = Date.now();
    const lateEndAt = endAtRef.current && nowMs - endAtRef.current > LATE_FINISH_GRACE_MS ? endAtRef.current : null;
    const endedAtIso = lateEndAt ? new Date(lateEndAt).toISOString() : null;
    setFinishedAt(endedAtIso);
    setRunning(false);
    setSecondsLeft(0);
    setAskDone(true);
    endAtRef.current = null;
    releaseTimerLock();
    if (soundOn) {
      const ctx = makeCtx(audioCtxRef);
      stopDroneOsc(ctx, droneRef);
      playEndChime(ctx);
    }
    if (typeof document !== "undefined" && document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
      try { new Notification("Focus session complete! 🎉", { body: "Nice work — come log what you studied.", tag: "sb-focus-timer" }); } catch { /* ignore */ }
    }
    onCompleteRef.current && onCompleteRef.current({
      mode,
      plannedMinutes: Math.min(MAX_LOGGABLE_MINUTES, modeMinutes[mode] ?? 25),
      actualMinutes: Math.min(MAX_LOGGABLE_MINUTES, startedMinutes || modeMinutes[mode] || 25),
      completed: true,
      endedAt: endedAtIso,
    });
  }, [soundOn, mode, modeMinutes, startedMinutes, releaseTimerLock]);

  // Recompute the displayed time from the absolute anchor timestamp. Safe to
  // call often — on every tick, and also on visibility/focus changes so the
  // number snaps to the correct value the instant the app is reopened.
  // Countdown modes derive remaining time from endAtRef and auto-finish at
  // 0; Stopwatch derives elapsed time from stopwatchAnchorRef and NEVER
  // auto-finishes — by design it only ever ends when the user hits Save/Stop.
  const resync = useCallback(() => {
    if (!running) return;
    if (mode === STOPWATCH_MODE) {
      if (!stopwatchAnchorRef.current) return;
      const elapsed = Math.max(0, Math.round((Date.now() - stopwatchAnchorRef.current) / 1000));
      setSecondsLeft(elapsed);
      return;
    }
    if (!endAtRef.current) return;
    const remaining = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
    setSecondsLeft(remaining);
    if (remaining <= 0) finish();
  }, [running, finish, mode]);

  useEffect(() => {
    if (!running) {
      clearInterval(intervalRef.current);
      return;
    }
    resync();
    intervalRef.current = setInterval(resync, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, resync]);

  useEffect(() => {
    const onWake = () => { if (!document.hidden) resync(); };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("pageshow", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("pageshow", onWake);
    };
  }, [resync]);

  // Reflect the countdown in the tab title so it's visible even while
  // another page/app is open, without needing the Focus Timer page mounted.
  const defaultTitleRef = useRef(typeof document !== "undefined" ? document.title : "StudyBun");
  useEffect(() => {
    if (!running) {
      document.title = defaultTitleRef.current;
      return;
    }
    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const ss = String(secondsLeft % 60).padStart(2, "0");
    document.title = `${mm}:${ss} · ${mode} — StudyBun`;
  }, [secondsLeft, running, mode]);

  // For every countdown mode, elapsed = planned total minus what's left.
  // For Stopwatch there is no planned total — secondsLeft IS the elapsed
  // count (see resync above) — so it's used directly.
  const elapsedSeconds = !sessionInProgress
    ? 0
    : mode === STOPWATCH_MODE
      ? secondsLeft
      : (startedMinutes > 0 ? Math.max(0, startedMinutes * 60 - secondsLeft) : 0);
  // A session is "in progress" (and other modes should be blocked) once it's
  // running, paused with some real progress, or sitting at the "what did you
  // study" step waiting to be logged/discarded. Driven by the explicit
  // sessionInProgress flag (see its declaration above) rather than derived
  // arithmetic, which is what used to cause modes to lock without the timer
  // ever being started.
  const sessionActive = running || askDone || sessionInProgress;
  // Guard against losing a real chunk of a session (>5 min) to an accidental
  // mode tap — same threshold as the manual Save button below.
  const canSave = !askDone && elapsedSeconds >= 300;

  const changeMode = useCallback((m) => {
    if (m === mode) return;
    if (running || askDone || sessionInProgress) return; // blocked — finish, save, or reset first
    setModeRaw(m);
    setRunning(false);
    endAtRef.current = null;
    stopwatchAnchorRef.current = null;
    finishedRef.current = false;
    setSecondsLeft(m === STOPWATCH_MODE ? 0 : (modeMinutes[m] ?? 25) * 60);
    stopDroneOsc(audioCtxRef.current, droneRef);
  }, [mode, modeMinutes, running, askDone, sessionInProgress]);

  const setCustomMinutes = useCallback((m, mins) => {
    const clamped = Math.max(1, Math.min(240, Math.round(mins) || 1));
    setModeMinutesState((prev) => ({ ...prev, [m]: clamped }));
    // Only rewrite the live secondsLeft when there is truly no session to
    // protect (not running AND not paused-mid-session AND not sitting at the
    // post-session log step). Checking `!running` alone let a PAUSED session
    // have its secondsLeft silently overwritten here without touching
    // startedMinutes, which is exactly the exploit: pause -> shrink duration
    // -> elapsedSeconds (derived from startedMinutes*60 - secondsLeft) jumps
    // up instantly, making saveEarly() credit minutes that were never spent.
    if (m === mode && !running && !sessionInProgress) {
      setSecondsLeft(clamped * 60);
    }
  }, [mode, running, sessionInProgress]);

  const start = useCallback(() => {
    // Guard against spamming Start while the post-session "what did you
    // study" log card (askDone) is still up. Without this, finish() has
    // already set secondsLeft=0 and running=false but left sessionInProgress
    // true and startedMinutes at the full planned duration — calling start()
    // from that state re-arms the countdown with secondsLeft=0, so it
    // "finishes" again on the very next tick and credits a full session's
    // worth of minutes/points for zero real time. Must Save/Discard/Reset
    // (which all clear askDone) before a new session can start.
    if (askDone) return;

    const beginSession = () => {
      if (typeof Notification !== "undefined" && Notification.permission === "default" && !notifiedPermissionRef.current) {
        notifiedPermissionRef.current = true;
        Notification.requestPermission().catch(() => {});
      }
      finishedRef.current = false;
      setAskDone(false);
      setFinishedAt(null);
      const isStopwatch = mode === STOPWATCH_MODE;
      setStartedMinutes(isStopwatch ? 0 : modeMinutes[mode] ?? (Math.round(secondsLeft / 60) || 1));
      setSessionInProgress(true);
      if (isStopwatch) {
        // secondsLeft holds whatever elapsed count we're resuming from (0 on
        // a fresh start, or the paused value on resume) — anchor "now" to
        // that so counting continues seamlessly rather than restarting from 0.
        stopwatchAnchorRef.current = Date.now() - secondsLeft * 1000;
        endAtRef.current = null;
      } else {
        endAtRef.current = Date.now() + secondsLeft * 1000;
        stopwatchAnchorRef.current = null;
      }
      setRunning(true);
      if (soundOn) {
        const ctx = makeCtx(audioCtxRef);
        playStartChime(ctx);
        startDroneOsc(ctx, droneRef);
      }
    };

    // BUG FIX (anti-misuse): claim an exclusive, browser-arbitrated Web Lock
    // for this origin before actually starting anything, so this device can
    // never have two independent sessions ticking at once. The cross-tab
    // storage sync above already makes every open tab *mirror* whichever
    // session is running, but mirroring only kicks in after the fact — two
    // tabs that both hit Start in the same instant, before either has heard
    // about the other, would otherwise each briefly run their own
    // independent countdown, and someone could deliberately try to time
    // that gap to log two overlapping sessions. navigator.locks.request with
    // ifAvailable:true resolves immediately and atomically: exactly one of
    // any number of simultaneous callers gets the lock, because it's the
    // browser (not this tab's JS, which can't see other tabs) that decides.
    // We hold it open for as long as the session runs by not resolving the
    // callback's returned promise until pause/reset/saveEarly/finish calls
    // releaseTimerLock(). If the tab is killed instead of exiting normally,
    // the browser releases the lock for us automatically -- unlike a
    // hand-rolled "isRunning" flag in localStorage, this can never get stuck
    // permanently held by a tab that no longer exists.
    if (typeof navigator !== "undefined" && navigator.locks && navigator.locks.request) {
      navigator.locks
        .request(LOCK_NAME, { ifAvailable: true }, (lock) => {
          if (!lock) {
            setLockBlocked(true);
            clearTimeout(lockBlockedTimeoutRef.current);
            lockBlockedTimeoutRef.current = setTimeout(() => setLockBlocked(false), 4000);
            return;
          }
          setLockBlocked(false);
          beginSession();
          return new Promise((resolve) => { lockReleaseRef.current = resolve; });
        })
        .catch(() => beginSession()); // Locks API present but the request itself failed -- don't let that hard-block starting a timer
    } else {
      beginSession(); // No Web Locks support in this browser -- storage-event sync above is the fallback safety net
    }
  }, [mode, modeMinutes, secondsLeft, soundOn, askDone]);

  const pause = useCallback(() => {
    // BUG FIX: secondsLeft only gets updated once a second by the tick
    // interval — it's whatever resync() last computed, up to ~1s stale
    // by the moment this actually runs. Snap it to the precise
    // remaining/elapsed time right now, before freezing it, instead of
    // pausing on a slightly-stale number.
    if (mode === STOPWATCH_MODE) {
      if (stopwatchAnchorRef.current) {
        setSecondsLeft(Math.max(0, Math.round((Date.now() - stopwatchAnchorRef.current) / 1000)));
      }
    } else if (endAtRef.current) {
      setSecondsLeft(Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000)));
    }
    setRunning(false);
    endAtRef.current = null;
    stopwatchAnchorRef.current = null;
    releaseTimerLock();
    stopDroneOsc(audioCtxRef.current, droneRef);
  }, [mode, releaseTimerLock]);

  const reset = useCallback(() => {
    // Reset while the "What did you study?" card is still up = throwing away
    // a session that onComplete already logged. Running/paused sessions
    // haven't been logged yet, so there's nothing to remove for those.
    if (askDone) onSessionSettledRef.current && onSessionSettledRef.current({ discarded: true });
    setRunning(false);
    // Also clear askDone: without this, hitting the generic Reset button
    // while the post-session log card is showing zeroed out
    // startedMinutes/sessionInProgress underneath a log card that stayed
    // visible (askDone never cleared) — a stale hybrid state where logging
    // from that card would save a bogus 0-minute entry. Reset must always
    // fully clear a pending session, log card included.
    setAskDone(false);
    endAtRef.current = null;
    stopwatchAnchorRef.current = null;
    finishedRef.current = false;
    setSecondsLeft(mode === STOPWATCH_MODE ? 0 : (modeMinutes[mode] ?? 25) * 60);
    setStartedMinutes(0);
    setSessionInProgress(false);
    setFinishedAt(null);
    releaseTimerLock();
    stopDroneOsc(audioCtxRef.current, droneRef);
  }, [mode, modeMinutes, releaseTimerLock, askDone]);

  // Ends the session early (e.g. a 40-min timer wrapped up in 30) without
  // forcing the user to sit through the rest of the countdown — or, for
  // Stopwatch, this IS the normal way a session ends at all, since it has
  // no countdown to run out. Only fires once real progress (5+ min) has
  // been made — reuses the same "what did you study" logging step that a
  // natural finish triggers, but credits the actual elapsed time instead of
  // the full planned duration.
  //
  // completed: true — same as finish(). An earlier version of this function
  // marked early saves completed: false specifically to keep them out of
  // the leaderboard/streak "genuine session" bucket, but that threw away
  // real, honestly-earned study time for no good reason: the database's own
  // scoring function (lb_recompute in supabase/migration_leaderboard.sql)
  // already has purpose-built anti-cheat tolerance for exactly this case —
  // a session whose actual_minutes doesn't closely match planned_minutes
  // (which is always true for an early save) simply doesn't earn the flat
  // "+3 per completed session" bonus, but its minutes still correctly earn
  // the per-minute score (+0.5/min) and count toward the streak/active-day
  // once actual_minutes >= 10. So marking this completed: true now gives
  // early saves fair, proportional credit without opening any new way to
  // game the leaderboard — the existing DB-side check already handles it.
  // For Stopwatch, plannedMinutes is sent as null (there was never a
  // target), which the same DB check treats as an automatic pass — a full
  // Stopwatch session earns the flat completion bonus too, since by
  // definition it can only ever end when the user decides it's done.
  const saveEarly = useCallback(() => {
    // Same re-entrancy guard finish() already has. Without it, a fast
    // double-tap on the Save button (touchend+click both firing, common on
    // mobile/PWA) could run this twice before the first setAskDone(true) has
    // re-rendered the button away, logging two completed sessions for one
    // sit-down.
    if (finishedRef.current) return false;
    const isStopwatch = mode === STOPWATCH_MODE;
    // BUG FIX: same staleness issue as pause() above — secondsLeft can be
    // up to ~1s behind the real elapsed/remaining time since it's only
    // ever updated by the once-a-second tick. Recompute it precisely from
    // the anchor first (only meaningful while still running — a paused
    // session's secondsLeft is already frozen and accurate) so an early
    // save always credits the real elapsed time, not a slightly-stale one.
    let preciseSecondsLeft = secondsLeft;
    if (running) {
      if (isStopwatch && stopwatchAnchorRef.current) {
        preciseSecondsLeft = Math.max(0, Math.round((Date.now() - stopwatchAnchorRef.current) / 1000));
      } else if (!isStopwatch && endAtRef.current) {
        preciseSecondsLeft = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      }
    }
    const elapsed = isStopwatch ? preciseSecondsLeft : Math.max(0, startedMinutes * 60 - preciseSecondsLeft);
    const elapsedMinutes = Math.min(MAX_LOGGABLE_MINUTES, Math.round(elapsed / 60));
    if (elapsedMinutes < 5) return false;
    finishedRef.current = true;
    setRunning(false);
    endAtRef.current = null;
    stopwatchAnchorRef.current = null;
    releaseTimerLock();
    stopDroneOsc(audioCtxRef.current, droneRef);
    setStartedMinutes(elapsedMinutes);
    setSecondsLeft(0);
    setFinishedAt(null);
    setAskDone(true);
    if (soundOn) playEndChime(makeCtx(audioCtxRef));
    onCompleteRef.current && onCompleteRef.current({
      mode,
      plannedMinutes: isStopwatch ? null : Math.min(MAX_LOGGABLE_MINUTES, modeMinutes[mode] ?? 25),
      actualMinutes: elapsedMinutes,
      completed: true,
    });
    return true;
  }, [mode, modeMinutes, startedMinutes, secondsLeft, running, soundOn, releaseTimerLock]);

  const clearFinishedSession = useCallback(() => {
    setAskDone(false);
    setFinishedAt(null);
    setSecondsLeft(mode === STOPWATCH_MODE ? 0 : (modeMinutes[mode] ?? 25) * 60);
    setStartedMinutes(0);
    setSessionInProgress(false);
  }, [mode, modeMinutes]);

  // "Save session" path: the already-logged timer_sessions row is kept.
  const resetForNewSession = useCallback(() => {
    onSessionSettledRef.current && onSessionSettledRef.current({ discarded: false });
    clearFinishedSession();
  }, [clearFinishedSession]);

  // "Discard, don't count" path: also removes the row that was auto-logged
  // when the timer ended, so the minutes stop counting everywhere.
  const discardSession = useCallback(() => {
    onSessionSettledRef.current && onSessionSettledRef.current({ discarded: true });
    clearFinishedSession();
  }, [clearFinishedSession]);

  const toggleSound = useCallback(() => {
    setSoundOn((v) => {
      const next = !v;
      if (!next) stopDroneOsc(audioCtxRef.current, droneRef);
      else if (running) startDroneOsc(makeCtx(audioCtxRef), droneRef);
      return next;
    });
  }, [running]);

  const toggleAggressiveMode = useCallback(() => {
    setAggressiveMode((v) => {
      // Once aggressive mode is on and a session is actually running, that's
      // exactly the state it exists to protect -- so don't let this same
      // toggle be used to switch it off mid-session as a way to sneak past
      // the lock. It becomes editable again the moment running goes false
      // (pause, finish, or reset). Turning it ON (v === false) is never
      // blocked, since that can only arm/tighten the lock, never loosen it.
      if (v && running) return v; // no-op: stays on until the session stops
      return !v;
    });
  }, [running]);

  // Stopwatch has no target duration, so "percent complete" is a meaningless
  // (and, past 25 minutes of a fallback 1500s total, actively wrong/negative)
  // concept for it — total/pct are reported as null so the UI knows to hide
  // the progress bar rather than render a broken one.
  const isStopwatch = mode === STOPWATCH_MODE;
  const total = isStopwatch ? null : (modeMinutes[mode] ?? 25) * 60;
  const pct = isStopwatch ? null : (total > 0 ? ((total - secondsLeft) / total) * 100 : 0);

  // True only while the toggle above is actually refusing to flip -- i.e.
  // aggressive mode is armed AND a session is running. Lets the settings UI
  // grey out / disable the button and explain why, instead of it looking
  // clickable but silently doing nothing.
  const aggressiveModeLocked = aggressiveMode && running;

  return {
    modeMinutes, mode, running, askDone, soundOn, radioChoice, radioCustomUrl, startedMinutes,
    secondsLeft, total, pct, elapsedSeconds, canSave, sessionActive, aggressiveMode, finishedAt,
    aggressiveModeLocked, isStopwatch, lockBlocked,
    changeMode, setCustomMinutes, start, pause, reset, resetForNewSession, discardSession, saveEarly,
    toggleSound, setRadioChoice, setRadioCustomUrl, toggleAggressiveMode,
  };
}
