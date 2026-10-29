import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { SYLLABUS } from "../data/syllabus";
import { fetchGroup, fetchRoster, isMissingFunction } from "../lib/groupApi";
import { fetchProfilesByIds } from "../lib/communityProfiles";
import {
  pickMeta, measureClockOffset, sanitizeGoal,
  GT_CHEERS, NUDGE_AFTER_MS, NUDGE_COOLDOWN_MS, CHEER_COOLDOWN_MS,
} from "../lib/groupTimer";

const ROOM_KEY = "sb.groupTimer.room.v1";
const PREFS_KEY = "sb.groupTimer.prefs.v1";
const SUBJECTS = Object.keys(SYLLABUS);
// A tab hidden for less than this keeps its connection on return. Beyond it we
// assume the websocket may have silently died (screen lock / PWA suspension).
const STALE_AFTER_MS = 30_000;
const FEED_MAX = 40;
const NUDGE_ACCEPT_GAP_MS = 5 * 60 * 1000; // I take at most one nudge per 5 min, from anyone
const ROSTER_MIN_GAP_MS = 3000;
// The server can't tell a removed member from a deleted private group (RLS hides the row
// from both), so every "you're out" path says the same honest thing.
const GONE_MESSAGE = "You're no longer in that group (it was deleted, or you were removed).";

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeJSON(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable -- room still works for this session */
  }
}

function loadPrefs() {
  const p = readJSON(PREFS_KEY);
  return {
    subject: SUBJECTS.includes(p?.subject) ? p.subject : SUBJECTS[0],
    topic: typeof p?.topic === "string" ? p.topic.slice(0, 60) : "",
    goal: sanitizeGoal(p?.goal),
  };
}

/**
 * Group Timer's root-level state. Mounted once in App.jsx -- the same reason
 * useFocusTimer / useStudyPresence live there: a person keeps studying while
 * they click around the app, and the room has to keep showing them as
 * studying (and keep showing them everyone else) no matter which page is open.
 *
 * It does NOT own a timer. The "group timer" is the one normal Focus Timer
 * (passed in as `timer`), so it's individual by construction and every
 * finished session is logged to timer_sessions by the existing code path --
 * i.e. it counts in study hours, streak and leaderboard with no extra work.
 *
 * Realtime only, never the database, for anything LIVE:
 *   - presence: who is studying right now (tracked only when something
 *     changes; receivers tick the display from a server-aligned anchor)
 *   - broadcast on the SAME channel: cheers, nudges, goal results, and
 *     "room changed / you were removed" pings. No extra channel, no extra
 *     connection, no database writes.
 * Everything COMPETITIVE (hours, leaderboard) comes from the server's
 * timer_sessions via gt_group_stats -- presence/broadcast are client-supplied
 * and are never trusted for a number.
 *
 * Trust model for the live bits: a channel is just a name, so anyone who knew
 * a room id could join it. Two guards make that harmless: (1) everything
 * shown is filtered to the server's member roster, and (2) a broadcast is only
 * acted on if its sender is a current member who is present in the room.
 * Cosmetic spoofing between members is possible and accepted; hours aren't
 * affected.
 */
export function useGroupTimerRoom({ timer, userId, notify }) {
  const [activeGroup, setActiveGroup] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState(null);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [topicSent, setTopicSent] = useState(() => loadPrefs().topic);
  const [goalSent, setGoalSent] = useState(() => loadPrefs().goal);
  const [members, setMembers] = useState([]);
  const [roster, setRoster] = useState(null); // null = not loaded / server has no roster fn yet
  const [feed, setFeed] = useState([]);
  const [connected, setConnected] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const offsetRef = useRef(0);
  const tabIdRef = useRef(Math.random().toString(36).slice(2, 10));

  const groupId = activeGroup?.id || null;
  const groupRef = useRef(null);
  groupRef.current = activeGroup;
  const rosterRef = useRef(null);
  rosterRef.current = roster;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  // ---- what my own timer is doing, as the room should see it ----
  const phase = timer.running
    ? "studying"
    : timer.askDone
      ? "done"
      : timer.sessionActive
        ? "paused"
        : "idle";

  const latestRef = useRef({});
  latestRef.current = {
    phase,
    subject: prefs.subject,
    topic: topicSent,
    goal: goalSent,
    mode: timer.mode,
    elapsed: phase === "idle" ? 0 : Math.max(0, Math.round(timer.elapsedSeconds || 0)),
    total: timer.total || null,
  };

  // ---- connection plumbing (refs, so effects never go stale) ----
  const channelRef = useRef(null);
  const subscribedRef = useRef(false);
  const leavingRef = useRef(Promise.resolve());
  const seqRef = useRef(0);
  const phaseSinceRef = useRef(0);
  const lastPhaseRef = useRef(null);

  const trackNow = useCallback(() => {
    const ch = channelRef.current;
    if (!ch || !subscribedRef.current) return;
    const cur = latestRef.current;
    const nowMs = Date.now();
    ch.track({
      ...cur,
      tab: tabIdRef.current,
      // server-clock moment this focus began (elapsed already excludes pauses)
      anchor: cur.phase === "studying" ? Math.round(nowMs + offsetRef.current - cur.elapsed * 1000) : null,
      // server-clock moment the current phase began (paused-for / nudge eligibility)
      since: phaseSinceRef.current || Math.round(nowMs + offsetRef.current),
      sentAt: nowMs,
    }).catch(() => {});
  }, []);

  // Persist prefs (per device); debounce topic/goal so typing doesn't spam presence.
  useEffect(() => { writeJSON(PREFS_KEY, prefs); }, [prefs]);
  useEffect(() => {
    const id = setTimeout(() => setTopicSent(prefs.topic), 700);
    return () => clearTimeout(id);
  }, [prefs.topic]);
  useEffect(() => {
    const id = setTimeout(() => setGoalSent(sanitizeGoal(prefs.goal)), 700);
    return () => clearTimeout(id);
  }, [prefs.goal]);

  const setSubject = useCallback((subject) => {
    if (!SUBJECTS.includes(subject)) return;
    setPrefs((p) => ({ ...p, subject }));
  }, []);
  const setTopic = useCallback((topic) => {
    setPrefs((p) => ({ ...p, topic: String(topic || "").slice(0, 60) }));
  }, []);
  const setGoal = useCallback((goal) => {
    setPrefs((p) => ({ ...p, goal: String(goal || "").slice(0, 60) }));
  }, []);

  // A goal belongs to ONE session: once it has ended and the card is closed
  // (saved or discarded anywhere), it's cleared so it can't leak into the next.
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    if (prevPhaseRef.current === "done" && phase === "idle") setPrefs((p) => (p.goal ? { ...p, goal: "" } : p));
    prevPhaseRef.current = phase;
  }, [phase]);

  // ---- feed (ephemeral: lives in memory for this visit, never saved) ----
  const feedSeq = useRef(0);
  const pushFeed = useCallback((entry) => {
    setFeed((f) => [{ id: ++feedSeq.current, at: Date.now(), ...entry }, ...f].slice(0, FEED_MAX));
  }, []);

  // ---- roster: the server's list of CURRENT members ----
  const rosterAtRef = useRef(0);
  const clearRoom = useCallback((message) => {
    writeJSON(ROOM_KEY, null);
    setActiveGroup(null);
    setMembers([]);
    setRoster(null);
    setFeed([]);
    if (message) setNotice(message);
  }, []);

  const refreshRoster = useCallback(async (force = false) => {
    const gid = groupRef.current?.id;
    if (!gid || !userId) return;
    const now = Date.now();
    if (!force && now - rosterAtRef.current < ROSTER_MIN_GAP_MS) return;
    rosterAtRef.current = now;
    const { data, error } = await fetchRoster(gid);
    if (groupRef.current?.id !== gid) return;
    if (error) {
      // Not a member any more (removed / group deleted): leave the room.
      if (/not a member/i.test(String(error.message || ""))) clearRoom(GONE_MESSAGE);
      else if (isMissingFunction(error)) setRoster(null); // v2 SQL not deployed yet: show everyone, as before
      return;
    }
    setRoster(Array.isArray(data) ? data : []);
  }, [userId, clearRoom]);

  const refreshGroup = useCallback(async () => {
    const gid = groupRef.current?.id;
    if (!gid) return;
    const g = await fetchGroup(gid);
    if (groupRef.current?.id !== gid) return;
    if (g === null) { clearRoom(GONE_MESSAGE); return; }
    if (g) setActiveGroup((prev) => (prev && prev.id === g.id ? { ...prev, ...g } : prev));
  }, [clearRoom]);

  // ---- which room am I in ----
  // Restored on load / account switch so a reload mid-session drops you back
  // into the room. Keyed by user id so switching accounts never carries
  // someone else's room over.
  useEffect(() => {
    setActiveGroup(null);
    setMembers([]);
    setRoster(null);
    setFeed([]);
    setNotice(null);
    if (!userId) { setRestoring(false); return undefined; }
    const stored = readJSON(ROOM_KEY);
    if (!stored || stored.userId !== userId || !stored.groupId) { setRestoring(false); return undefined; }
    let cancelled = false;
    setRestoring(true);
    fetchGroup(stored.groupId).then((g) => {
      if (cancelled) return;
      if (g) setActiveGroup(g);
      else if (g === null) writeJSON(ROOM_KEY, null); // deleted / no longer allowed
      setRestoring(false);
    });
    return () => { cancelled = true; };
  }, [userId]);

  const enterRoom = useCallback((group) => {
    if (!group?.id || !userId) return;
    setNotice(null);
    setFeed([]);
    setRoster(null);
    setActiveGroup(group);
    writeJSON(ROOM_KEY, { userId, groupId: group.id });
    // The row handed over by the lobby can be partial (my-groups list); pull the full one.
    fetchGroup(group.id).then((g) => {
      if (g && groupRef.current?.id === g.id) setActiveGroup((prev) => (prev ? { ...prev, ...g } : prev));
    });
  }, [userId]);

  const leaveRoom = useCallback(() => {
    setActiveGroup(null);
    setMembers([]);
    setRoster(null);
    setFeed([]);
    writeJSON(ROOM_KEY, null);
  }, []);

  // ---- live events (broadcast on the room channel) ----
  const inboundRef = useRef(new Map()); // from -> recent timestamps (flood guard)
  const lastNudgeInRef = useRef(0);
  const lastCheerOutRef = useRef(0);
  const nudgedAtRef = useRef(new Map()); // target -> ts of my last nudge

  const sendEvent = useCallback((payload) => {
    const ch = channelRef.current;
    if (!ch || !subscribedRef.current) return false;
    Promise.resolve(ch.send({ type: "broadcast", event: "gt", payload: { ...payload, from: userId, sentAt: Date.now() } })).catch(() => {});
    return true;
  }, [userId]);

  const nameOf = useCallback(async (id) => {
    try {
      const m = await fetchProfilesByIds([id]);
      return m.get(id)?.name || "Someone";
    } catch {
      return "Someone";
    }
  }, []);

  const handleEvent = useCallback((p) => {
    if (!p || typeof p !== "object" || !userId) return;
    const from = typeof p.from === "string" ? p.from : "";
    if (!from || from === userId) return;

    // flood guard: at most 8 events / 5 s from any one sender
    const now = Date.now();
    const recent = (inboundRef.current.get(from) || []).filter((t) => now - t < 5000);
    if (recent.length >= 8) return;
    recent.push(now);
    inboundRef.current.set(from, recent);

    const known = rosterRef.current;
    if (known && !known.some((r) => r.user_id === from)) { refreshRoster(); return; } // unknown sender: ignore, re-check roster
    const ch = channelRef.current;
    if (!ch || !ch.presenceState()[from]) return; // only people actually in the room

    const locked = !!groupRef.current?.focus_lock;
    const to = typeof p.to === "string" ? p.to : null;

    if (p.type === "cheer") {
      if (locked || !GT_CHEERS.includes(p.emoji)) return;
      pushFeed({ type: "cheer", from, to, emoji: p.emoji });
      if (to === userId) nameOf(from).then((n) => notifyRef.current?.(`${n} sent you ${p.emoji}`));
    } else if (p.type === "nudge") {
      if (locked || to !== userId) return;
      if (latestRef.current.phase !== "paused") return;          // only matters if I'm actually paused
      if (now - lastNudgeInRef.current < NUDGE_ACCEPT_GAP_MS) return;
      lastNudgeInRef.current = now;
      pushFeed({ type: "nudge", from, to });
      nameOf(from).then((n) => notifyRef.current?.(`${n} nudged you — time to get back to it 🔔`));
    } else if (p.type === "goal") {
      const goal = sanitizeGoal(p.goal);
      if (!goal) return;
      const minutes = Number(p.minutes);
      pushFeed({ type: "goal", from, goal, done: p.done === true, minutes: Number.isFinite(minutes) ? Math.min(600, Math.max(0, Math.round(minutes))) : null });
    } else if (p.type === "room") {
      refreshGroup();
      refreshRoster(true);
    } else if (p.type === "kick") {
      // Never trust the ping itself: ask the server whether I'm still a member.
      if (to === userId) refreshRoster(true);
    }
  }, [userId, pushFeed, nameOf, refreshGroup, refreshRoster]);
  const handleEventRef = useRef(handleEvent);
  handleEventRef.current = handleEvent;

  const cheer = useCallback((to, emoji) => {
    if (groupRef.current?.focus_lock) return { ok: false, reason: "locked" };
    if (!GT_CHEERS.includes(emoji)) return { ok: false, reason: "invalid" };
    const now = Date.now();
    if (now - lastCheerOutRef.current < CHEER_COOLDOWN_MS) return { ok: false, reason: "slow" };
    if (!sendEvent({ type: "cheer", to: to || null, emoji })) return { ok: false, reason: "offline" };
    lastCheerOutRef.current = now;
    pushFeed({ type: "cheer", from: userId, to: to || null, emoji });
    return { ok: true };
  }, [sendEvent, pushFeed, userId]);

  // Nudging is for someone who has been paused a long while (server-aligned
  // `since`), at most once per person per 10 minutes.
  const canNudge = useCallback((member, nowMs = Date.now()) => {
    if (!member || member.phase !== "paused" || !member.since) return false;
    if (groupRef.current?.focus_lock) return false;
    if (nowMs + offsetRef.current - member.since < NUDGE_AFTER_MS) return false;
    const last = nudgedAtRef.current.get(member.userId) || 0;
    return nowMs - last >= NUDGE_COOLDOWN_MS;
  }, []);
  const nudge = useCallback((member) => {
    if (!canNudge(member)) return { ok: false };
    if (!sendEvent({ type: "nudge", to: member.userId })) return { ok: false, reason: "offline" };
    nudgedAtRef.current.set(member.userId, Date.now());
    pushFeed({ type: "nudge", from: userId, to: member.userId });
    return { ok: true };
  }, [canNudge, sendEvent, pushFeed, userId]);

  // End-of-session accountability: done / not done, shown to the room.
  const reportGoal = useCallback((done) => {
    const goal = sanitizeGoal(prefs.goal);
    if (!goal) return;
    const minutes = Math.round((latestRef.current.elapsed || 0) / 60);
    sendEvent({ type: "goal", goal, done: !!done, minutes });
    pushFeed({ type: "goal", from: userId, goal, done: !!done, minutes });
    setPrefs((p) => ({ ...p, goal: "" }));
    setGoalSent("");
  }, [sendEvent, pushFeed, userId, prefs.goal]);

  // Host actions call these after a successful RPC so everyone refreshes now.
  const announceRoomChange = useCallback(() => {
    sendEvent({ type: "room" });
    refreshGroup();
    refreshRoster(true);
  }, [sendEvent, refreshGroup, refreshRoster]);
  const announceKick = useCallback((targetId) => {
    sendEvent({ type: "kick", to: targetId });
    sendEvent({ type: "room" });
    refreshRoster(true);
  }, [sendEvent, refreshRoster]);

  // ---- presence + broadcast for the active room ----
  useEffect(() => {
    if (!userId || !groupId) {
      setMembers([]);
      setConnected(false);
      return undefined;
    }

    let cancelled = false;
    const topic = `gt-room:${groupId}`;
    // userId -> { sentAt, phase, receivedAt }. Lives for this room visit so a
    // reconnect doesn't make everyone's clock jump.
    const seen = new Map();
    let hiddenAt = document.hidden ? Date.now() : null;

    const connect = async () => {
      const mySeq = ++seqRef.current;
      // The previous channel's teardown is asynchronous, and supabase-js hands
      // back the SAME channel object for a repeated topic until that finishes
      // -- attaching handlers to a half-closed channel throws. So always wait
      // for the last teardown, and let only the newest connect() through.
      try { await leavingRef.current; } catch { /* already handled */ }
      if (cancelled || mySeq !== seqRef.current) return;

      const channel = supabase.channel(topic, { config: { presence: { key: userId }, broadcast: { self: false } } });
      channelRef.current = channel;
      subscribedRef.current = false;

      channel.on("presence", { event: "sync" }, () => {
        if (channelRef.current !== channel) return;
        const state = channel.presenceState();
        const now = Date.now();
        const next = [];
        Object.entries(state).forEach(([key, metas]) => {
          if (key === userId) return; // my own card is built from my real timer, not echoed back
          const meta = pickMeta(metas);
          if (!meta) return;
          const prev = seen.get(key);
          const receivedAt = prev && prev.sentAt === meta.sentAt && prev.phase === meta.phase ? prev.receivedAt : now;
          seen.set(key, { sentAt: meta.sentAt, phase: meta.phase, receivedAt });
          next.push({ userId: key, ...meta, receivedAt });
        });
        seen.forEach((_, key) => { if (!state[key]) seen.delete(key); });
        setMembers(next);
      });

      channel.on("broadcast", { event: "gt" }, (msg) => {
        if (channelRef.current !== channel) return;
        handleEventRef.current?.(msg?.payload);
      });

      channel.subscribe((status) => {
        if (channelRef.current !== channel) return;
        if (status === "SUBSCRIBED") {
          subscribedRef.current = true;
          setConnected(true);
          trackNow();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          subscribedRef.current = false;
          setConnected(false);
        }
      });
    };

    const disconnect = () => {
      const ch = channelRef.current;
      channelRef.current = null;
      subscribedRef.current = false;
      if (ch) leavingRef.current = Promise.resolve(supabase.removeChannel(ch)).catch(() => {});
    };

    connect();
    refreshRoster(true);
    // Align to server time once per room visit; re-announce with the
    // corrected anchor if the offset turned out to matter.
    measureClockOffset((fn) => supabase.rpc(fn)).then((off) => {
      if (cancelled) return;
      offsetRef.current = off;
      setClockOffset(off);
      trackNow();
    });

    const onVisibility = () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      const hiddenFor = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = null;
      const ch = channelRef.current;
      const healthy = ch && ch.state === "joined";
      if (healthy && hiddenFor < STALE_AFTER_MS) {
        // Short alt-tab: keep the live connection (rebuilding it would make
        // this person blink out of everyone else's list for a moment).
        trackNow();
        return;
      }
      disconnect();
      connect();
      // The group may have changed / been deleted / I may have been removed while asleep.
      refreshGroup();
      refreshRoster(true);
    };
    // The app is being closed / navigated away from: leave the room NOW so
    // everyone else sees this person disappear immediately instead of waiting
    // for the server to notice the dead socket (~30-60 s).
    const onPageHide = () => { disconnect(); setConnected(false); };
    // pageshow also fires on a normal first load; only a bfcache restore needs a rebuild.
    const onPageShow = (e) => { if (e.persisted) onVisibility(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onVisibility);
      disconnect();
      setConnected(false);
    };
  }, [userId, groupId, trackNow, refreshRoster, refreshGroup]);

  // Tell the room the moment anything about me changes.
  useEffect(() => {
    if (lastPhaseRef.current !== phase) {
      lastPhaseRef.current = phase;
      phaseSinceRef.current = Math.round(Date.now() + offsetRef.current);
    }
    trackNow();
  }, [phase, prefs.subject, topicSent, goalSent, timer.mode, trackNow]);

  // What the UI shows: only people the SERVER says are members. If someone
  // unknown turns up, re-check the roster (throttled) instead of showing them.
  const rosterIds = useMemo(() => (roster ? new Set(roster.map((r) => r.user_id)) : null), [roster]);
  const visibleMembers = useMemo(
    () => (rosterIds ? members.filter((m) => rosterIds.has(m.userId)) : members),
    [members, rosterIds]
  );
  // A brand-new member shows up in presence a moment before my roster knows
  // about them, so re-check -- a few times, spaced out, and then stop (someone
  // who never turns up on the server's list isn't a member, and must not make
  // us hammer the database).
  const unknownTriesRef = useRef(new Map());
  useEffect(() => {
    if (!rosterIds) return undefined;
    const unknown = members.filter((m) => !rosterIds.has(m.userId)).map((m) => m.userId);
    if (!unknown.length) { unknownTriesRef.current.clear(); return undefined; }
    const tries = Math.max(...unknown.map((id) => unknownTriesRef.current.get(id) || 0));
    if (tries >= 3) return undefined;
    const t = setTimeout(() => {
      unknown.forEach((id) => unknownTriesRef.current.set(id, (unknownTriesRef.current.get(id) || 0) + 1));
      refreshRoster(true);
    }, [300, 2000, 6000][tries]);
    return () => clearTimeout(t);
  }, [members, rosterIds, refreshRoster]);

  return {
    activeGroup, restoring, notice, clearNotice: () => setNotice(null),
    enterRoom, leaveRoom,
    subject: prefs.subject, topic: prefs.topic, goal: prefs.goal, setSubject, setTopic, setGoal,
    members: visibleMembers, roster, refreshRoster, refreshGroup,
    feed, cheer, nudge, canNudge, reportGoal, announceRoomChange, announceKick,
    connected, phase, clockOffset,
  };
}
