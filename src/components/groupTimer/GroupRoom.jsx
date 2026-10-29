import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Info, Settings, Play, Pause, Save, RefreshCw, Pencil, Minus, Plus, X, Lock,
  CheckCircle2, Sparkles, AlertTriangle, Globe2, Users, WifiOff, BookOpen, Target, SmilePlus, Bell, Send, ThumbsDown,
} from "lucide-react";
import { Btn, SectionTitle, EmptyState } from "../ui";
import GtDialog from "./GtDialog";
import MemberAvatar from "./MemberAvatar";
import { useProfileMap } from "./useProfileMap";
import { GroupStatsCard, GroupRecapCard } from "./GroupStats";
import { GroupRosterDialog, GroupManageDialog } from "./GroupHost";
import { GroupSettingsDialog, GroupInfoDialog } from "./GroupDialogs";
import { SYLLABUS } from "../../data/syllabus";
import { DEFAULT_MODE_MINUTES, STOPWATCH_MODE } from "../../hooks/useFocusTimer";
import { fetchMemberCount } from "../../hooks/useStudyGroups";
import { tsToISTDateStr } from "../../lib/dateIST";
import { gifById, plateFor, fmtClock, liveElapsed, comparePhase, timeAgo, GT_CHEERS, sanitizeGoal } from "../../lib/groupTimer";

const MODE_ORDER = [...Object.keys(DEFAULT_MODE_MINUTES), STOPWATCH_MODE];
const SUBJECTS = Object.keys(SYLLABUS);

const PHASE_LABEL = {
  studying: "Studying",
  paused: "Paused",
  done: "Just finished",
  idle: "In the room",
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

// Ticks once a second, but only while someone is actually studying -- an
// empty or all-paused room costs nothing.
function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/* ------------------------------------------------------------------ */
/* Right pane: who is studying                                          */
/* ------------------------------------------------------------------ */
const MemberCard = React.memo(function MemberCard({
  entry, profile, isMe, locked, pausedMin, cheerOpen, onToggleCheer, onCheer, nudgeable, nudged, onNudge,
}) {
  const subjectColor = SYLLABUS[entry.subject]?.color;
  const pct = entry.total && entry.phase !== "idle" ? Math.min(100, (entry.seconds / entry.total) * 100) : null;
  const showClock = entry.phase !== "idle";
  const canCheer = !isMe && !locked && (entry.phase === "studying" || entry.phase === "paused");
  return (
    <li className={`sb-gt-card ${entry.phase} ${isMe ? "me" : ""}`}>
      {canCheer && (
        <button type="button" className="sb-gt-cheer-btn" aria-label={`Cheer ${profile?.name || "them"} on`} aria-expanded={cheerOpen} onClick={onToggleCheer}>
          <SmilePlus size={14} />
        </button>
      )}
      {cheerOpen && canCheer && (
        <div className="sb-gt-cheer-pop" role="menu" aria-label="Pick a cheer">
          {GT_CHEERS.map((e) => (
            <button key={e} type="button" role="menuitem" onClick={() => onCheer(e)}>{e}</button>
          ))}
        </div>
      )}
      <span className="sb-gt-card-avatar">
        <MemberAvatar species={profile?.mascot} studying={entry.phase === "studying"} />
      </span>
      <span className="sb-gt-card-name">{isMe ? "You" : (profile?.name || "Study Buddy")}</span>
      <span className="sb-gt-card-state">
        <span className="sb-gt-dot" aria-hidden="true" /> {PHASE_LABEL[entry.phase] || "In the room"}
        {entry.phase === "paused" && pausedMin > 0 ? ` · ${pausedMin}m` : ""}
      </span>
      {showClock ? (
        <span className="sb-gt-card-time" aria-label={`${Math.floor(entry.seconds / 60)} minutes`}>{fmtClock(entry.seconds)}</span>
      ) : (
        <span className="sb-gt-card-time sb-gt-card-time-idle" aria-hidden="true">–:––</span>
      )}
      {pct !== null && (
        <span className="sb-gt-card-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
      )}
      {entry.phase !== "idle" && entry.subject && (
        <span className="sb-gt-card-subject" style={subjectColor ? { background: subjectColor } : undefined} title={entry.topic || entry.subject}>
          {entry.subject}{entry.topic ? ` · ${entry.topic}` : ""}
        </span>
      )}
      {entry.goal && (
        <span className="sb-gt-card-goal" title={entry.goal}><Target size={11} aria-hidden="true" /> {entry.goal}</span>
      )}
      {nudgeable && (
        <button type="button" className="sb-gt-nudge-btn" onClick={onNudge} disabled={nudged}>
          <Bell size={12} /> {nudged ? "Nudged ✓" : "Nudge"}
        </button>
      )}
    </li>
  );
});

function feedText(item, me, name) {
  const who = item.from === me ? "You" : name(item.from);
  const whom = item.to ? (item.to === me ? "you" : name(item.to)) : "the room";
  if (item.type === "cheer") return `${who} sent ${whom} ${item.emoji}`;
  if (item.type === "nudge") return `${who} nudged ${whom} 🔔`;
  if (item.type === "goal") {
    const mins = item.minutes ? ` · ${item.minutes}m` : "";
    return item.done ? `${who} finished “${item.goal}” ✅${mins}` : `${who} didn't get to “${item.goal}” ❌${mins}`;
  }
  return "";
}

function RoomFeed({ feed, userId, profiles, locked, onCheerRoom }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(null);
  const name = (id) => profiles.get(id)?.name || "Someone";
  const pick = (e) => {
    const res = onCheerRoom(e);
    setNote(res.ok ? null : res.reason === "slow" ? "Easy — one cheer every few seconds." : res.reason === "offline" ? "Not connected yet." : null);
    if (res.ok) setOpen(false);
  };
  return (
    <div className="sb-gt-feed">
      <div className="sb-gt-feed-head">
        <span><Send size={13} aria-hidden="true" /> Room feed</span>
        {!locked && (
          <button type="button" className="sb-gt-link-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <SmilePlus size={13} /> Cheer the room
          </button>
        )}
      </div>
      {open && !locked && (
        <div className="sb-gt-cheer-row" role="menu" aria-label="Cheer the room">
          {GT_CHEERS.map((e) => <button key={e} type="button" role="menuitem" onClick={() => pick(e)}>{e}</button>)}
        </div>
      )}
      {note && <p className="sb-gt-feed-note" role="status">{note}</p>}
      {feed.length === 0 ? (
        <p className="sb-muted sb-gt-feed-empty">Cheers and goal results show up here live. It isn't saved.</p>
      ) : (
        <ul className="sb-gt-feed-list">
          {feed.slice(0, 12).map((f) => (
            <li key={f.id} className={f.type}>
              <span>{feedText(f, userId, name)}</span>
              <time>{timeAgo(f.at)}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MembersPane({ others, self, userId, myMascot, myName, connected, group, clockOffset, room }) {
  const anyStudying = self.phase === "studying" || others.some((m) => m.phase === "studying");
  const anyPaused = others.some((m) => m.phase === "paused");
  const now = useNow(anyStudying || anyPaused);
  const feedIds = useMemo(() => room.feed.flatMap((f) => [f.from, f.to]).filter(Boolean), [room.feed]);
  const profiles = useProfileMap(useMemo(() => [...others.map((m) => m.userId), ...feedIds], [others, feedIds]));
  const locked = !!group.focus_lock;
  const [cheerFor, setCheerFor] = useState(null);

  // Don't flash a warning on the very first connect: only say the list may
  // be stale once it's been disconnected for a moment.
  const [showOffline, setShowOffline] = useState(false);
  useEffect(() => {
    if (connected) { setShowOffline(false); return undefined; }
    const id = setTimeout(() => setShowOffline(true), 3000);
    return () => clearTimeout(id);
  }, [connected]);

  // Close the cheer picker on Escape / outside click.
  useEffect(() => {
    if (!cheerFor) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setCheerFor(null); };
    const onDown = (e) => { if (!e.target.closest?.(".sb-gt-cheer-pop, .sb-gt-cheer-btn")) setCheerFor(null); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [cheerFor]);

  const serverNow = now + (clockOffset || 0);
  const entries = useMemo(() => others
    .map((m) => ({ ...m, seconds: liveElapsed(m, serverNow) }))
    .sort((a, b) => comparePhase(a.phase, b.phase)
      || (profiles.get(a.userId)?.name || "").localeCompare(profiles.get(b.userId)?.name || "")
      || a.userId.localeCompare(b.userId)),
  [others, serverNow, profiles]);

  const studyingCount = entries.filter((e) => e.phase === "studying").length + (self.phase === "studying" ? 1 : 0);
  const inRoom = entries.length + 1;
  const alone = entries.length === 0;

  return (
    <section className="sb-card sb-gt-members" aria-label="Studying now">
      <SectionTitle
        icon={Users}
        right={(
          <span className="sb-studying-live-badge">
            <span className="sb-studying-live-dot" /> {studyingCount} studying
          </span>
        )}
      >
        Studying now
      </SectionTitle>
      <p className="sb-gt-members-sub">{inRoom} in this room</p>

      {locked && (
        <p className="sb-gt-locked-note" role="status">
          <Lock size={13} /> Focus lock is on — cheers and nudges are paused. Timers, goals and stats still work.
        </p>
      )}
      {showOffline && (
        <p className="sb-gt-offline" role="status">
          <WifiOff size={14} /> Reconnecting to the room… others may look out of date for a moment.
        </p>
      )}

      <ul className="sb-gt-card-grid">
        <MemberCard key={userId} isMe locked={locked} profile={{ name: myName, mascot: myMascot }} entry={self} />
        {entries.map((e) => {
          const nudgeable = room.canNudge(e, now);
          const pausedMin = e.phase === "paused" && e.since ? Math.max(0, Math.floor((serverNow - e.since) / 60000)) : 0;
          return (
            <MemberCard
              key={e.userId}
              entry={e}
              profile={profiles.get(e.userId)}
              isMe={false}
              locked={locked}
              pausedMin={pausedMin}
              cheerOpen={cheerFor === e.userId}
              onToggleCheer={() => setCheerFor((v) => (v === e.userId ? null : e.userId))}
              onCheer={(emoji) => { room.cheer(e.userId, emoji); setCheerFor(null); }}
              nudgeable={nudgeable || (e.phase === "paused" && pausedMin >= 5 && !locked)}
              nudged={!nudgeable}
              onNudge={() => room.nudge(e)}
            />
          );
        })}
      </ul>

      {alone && (
        <div className="sb-gt-alone">
          <EmptyState
            mascot={myMascot}
            mood="idle"
            text="You're the first one here"
            sub={group.is_public
              ? "Others will show up here the moment they join and start studying."
              : "Share the code from the (i) button and they'll show up here."}
          />
        </div>
      )}

      <RoomFeed feed={room.feed} userId={userId} profiles={profiles} locked={locked} onCheerRoom={(emoji) => room.cheer(null, emoji)} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Left pane: the timer                                                 */
/* ------------------------------------------------------------------ */
function SaveForm({ t, subject: roomSubject, addSession, goal, reportGoal }) {
  // Mounted only once a session has ended (askDone), so the room's current
  // subject is exactly the right default.
  const [subject, setSubject] = useState(roomSubject);
  const chaptersFor = (s) => Object.values(SYLLABUS[s].groups).flat();
  const [chapter, setChapter] = useState(() => chaptersFor(roomSubject)[0]);

  // Accountability: if a goal was declared, say whether it got done (shown to
  // the room). Saving needs an answer; discarding counts as "not done".
  const [result, setResult] = useState(null); // null | true | false
  const hasGoal = !!sanitizeGoal(goal);

  const discard = () => {
    if (hasGoal) reportGoal(false);
    t.discardSession();
  };

  const save = () => {
    if (hasGoal) { if (result === null) return; reportGoal(result); }
    addSession({
      subject, chapter, session_type: t.mode === "Pomodoro" ? "Practice" : t.mode, minutes: t.startedMinutes, platform: "Focus Timer",
      ...(t.finishedAt ? { session_date: tsToISTDateStr(t.finishedAt) } : {}),
    });
    t.resetForNewSession();
  };

  return (
    <div className="sb-gt-save">
      <SectionTitle icon={Sparkles}>What did you study?</SectionTitle>
      <p className="sb-timer-logged-note">
        Your {t.startedMinutes} min already counts in today's study hours — tag a chapter to update your syllabus too, or discard it.
      </p>
      <div className="sb-form-grid dense">
        <div>
          <label htmlFor="sb-gt-save-subject">Subject</label>
          <select
            id="sb-gt-save-subject"
            className="sb-input"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); setChapter(chaptersFor(e.target.value)[0]); }}
          >
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sb-gt-save-chapter">Chapter</label>
          <select id="sb-gt-save-chapter" className="sb-input" value={chapter} onChange={(e) => setChapter(e.target.value)}>
            {chaptersFor(subject).map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      {hasGoal && (
        <div className="sb-gt-goal-check" role="radiogroup" aria-label="Did you finish your goal?">
          <span className="sb-gt-goal-q"><Target size={13} /> Did you finish “{sanitizeGoal(goal)}”?</span>
          <div className="sb-gt-goal-opts">
            <button type="button" role="radio" aria-checked={result === true} className={`sb-chip small ${result === true ? "active" : ""}`} onClick={() => setResult(true)}><CheckCircle2 size={13} /> Done</button>
            <button type="button" role="radio" aria-checked={result === false} className={`sb-chip small ${result === false ? "active" : ""}`} onClick={() => setResult(false)}><ThumbsDown size={13} /> Not done</button>
          </div>
        </div>
      )}
      <div className="sb-gt-save-actions">
        <Btn onClick={save} disabled={hasGoal && result === null}><CheckCircle2 size={16} /> Save session</Btn>
        <Btn variant="ghost" onClick={discard}><X size={16} /> Discard, don't count</Btn>
      </div>
      {hasGoal && result === null && <p className="sb-muted sb-gt-foot">Pick Done or Not done to save — the room sees the result.</p>}
    </div>
  );
}

function TimerPane({ t, g, settings, addSession, onOpenSettings }) {
  const gif = gifById(settings.gif);
  const plate = plateFor(settings.color);
  const [editingDuration, setEditingDuration] = useState(false);
  const [durationDraft, setDurationDraft] = useState(t.modeMinutes[t.mode]);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => { setDurationDraft(t.modeMinutes[t.mode]); }, [t.mode, t.modeMinutes]);
  // Same guards the Focus Timer page has: a duration edit can never stay open
  // across a session start or a mode switch.
  useEffect(() => { if (t.sessionActive) setEditingDuration(false); }, [t.sessionActive]);
  useEffect(() => { setEditingDuration(false); }, [t.mode]);

  const handleReset = () => (t.sessionActive ? setConfirmReset(true) : t.reset());

  const statusClass = t.running ? "running" : t.askDone ? "done" : t.sessionActive ? "paused" : "idle";
  const statusText = t.running ? "Focusing" : t.askDone ? "Session complete" : t.sessionActive ? "Paused" : "Ready";
  const subjectLine = g.topic ? `${g.subject} · ${g.topic}` : g.subject;
  const stopwatch = t.mode === STOPWATCH_MODE;

  return (
    <section
      className={`sb-card sb-gt-timer ${t.running ? "is-running" : ""}`}
      aria-label="Group timer"
      style={{ "--gt-color": settings.color, "--gt-plate": plate.background, "--gt-edge": plate.edge }}
    >
      <div className="sb-gt-stage">
        {/* Decorative. `key` makes React swap the element so a new GIF always
            restarts from frame 0 instead of keeping the old decode. */}
        <img key={gif.id} className="sb-gt-gif" src={gif.src} alt="" draggable={false} decoding="async" />
        <span className="sb-gt-scrim" aria-hidden="true" />

        <div className="sb-gt-stage-top">
          <span className={`sb-gt-status ${statusClass}`}><span className="sb-gt-dot" aria-hidden="true" /> {statusText}</span>
          <button type="button" className="sb-gt-gear" title="Room settings" aria-label="Room settings" onClick={onOpenSettings}>
            <Settings size={17} />
          </button>
        </div>

        <div className="sb-gt-stage-center">
          <div className="sb-gt-plate">
            <span className="sb-gt-time" role="timer" aria-live="off" aria-label={`${stopwatch ? "Elapsed" : "Remaining"} ${fmtClock(t.secondsLeft)}`}>
              {fmtClock(t.secondsLeft)}
            </span>
          </div>
          <p className="sb-gt-subject-line">
            <BookOpen size={14} aria-hidden="true" /> {subjectLine}
          </p>
          {sanitizeGoal(g.goal) && (
            <p className="sb-gt-subject-line sb-gt-goal-line">
              <Target size={14} aria-hidden="true" /> {sanitizeGoal(g.goal)}
            </p>
          )}
        </div>

        {!stopwatch && (
          <span className="sb-gt-stage-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, t.pct || 0))}%` }} /></span>
        )}
      </div>

      <div className="sb-gt-footer">
        {t.askDone ? (
          <SaveForm t={t} subject={g.subject} addSession={addSession} goal={g.goal} reportGoal={g.reportGoal} />
        ) : (
          <>
            <div className="sb-gt-modes">
              {MODE_ORDER.map((m) => {
                const blocked = t.sessionActive && m !== t.mode;
                return (
                  <button
                    key={m}
                    type="button"
                    className={`sb-chip small sb-focus-mode-chip ${t.mode === m ? "active" : ""}`}
                    onClick={() => t.changeMode(m)}
                    disabled={blocked}
                    title={blocked ? "Finish, save, or reset your current session to switch modes" : undefined}
                    style={blocked ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                  >
                    {m === t.mode && blocked ? <Lock size={10} style={{ marginRight: 3, verticalAlign: -1 }} /> : null}
                    {m} <span className="sb-chip-mins">{m === STOPWATCH_MODE ? "∞" : `${t.modeMinutes[m]}m`}</span>
                  </button>
                );
              })}
              {!stopwatch && (
                <button
                  type="button"
                  className="sb-icon-round sb-gt-pencil"
                  title={t.sessionActive ? "Finish, save, or reset your current session to edit its duration" : "Set a custom time for this mode"}
                  aria-label="Edit duration"
                  onClick={() => setEditingDuration((v) => !v)}
                  disabled={t.sessionActive}
                  style={t.sessionActive ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>

            {editingDuration && !stopwatch && (
              <div className="sb-duration-pop sb-gt-duration">
                <span className="sb-duration-pop-title">{t.mode} duration</span>
                <div className="sb-duration-stepper">
                  <button type="button" aria-label="5 minutes less" onClick={() => setDurationDraft((v) => Math.max(1, v - 5))}><Minus size={14} /></button>
                  <input
                    type="number" min={1} max={240} value={durationDraft} aria-label="Minutes"
                    onChange={(e) => setDurationDraft(Number(e.target.value) || 1)}
                  />
                  <span>min</span>
                  <button type="button" aria-label="5 minutes more" onClick={() => setDurationDraft((v) => Math.min(240, v + 5))}><Plus size={14} /></button>
                </div>
                <div className="sb-duration-pop-actions">
                  <Btn variant="ghost" onClick={() => setEditingDuration(false)}><X size={14} /> Cancel</Btn>
                  <Btn onClick={() => { t.setCustomMinutes(t.mode, durationDraft); setEditingDuration(false); }}><CheckCircle2 size={14} /> Save</Btn>
                </div>
              </div>
            )}

            <div className="sb-gt-subject-row">
              <div className="sb-gt-subject-chips" role="radiogroup" aria-label="Subject">
                {SUBJECTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={g.subject === s}
                    className={`sb-chip small ${g.subject === s ? "active" : ""}`}
                    onClick={() => g.setSubject(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <input
                className="sb-input small sb-gt-topic"
                value={g.topic}
                maxLength={60}
                placeholder="Topic you're focusing on (optional)"
                aria-label="Topic you're focusing on"
                onChange={(e) => g.setTopic(e.target.value)}
              />
              <input
                className="sb-input small sb-gt-topic"
                value={g.goal}
                maxLength={60}
                disabled={t.sessionActive}
                placeholder={t.sessionActive ? "Goal is locked while your session runs" : "Goal for this session (optional) — e.g. 20 PYQs on Rotation"}
                aria-label="Goal for this session"
                onChange={(e) => g.setGoal(e.target.value)}
              />
            </div>

            <div className="sb-gt-controls">
              {!t.running ? (
                <Btn onClick={t.start}><Play size={16} /> Start</Btn>
              ) : (
                <Btn variant="soft" onClick={t.pause}><Pause size={16} /> Pause</Btn>
              )}
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
              <Btn variant="ghost" onClick={handleReset}><RefreshCw size={16} /> Reset</Btn>
            </div>
            {t.lockBlocked && (
              <p className="sb-radio-error"><AlertTriangle size={14} /> A timer's already running in another tab/window on this device — switch there to pause/save it first.</p>
            )}
          </>
        )}
      </div>

      {confirmReset && (
        <GtDialog onClose={() => setConfirmReset(false)} label="Confirm reset" className="sb-gt-confirm-dialog">
          <SectionTitle icon={AlertTriangle}>Reset this session?</SectionTitle>
          <p className="sb-muted" style={{ fontSize: 13, lineHeight: 1.5, margin: "4px 0 4px" }}>
            {t.elapsedSeconds >= 60
              ? `You've put in ${Math.round(t.elapsedSeconds / 60)} min on this ${t.mode} session. Resetting throws it away — it won't be saved or counted.`
              : `Resetting will discard this ${t.mode} session. It won't be saved or counted.`}
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
            <Btn variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Btn>
            <Btn variant="soft" onClick={() => { setConfirmReset(false); t.reset(); }}><RefreshCw size={14} /> Reset anyway</Btn>
          </div>
        </GtDialog>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The room page                                                        */
/* ------------------------------------------------------------------ */
export default function GroupRoom({
  group, userId, mascot, myName, canDelete, isHost, settings, onSettingsChange,
  timer: t, room: g, addSession, onBack, onLeaveGroup, onDeleteGroup,
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [memberCount, setMemberCount] = useState(null);

  // Member count for the info popup -- fetched on open, never polled.
  useEffect(() => {
    if (!infoOpen) return undefined;
    let cancelled = false;
    fetchMemberCount(group.id).then((n) => { if (!cancelled) setMemberCount(n); });
    return () => { cancelled = true; };
  }, [infoOpen, group.id]);

  // Fresh roster whenever the Members popup opens.
  useEffect(() => { if (rosterOpen) g.refreshRoster(true); }, [rosterOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // My own card is built from my real, local timer (never echoed back from
  // the network), so it's always instantly correct even if presence is
  // mid-reconnect.
  const self = {
    userId,
    phase: g.phase,
    subject: g.subject,
    topic: g.topic,
    goal: sanitizeGoal(g.goal),
    mode: t.mode,
    seconds: g.phase === "idle" ? 0 : Math.round(t.elapsedSeconds || 0),
    total: t.total || null,
  };

  // Presence lookup for the roster dialog (online / studying badges).
  const presence = useMemo(() => ({
    self,
    others: new Map(g.members.map((m) => [m.userId, m])),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [g.members, g.phase]);

  // The room's numbers re-read from the server when MY session ends / is discarded.
  const statsToken = `${t.askDone ? 1 : 0}-${t.sessionActive ? 1 : 0}`;

  return (
    <div className="sb-gt-room">
      <header className="sb-gt-room-head">
        <button type="button" className="sb-icon-round" title="Back to groups" aria-label="Back to groups" onClick={onBack}>
          <ArrowLeft size={16} />
        </button>
        <h2 className="sb-gt-room-name" title={group.name}>{group.name}</h2>
        <span className="sb-gt-head-pills">
          <span className={`sb-gt-vis ${group.is_public ? "pub" : "priv"}`}>
            {group.is_public ? <Globe2 size={13} /> : <Lock size={13} />} {group.is_public ? "Public" : "Private"}
          </span>
          {group.focus_lock && <span className="sb-gt-vis sb-gt-lock-pill" title="Cheers and nudges are paused"><Lock size={12} /> Focus lock</span>}
        </span>
        <span className="sb-gt-head-actions">
          <button type="button" className="sb-icon-round" title="Members" aria-label="Members" onClick={() => setRosterOpen(true)}>
            <Users size={16} />
          </button>
          <button
            type="button"
            className={`sb-icon-round sb-gt-info-btn ${infoOpen ? "on" : ""}`}
            title={group.is_public ? "Group info" : "Group info & join code"}
            aria-label="Group info"
            onClick={() => setInfoOpen(true)}
          >
            <Info size={16} />
          </button>
        </span>
      </header>

      <div className="sb-gt-room-grid">
        <TimerPane t={t} g={g} settings={settings} addSession={addSession} onOpenSettings={() => setSettingsOpen(true)} />
        <MembersPane
          others={g.members}
          self={self}
          userId={userId}
          myMascot={mascot}
          myName={myName}
          connected={g.connected}
          group={group}
          clockOffset={g.clockOffset}
          room={g}
        />
      </div>

      <div className="sb-gt-below">
        <GroupStatsCard groupId={group.id} goalHours={group.goal_hours} isHost={isHost} userId={userId} refreshToken={statsToken} />
        <GroupRecapCard groupId={group.id} userId={userId} refreshToken={statsToken} />
      </div>

      {settingsOpen && (
        <GroupSettingsDialog settings={settings} onChange={onSettingsChange} onClose={() => setSettingsOpen(false)} />
      )}
      {infoOpen && (
        <GroupInfoDialog
          group={group}
          memberCount={memberCount}
          canDelete={canDelete}
          isHost={isHost}
          onManage={() => { setInfoOpen(false); setManageOpen(true); }}
          onLeave={onLeaveGroup}
          onDelete={onDeleteGroup}
          onClose={() => setInfoOpen(false)}
        />
      )}
      {rosterOpen && (
        <GroupRosterDialog
          group={group}
          roster={g.roster}
          presence={presence}
          userId={userId}
          isHost={isHost}
          onRemoved={g.announceKick}
          onClose={() => setRosterOpen(false)}
        />
      )}
      {manageOpen && (
        <GroupManageDialog group={group} onChanged={g.announceRoomChange} onClose={() => setManageOpen(false)} />
      )}
    </div>
  );
}
