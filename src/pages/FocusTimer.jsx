import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Play, Pause, RefreshCw, Sparkles, CheckCircle2, Volume2, VolumeX,
  Pencil, Settings, Minus, Plus, X, AlertTriangle, Save, Lock, ShieldAlert, Users,
  Clock3, Flame, Info, ChevronDown, Maximize2,
} from "lucide-react";
import { Card, Btn, SectionTitle } from "../components/ui";
import Mascot from "../components/Mascot";
import StudyingNowCard from "../components/StudyingNowCard";
import FocusModeOverlay from "../components/FocusModeOverlay";
import FocusModeStyle from "../styles/FocusModeStyle";
import { SYLLABUS, getActiveSubjects } from "../data/syllabus";
import FocusMusicSettings, { FocusMusicMiniBar } from "../components/FocusMusicSettings";
import { todayIST, tsToISTDateStr } from "../lib/dateIST";
import { pauseDecor } from "../lib/decorPause";
import { STOPWATCH_MODE } from "../hooks/useFocusTimer";
import { useModalScrollLock } from "../hooks/useModalScrollLock";

const MODE_ORDER = ["Deep Focus", "Pomodoro", "Lecture", "Practice", "Revision", STOPWATCH_MODE];

// Fixed (non-random) slots so the sparkle motes never reshuffle position on
// an unrelated re-render -- same pattern DecorLayer uses for its backdrop.
const MOTE_SLOTS = [
  { top: "10%", left: "16%" }, { top: "18%", left: "82%" },
  { top: "86%", left: "22%" }, { top: "82%", left: "78%" },
];

// One short, mode-specific line for the companion rail on wide screens --
// purely a bit of encouragement, not tied to the timer's own state.
const MODE_TIPS = {
  "Deep Focus": "Long, uninterrupted focus. Silence notifications and let one topic have your full attention.",
  Pomodoro: "Short sharp bursts. Sprint for the interval, then actually take the break.",
  Lecture: "Following along beats multitasking — pause the video if you need to catch up on notes.",
  Practice: "Problems over passive reading. Attempt before you peek at the solution.",
  Revision: "Recall first, reread second. Testing yourself sticks better than skimming.",
  [STOPWATCH_MODE]: "No fixed end time — just start, study, and hit Save whenever you're done.",
};

// One static scene per mascot species (see /public/focus-scenes) for the
// companion rail's photo card on wide screens. Falls back to bunny if a
// species somehow has no matching file so the rail never renders broken.
const FOCUS_SCENES = {
  bunny: "/focus-scenes/bunny.jpeg",
  cat: "/focus-scenes/cat.jpeg",
  fox: "/focus-scenes/fox.jpeg",
  bear: "/focus-scenes/bear.jpeg",
  hamster: "/focus-scenes/hamster.jpeg",
  penguin: "/focus-scenes/penguin.jpeg",
  lion: "/focus-scenes/lion.jpeg",
  dragon: "/focus-scenes/dragon.jpeg",
  axolotl: "/focus-scenes/axolotl.jpeg",
};

// Small rotating set of quotes for the companion rail's quote card -- picked
// deterministically off the day of month (same pattern Dashboard.jsx uses
// for its own MOTIVATIONAL line) so it's stable all day and changes daily.
const FOCUS_QUOTES = [
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Well begun is half done.", author: "Aristotle" },
  { text: "Small daily improvements are the key to staggering long-term results.", author: "Anonymous" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Anonymous" },
  { text: "You don't have to see the whole staircase, just take the first step.", author: "Martin Luther King Jr." },
];

// Pulled out of the main render and memoized: everything this shows (mode,
// tip, photo, today/streak stats, week dots, quote) only ever changes when
// the mode is switched or once a day -- never on the timer's once-a-second
// tick. Without this split, that per-second countdown re-render was walking
// and re-diffing this entire card (including its background-image style
// object and the 7-day map) every single second for absolutely no visual
// change, on top of the actual GPU cost from the CSS animations. Desktop/wide
// screens only (see .sb-focus-side in GlobalStyle), but cheap to always
// mount since it renders null-equivalent (display:none) below that breakpoint.
const FocusSideRail = React.memo(function FocusSideRail({
  mode, mascot, focusScene, focusQuote, todayTimerHours, streak, weeklyData,
}) {
  return (
    <div className="sb-focus-side">
      <Card className="sb-focus-side-card" glass>
        <div
          className="sb-focus-side-img"
          style={{ backgroundImage: `url(${focusScene})` }}
          role="img"
          aria-label={`${mascot || "Mascot"} studying at a window`}
        />
        <div className="sb-focus-side-panel">
          <div className="sb-focus-side-heading">
            <span className="sb-focus-side-title">{mode}</span>
            <span className="sb-focus-side-title-bar" aria-hidden="true" />
          </div>
          <p className="sb-focus-side-tip">{MODE_TIPS[mode]}</p>

          {(typeof todayTimerHours === "number" || typeof streak === "number") && (
            <div className="sb-focus-side-stats">
              {typeof todayTimerHours === "number" && (
                <div className="sb-focus-stat-chip">
                  <span className="sb-focus-stat-chip-top"><Clock3 size={12} /> Today</span>
                  <span className="sb-focus-stat-chip-num">{todayTimerHours.toFixed(1)}h</span>
                </div>
              )}
              {typeof streak === "number" && (
                <div className="sb-focus-stat-chip">
                  <span className="sb-focus-stat-chip-top"><Flame size={12} /> Streak</span>
                  <span className="sb-focus-stat-chip-num">{streak}</span>
                </div>
              )}
            </div>
          )}

          {Array.isArray(weeklyData) && weeklyData.length > 0 && (
            <div className="sb-focus-side-week">
              {weeklyData.map((d, i) => {
                const isToday = i === weeklyData.length - 1;
                const active = (Number(d.hours) || 0) + (Number(d.timerHours) || 0) > 0;
                return (
                  <div key={i} className={`sb-focus-week-day ${isToday ? "today" : ""}`}>
                    <span className="sb-focus-week-letter">{(d.day || "?").charAt(0)}</span>
                    <span className={`sb-focus-week-dot ${active ? "done" : ""}`} />
                  </div>
                );
              })}
            </div>
          )}

          <div className="sb-focus-side-quote">
            <span className="sb-focus-side-quote-mark" aria-hidden="true">&ldquo;</span>
            <span className="sb-focus-side-quote-text">{focusQuote.text}</span>
            <span className="sb-focus-side-quote-author">— {focusQuote.author}</span>
          </div>
        </div>
      </Card>
    </div>
  );
});

export default function FocusTimer(p) {
  const t = p.focusTimer;
  const [editingDuration, setEditingDuration] = useState(false);
  const [durationDraft, setDurationDraft] = useState(t.modeMinutes[t.mode]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Info toggle for the "run this in one browser only" banner below — see
  // useFocusTimer's Web Lock, which only ever sees other tabs/windows of
  // THIS SAME browser (that's the boundary of navigator.locks + localStorage).
  // A different browser, or a regular vs incognito window of the same
  // browser, has entirely separate storage, so nothing here can technically
  // stop someone from running a second, independent timer that way. This
  // banner exists purely to make that loophole visible and unappealing to
  // use, since the lock itself can't close it.
  const [multiBrowserInfoOpen, setMultiBrowserInfoOpen] = useState(false);
  const [studyingOpen, setStudyingOpen] = useState(false);
  // Fullscreen distraction-free view -- see FocusModeOverlay.jsx. Only ever
  // opened by the person tapping the button below (never auto-opened), and
  // closes itself the moment a session finishes (needs the normal "what did
  // you study?" save flow, which only exists on this page).
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  // BUG FIX (critical): Reset used to fire instantly with zero confirmation,
  // even mid-session -- sitting one tap away from Pause/Save. A stray tap
  // (easy on mobile, where all three buttons sit close together) silently
  // wiped real, unsaved study progress with no undo. Every other destructive
  // action in the app (deleting a chat, a channel, a member) already goes
  // through a confirm step first; Reset was the one exception. Only prompts
  // when there's actually something to lose (t.sessionActive) -- resetting
  // an idle timer (e.g. after fiddling with a custom duration) still just
  // works instantly, same as before.
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const studyingCount = p.studyingIds ? p.studyingIds.size : 0;
  const studyingDialogRef = useRef(null);
  const settingsDialogRef = useRef(null);
  const confirmResetDialogRef = useRef(null);
  // BUG FIX: the "What did you study?" save-session card renders at the very
  // bottom of the page (see t.askDone below), often well past the fold --
  // the timer hero + companion rail above it are usually already a full
  // screen on their own. Nothing on screen signaled there was more to
  // scroll to, so people would finish a session, see the timer just sit
  // there looking "done" with no visible way to log it, and assume the app
  // had silently dropped their progress. A bouncing scroll-down cue (below)
  // only shows up while the save card genuinely isn't in view yet.
  const saveCardRef = useRef(null);
  const [showSaveScrollHint, setShowSaveScrollHint] = useState(false);
  // BUG FIX: this dialog reuses .sb-pt-overlay/.sb-pt-dialog (same chrome as
  // the Periodic Table's element detail and MessageInfoModal) but was
  // missing the scroll lock those two already have -- see
  // useModalScrollLock.js. Without it, touch-dragging the backdrop scrolled
  // .sb-main behind the dialog instead of just dimming it, which read as
  // "the overlay itself is scrollable" and felt especially heavy right
  // after a session finishes, when the Save-session card has just made the
  // page taller.
  useModalScrollLock(studyingDialogRef, studyingOpen);

  useEffect(() => { setDurationDraft(t.modeMinutes[t.mode]); }, [t.mode, t.modeMinutes]);
  // Belt-and-suspenders: close the duration popover the instant a session
  // becomes active, in case it was left open right as Start was pressed.
  // The real guard against a mid-session edit is inside setCustomMinutes
  // itself (see useFocusTimer.js), but the popover shouldn't sit open
  // pretending it can still do something.
  useEffect(() => { if (t.sessionActive) setEditingDuration(false); }, [t.sessionActive]);
  // BUG FIX: editingDuration was never reset on a plain mode switch (only
  // when sessionActive turned true). Repro: open the duration popover on
  // a countdown mode, tap the Stopwatch chip (allowed — no session
  // running) — the popover hides only because the render guard below
  // skips Stopwatch, but editingDuration itself stays true. Tap back to
  // any countdown mode and the popover reappears on its own, with no
  // pencil click. It also left the pencil button's next click toggling
  // off a stale `true` instead of opening a fresh popover. Mode switches
  // should always cancel an in-progress duration edit outright.
  useEffect(() => { setEditingDuration(false); }, [t.mode]);

  // Same Escape-to-close + initial-focus pattern as the Periodic Table's
  // element dialog (see ElementDetail in PeriodicTable.jsx) so every popup
  // dialog in the app behaves identically.
  useEffect(() => {
    if (!studyingOpen) return;
    studyingDialogRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") setStudyingOpen(false); };
    window.addEventListener("keydown", onKey);
    // See src/lib/decorPause.js -- this popup reuses .sb-pt-overlay, which
    // fully covers the decor layer while it's open.
    const resumeDecor = pauseDecor();
    return () => {
      window.removeEventListener("keydown", onKey);
      resumeDecor();
    };
  }, [studyingOpen]);

  // Timer settings used to render inline inside the hero card, which made
  // the hero grow taller than the companion rail every time it opened
  // (rail stayed fixed height -> mismatched card bottoms, broken look on
  // every breakpoint). It now pops up in its own dialog -- same
  // Escape-to-close + initial-focus pattern as the "who's studying" and
  // Periodic Table dialogs -- so the hero/side layout never shifts.
  useEffect(() => {
    if (!settingsOpen) return;
    settingsDialogRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") setSettingsOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  // Same Escape-to-close + initial-focus pattern as the other dialogs above.
  useEffect(() => {
    if (!confirmResetOpen) return;
    confirmResetDialogRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") setConfirmResetOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmResetOpen]);

  // Tracks whether the save-session card is actually on screen so the
  // bouncing hint (rendered further down) only shows while it's genuinely
  // out of view -- not for the entire time a session sits unsaved. Reset to
  // hidden whenever askDone goes false (card left the tree, saved/discarded)
  // so a stale hint never lingers into the next session.
  useEffect(() => {
    if (!t.askDone) { setShowSaveScrollHint(false); return; }
    const el = saveCardRef.current;
    // Same fallback as Reveal.jsx: without IntersectionObserver (old
    // browsers, jsdom in tests) just skip the hint rather than crash.
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowSaveScrollHint(!entry.isIntersecting),
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [t.askDone]);

  const scrollToSaveCard = () => {
    saveCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Gate: only interrupt with a confirm step when there's a real session to
  // lose. An idle timer (never started, or already reset) just resets.
  const handleResetClick = () => {
    if (t.sessionActive) setConfirmResetOpen(true);
    else t.reset();
  };
  const confirmReset = () => {
    setConfirmResetOpen(false);
    t.reset();
  };

  const mm = String(Math.floor(t.secondsLeft / 60)).padStart(2, "0");
  const ss = String(t.secondsLeft % 60).padStart(2, "0");

  // Same "day of month indexes into a fixed list" approach as Dashboard's
  // MOTIVATIONAL line -- deterministic, no extra state, changes once a day.
  const focusQuote = FOCUS_QUOTES[Number(todayIST().slice(8, 10)) % FOCUS_QUOTES.length];
  const focusScene = FOCUS_SCENES[p.mascot] || FOCUS_SCENES.bunny;

  const saveDuration = () => {
    t.setCustomMinutes(t.mode, durationDraft);
    setEditingDuration(false);
  };

  const activeSubjects = getActiveSubjects(p.profile);
  const [subject, setSubject] = useState(() => activeSubjects[0] || "Biology");
  const safeSubject = SYLLABUS[subject] ? subject : (activeSubjects[0] || "Biology");
  const [chapter, setChapter] = useState(() => Object.values(SYLLABUS[safeSubject].groups).flat()[0]);

  const logAndReset = () => {
    p.addSession({
      subject: safeSubject, chapter, session_type: t.mode === "Pomodoro" ? "Practice" : t.mode, minutes: t.startedMinutes, platform: "Focus Timer",
      // Late finish (app reopened after the timer ran out): file it under the day it really ended.
      ...(t.finishedAt ? { session_date: tsToISTDateStr(t.finishedAt) } : {}),
    });
    t.resetForNewSession();
  };
  const discardSession = () => t.discardSession();
  // Only set when a late-finished session lands on an earlier day than today
  // (e.g. timer ended 11:50pm, app reopened after midnight) so the card can
  // say which day the minutes went to instead of claiming "today".
  const lateEndDay = t.finishedAt && tsToISTDateStr(t.finishedAt) !== todayIST()
    ? new Date(t.finishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })
    : null;

  return (
    <div className="sb-page sb-focus-page">
      <div className="sb-focus-layout">
      <Card className={`sb-focus-hero ${t.running ? "sb-focus-running" : ""}`} glass>
        <span className="sb-focus-aura" aria-hidden="true" />
        {t.running && (
          <span className="sb-focus-motes" aria-hidden="true">
            {MOTE_SLOTS.map((pos, i) => (
              <span key={i} className="sb-focus-mote" style={{ ...pos, animationDelay: `${i * 0.7}s` }}>
                {i % 2 === 0 ? "✦" : "✧"}
              </span>
            ))}
          </span>
        )}

        <div className="sb-timer-topbar">
          <div className="sb-chip-row">
            {MODE_ORDER.map((m) => {
              const blocked = t.sessionActive && m !== t.mode;
              return (
                <button
                  key={m}
                  className={`sb-chip sb-focus-mode-chip ${t.mode === m ? "active" : ""}`}
                  onClick={() => t.changeMode(m)}
                  disabled={blocked}
                  title={blocked ? "Finish, save, or reset your current session to switch modes" : undefined}
                  style={blocked ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                >
                  {m === t.mode && blocked ? <Lock size={11} style={{ marginRight: 3, verticalAlign: -1 }} /> : null}
                  {m} <span className="sb-chip-mins">{m === STOPWATCH_MODE ? "∞" : `${t.modeMinutes[m]}m`}</span>
                </button>
              );
            })}
          </div>
          <div className="sb-timer-actions">
            {t.mode !== STOPWATCH_MODE && (
              <button
                className="sb-icon-round"
                title={t.sessionActive ? "Finish, save, or reset your current session to edit its duration" : "Set a custom time for this mode"}
                onClick={() => setEditingDuration((v) => !v)}
                disabled={t.sessionActive}
                style={t.sessionActive ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              >
                <Pencil size={15} />
              </button>
            )}
            <button
              className={`sb-icon-round sb-studying-btn ${studyingOpen ? "on" : ""}`}
              title={studyingCount > 0 ? `${studyingCount} studying right now` : "See who's studying now"}
              onClick={() => setStudyingOpen((v) => !v)}
            >
              <Users size={15} />
              {studyingCount > 0 && (
                <span className="sb-studying-btn-badge">{studyingCount > 99 ? "99+" : studyingCount}</span>
              )}
            </button>
            <button className={`sb-icon-round ${settingsOpen ? "on" : ""}`} title="Timer settings" onClick={() => setSettingsOpen((v) => !v)}>
              <Settings size={15} />
            </button>
            <button
              className="sb-icon-round"
              title={t.askDone ? "Save or discard your last session first" : "Focus Mode — fullscreen, distraction-free"}
              onClick={() => setFocusModeOpen(true)}
              disabled={t.askDone}
              style={t.askDone ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
            >
              <Maximize2 size={15} />
            </button>
            <button
              className={`sb-icon-round ${multiBrowserInfoOpen ? "on" : ""}`}
              title="Why can I only run one timer per device?"
              aria-expanded={multiBrowserInfoOpen}
              onClick={() => setMultiBrowserInfoOpen((v) => !v)}
            >
              <Info size={15} />
            </button>
          </div>
        </div>

        {multiBrowserInfoOpen && (
          <div className="sb-timer-guilt-banner" role="note">
            <AlertTriangle size={16} className="sb-timer-guilt-banner-icon" />
            <p className="sb-timer-guilt-banner-text">
              This only stops a second timer <b>in this same browser</b> — other tabs, other windows, even
              reopening the app. Firing it up in a <b>different browser</b>, or an incognito window, on the
              same device slips right past that and yeah, technically, your logged hours go up.
              <br />
              But nothing else does. Not your syllabus. Not how many problems you can actually solve. Not
              your rank on exam day. You'd just be quietly lying to a leaderboard number — the one thing in
              this app that was never the point. Run it in one browser. Let the number mean something.
            </p>
            <button
              className="sb-timer-guilt-banner-close"
              title="Close"
              aria-label="Close"
              onClick={() => setMultiBrowserInfoOpen(false)}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {t.sessionActive && !t.askDone && (
          <p className="sb-muted" style={{ fontSize: 11.5, margin: "6px 2px 0" }}>
            <Lock size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
            Other modes are locked until you save or reset this session — so a stray tap can't wipe your progress.
          </p>
        )}

        {editingDuration && t.mode !== STOPWATCH_MODE && (
          <div className="sb-duration-pop">
            <span className="sb-duration-pop-title">{t.mode} duration</span>
            <div className="sb-duration-stepper">
              <button onClick={() => setDurationDraft((v) => Math.max(1, v - 5))}><Minus size={14} /></button>
              <input
                type="number" min={1} max={240} value={durationDraft}
                onChange={(e) => setDurationDraft(Number(e.target.value) || 1)}
              />
              <span>min</span>
              <button onClick={() => setDurationDraft((v) => Math.min(240, v + 5))}><Plus size={14} /></button>
            </div>
            <div className="sb-duration-pop-actions">
              <Btn variant="ghost" onClick={() => setEditingDuration(false)}><X size={14} /> Cancel</Btn>
              <Btn onClick={saveDuration}><CheckCircle2 size={14} /> Save</Btn>
            </div>
          </div>
        )}

        <div className="sb-focus-stage">
          <div className="sb-focus-mascot-wrap">
            <span className="sb-focus-mascot-halo" aria-hidden="true" />
            <Mascot species={p.mascot} mood={t.running ? "studying" : "idle"} size={90} pettable />
          </div>
          <span className="sb-focus-mode-label">{t.mode}</span>
          <div className="sb-focus-time">
            {mm}<span className="sb-focus-colon">:</span>{ss}
          </div>
          {t.mode === STOPWATCH_MODE ? (
            <p className="sb-muted" style={{ fontSize: 11.5, marginTop: 4 }}>
              ⏱️ Counting up — no fixed end. Save whenever you're done.
            </p>
          ) : (
            <div className="sb-focus-track">
              <div className="sb-focus-fill" style={{ width: `${Math.min(100, Math.max(0, t.pct || 0))}%` }}>
                {t.pct > 3 && <span className="sb-focus-fill-paw">🐾</span>}
              </div>
            </div>
          )}
        </div>

        <div className="sb-timer-controls">
          {!t.running ? (
            <span title={t.askDone ? "Save or discard your last session below before starting a new one" : undefined}>
              <Btn
                onClick={t.start}
                disabled={t.askDone}
                style={t.askDone ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
              >
                <Play size={16} /> Start
              </Btn>
            </span>
          ) : <Btn variant="soft" onClick={t.pause}><Pause size={16} /> Pause</Btn>}
          {!t.askDone && (
            <span title={t.canSave ? `Save ${Math.round(t.elapsedSeconds / 60)} min so far and finish this session` : "Runs for 5+ min before you can save early"}>
              <Btn
                variant="soft"
                onClick={t.saveEarly}
                disabled={!t.canSave}
                style={!t.canSave ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
              >
                <Save size={16} /> Save{t.canSave ? ` (${Math.round(t.elapsedSeconds / 60)}m)` : ""}
              </Btn>
            </span>
          )}
          <Btn variant="ghost" onClick={handleResetClick}><RefreshCw size={16} /> Reset</Btn>
        </div>
        {t.lockBlocked && (
          <p className="sb-radio-error"><AlertTriangle size={14} /> A timer's already running in another tab/window on this device — switch there to pause/save it before starting a new one.</p>
        )}
        <FocusMusicMiniBar music={p.music} running={t.running} onOpenSettings={() => setSettingsOpen(true)} />
      </Card>

      <FocusSideRail
        mode={t.mode}
        mascot={p.mascot}
        focusScene={focusScene}
        focusQuote={focusQuote}
        todayTimerHours={p.todayTimerHours}
        streak={p.streak}
        weeklyData={p.weeklyData}
      />
      </div>

      {/* Both dialogs below (who's-studying, timer settings) are portaled
          out of .sb-main for the same reason as MessageInfoModal.jsx
          ("Seen by") and ConfirmDialog.jsx (delete confirm): .sb-main sets
          `contain: layout`, which makes it the containing block for
          `position: fixed` descendants. Left un-portaled, this overlay was
          "fixed" to .sb-main's own scrolled box instead of the viewport --
          scroll .sb-main down first (e.g. the bottom "session complete"
          card pushes this card mid-screen) and the scrim opened anchored to
          wherever .sb-main's top used to be, cutting off short of the real
          screen edges. Portal target is .sb-app (not document.body) so the
          dialog keeps every theme color it reads via inline custom
          properties on .sb-app. */}
      {studyingOpen && createPortal(
        <div className="sb-pt-overlay sb-studying-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setStudyingOpen(false); }}>
          <div
            className="sb-pt-dialog sb-studying-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Who's studying now"
            ref={studyingDialogRef}
            tabIndex={-1}
          >
            <button className="sb-pt-dialog-close" title="Close" aria-label="Close" onClick={() => setStudyingOpen(false)}>
              <X size={15} />
            </button>
            <StudyingNowCard studyingIds={p.studyingIds} userId={p.userId} bare />
          </div>
        </div>,
        document.querySelector(".sb-app") || document.body
      )}

      {settingsOpen && createPortal(
        <div className="sb-pt-overlay sb-timer-settings-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
          <div
            className="sb-pt-dialog sb-timer-settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Timer settings"
            ref={settingsDialogRef}
            tabIndex={-1}
          >
            <button className="sb-pt-dialog-close" title="Close" aria-label="Close" onClick={() => setSettingsOpen(false)}>
              <X size={15} />
            </button>
            <SectionTitle icon={Settings}>Timer Settings</SectionTitle>

            <div className="sb-timer-settings">
              <div className="sb-timer-settings-row">
                <span className="sb-timer-settings-label">Alert sounds</span>
                <button className={`sb-sound-toggle ${t.soundOn ? "on" : ""}`} onClick={t.toggleSound}
                  title={t.soundOn ? "Kawaii chime on start/finish, soft drone while focusing" : "Sound off"}>
                  {t.soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  <span>{t.soundOn ? "Sound on" : "Sound off"}</span>
                </button>
              </div>

              <div className="sb-timer-settings-row">
                <span className="sb-timer-settings-label">
                  <ShieldAlert size={16} style={{ marginRight: 4, verticalAlign: -3 }} />
                  Aggressive mode
                </span>
                <button
                  className={`sb-sound-toggle sb-aggressive-toggle ${t.aggressiveMode ? "on" : ""}`}
                  onClick={t.toggleAggressiveMode}
                  disabled={t.aggressiveModeLocked}
                  aria-disabled={t.aggressiveModeLocked}
                  title={
                    t.aggressiveModeLocked
                      ? "Locked — pause, save, or finish this session to turn it off"
                      : "Blocks switching to other pages while a session is running"
                  }
                >
                  {t.aggressiveMode ? <Lock size={18} /> : <ShieldAlert size={18} />}
                  <span>{t.aggressiveMode ? "Locked while running" : "Off"}</span>
                </button>
              </div>
              <p className="sb-aggressive-hint">
                {t.aggressiveMode
                  ? (t.running
                    ? "You're locked to this page and can't turn this off until you pause, save, or finish the session."
                    : "Armed — the moment you hit Start, other pages will be blocked until you pause or finish.")
                  : "When on, you can't wander off to other pages while a session is actively running — pausing always lets you leave."}
              </p>

              <FocusMusicSettings music={p.music} timerRunning={t.running} />
            </div>
          </div>
        </div>,
        document.querySelector(".sb-app") || document.body
      )}

      {confirmResetOpen && createPortal(
        <div className="sb-pt-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmResetOpen(false); }}>
          <div
            className="sb-pt-dialog sb-timer-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm reset"
            ref={confirmResetDialogRef}
            tabIndex={-1}
          >
            <button className="sb-pt-dialog-close" title="Close" aria-label="Close" onClick={() => setConfirmResetOpen(false)}>
              <X size={15} />
            </button>
            <SectionTitle icon={AlertTriangle}>Reset this session?</SectionTitle>
            <p className="sb-muted" style={{ fontSize: 13, lineHeight: 1.5, margin: "4px 0 4px" }}>
              {t.elapsedSeconds >= 60
                ? `You've put in ${Math.round(t.elapsedSeconds / 60)} min on this ${t.mode} session. Resetting throws it away — it won't be saved or counted.`
                : `Resetting will discard this ${t.mode} session. It won't be saved or counted.`}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <Btn variant="ghost" onClick={() => setConfirmResetOpen(false)}>Cancel</Btn>
              <Btn variant="soft" onClick={confirmReset}><RefreshCw size={14} /> Reset anyway</Btn>
            </div>
          </div>
        </div>,
        document.querySelector(".sb-app") || document.body
      )}

      {t.askDone && (
        <div ref={saveCardRef}>
          <Card>
            <SectionTitle icon={Sparkles}>What did you study?</SectionTitle>
            <p className="sb-timer-logged-note">
              {lateEndDay
                ? `Your ${t.startedMinutes} min is counted on ${lateEndDay} (when the timer actually ended)`
                : `Your ${t.startedMinutes} min is counted in today's study hours`}
              {" "}— tag it with a chapter so it also updates your syllabus progress, or discard it to remove it.
            </p>
            <div className="sb-form-grid">
              <div><label>Subject</label>
                <select className="sb-input" value={safeSubject} onChange={(e) => { setSubject(e.target.value); setChapter(Object.values(SYLLABUS[e.target.value].groups).flat()[0]); }}>
                  {activeSubjects.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><label>Chapter</label>
                <select className="sb-input" value={chapter} onChange={(e) => setChapter(e.target.value)}>
                  {Object.entries(SYLLABUS[safeSubject].groups).map(([grp, chs]) => (
                    <optgroup key={grp} label={safeSubject === "Biology" ? `${grp === "Botany" ? "🌱 Section A: Botany" : "🧬 Section B: Zoology"}` : grp}>
                      {chs.map((c) => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={logAndReset}><CheckCircle2 size={16} /> Save session</Btn>
              <Btn variant="ghost" onClick={discardSession}><X size={16} /> Discard, don't count</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* Portaled (same reason as the dialogs above -- .sb-main's
          `contain: layout` would otherwise turn this "fixed" button into
          something that scrolls away with the page instead of staying
          pinned to the screen) bouncing cue pointing at the save-session
          card once a session ends. Only shows while that card is actually
          out of view; disappears the moment it scrolls on screen. */}
      {t.askDone && showSaveScrollHint && createPortal(
        <button
          type="button"
          className="sb-save-scroll-hint"
          onClick={scrollToSaveCard}
          title="Scroll down to save your session"
          aria-label="Scroll down to save your session"
        >
          <ChevronDown size={22} />
        </button>,
        document.querySelector(".sb-app") || document.body
      )}

      {focusModeOpen && (
        <>
          <FocusModeStyle />
          <FocusModeOverlay
            t={t}
            mascot={p.mascot}
            savedScene={p.focusModeScene}
            onSceneChange={p.saveFocusModeScene}
            onClose={(info) => {
              setFocusModeOpen(false);
              // Session ended inside Focus Mode: bring the save card into view
              // once the overlay is gone and fullscreen has fully exited.
              if (info?.finished) setTimeout(scrollToSaveCard, 120);
            }}
          />
        </>
      )}
    </div>
  );
}
