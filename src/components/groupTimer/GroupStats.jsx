import React, { useCallback, useEffect, useRef, useState } from "react";
import { Trophy, HelpCircle, Flame, Target, CalendarCheck, Users, Clock, BookOpen } from "lucide-react";
import { SectionTitle } from "../ui";
import GtDialog from "./GtDialog";
import MemberAvatar from "./MemberAvatar";
import { useProfileMap } from "./useProfileMap";
import { fetchStats } from "../../lib/groupApi";
import { GT_RULES, GT_RULES_VERSION, fmtMinutes, weekDates } from "../../lib/groupTimer";

const RANGES = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "all", label: "All time" },
];

/**
 * Room numbers straight from the server's saved timer_sessions
 * (gt_group_stats) -- never from presence. Cached per range so switching tabs
 * is instant, refreshed on mount, when the tab comes back, every 90 s while
 * visible, and right after this person's own session ends/is discarded.
 */
export function useGroupStats(groupId, range, refreshToken, { poll = true } = {}) {
  const cache = useRef(new Map());
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const reqRef = useRef(0);

  const load = useCallback(async () => {
    if (!groupId) return;
    const my = ++reqRef.current;
    const res = await fetchStats(groupId, range);
    if (my !== reqRef.current) return; // a newer request superseded this one
    if (res.error) { setState((s) => ({ ...s, error: res.error, loading: false })); return; }
    cache.current.set(`${groupId}:${range}`, res.data);
    setState({ data: res.data, error: null, loading: false });
  }, [groupId, range]);

  useEffect(() => {
    const cached = cache.current.get(`${groupId}:${range}`);
    setState({ data: cached || null, error: null, loading: !cached });
    load();
    const timer = poll ? setInterval(() => { if (!document.hidden) load(); }, 90_000) : null;
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { if (timer) clearInterval(timer); document.removeEventListener("visibilitychange", onVis); reqRef.current++; };
  }, [groupId, range, load, poll]);

  // The session row is written the instant a session finishes (and removed on
  // discard) -- give that insert a beat, then re-read.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    const id = setTimeout(load, 1500);
    return () => clearTimeout(id);
  }, [refreshToken, load]);

  return { ...state, reload: load };
}

export function GroupRulesDialog({ onClose }) {
  return (
    <GtDialog onClose={onClose} label="How room hours are counted" className="sb-gt-rules-dialog">
      <SectionTitle icon={HelpCircle}>How are hours counted?</SectionTitle>
      <p className="sb-muted sb-gt-info-text" style={{ marginBottom: 8 }}>
        One rule for everyone in every room (rules {GT_RULES_VERSION}). Hours are computed on the server from your saved Focus Timer sessions.
      </p>
      <ol className="sb-gt-rules">
        {GT_RULES.map((r) => (
          <li key={r.title}><b>{r.title}.</b> {r.body}</li>
        ))}
      </ol>
    </GtDialog>
  );
}

function Board({ rows, userId, profiles }) {
  const top = Math.max(1, ...rows.map((r) => Number(r.minutes) || 0));
  if (!rows.length) return <p className="sb-muted sb-gt-none">No members yet.</p>;
  return (
    <ol className="sb-gt-board">
      {rows.map((r) => {
        const me = r.user_id === userId;
        const p = profiles.get(r.user_id);
        const mins = Number(r.minutes) || 0;
        return (
          <li key={r.user_id} className={`sb-gt-board-row ${me ? "me" : ""} rank-${r.rank <= 3 ? r.rank : "n"}`}>
            <span className="sb-gt-rank" aria-label={`Rank ${r.rank}`}>{r.rank}</span>
            <span className="sb-gt-board-avatar"><MemberAvatar species={p?.mascot} studying={false} size={34} /></span>
            <span className="sb-gt-board-main">
              <span className="sb-gt-board-name">{me ? "You" : (p?.name || "Study Buddy")}</span>
              <span className="sb-gt-board-bar" aria-hidden="true"><span style={{ width: `${(mins / top) * 100}%` }} /></span>
            </span>
            <span className="sb-gt-board-val">
              <b>{fmtMinutes(mins)}</b>
              <small>{Number(r.sessions)} {Number(r.sessions) === 1 ? "session" : "sessions"}</small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function GroupStatsCard({ groupId, goalHours, isHost, userId, refreshToken }) {
  const [range, setRange] = useState("week");
  const [rulesOpen, setRulesOpen] = useState(false);
  const { data, error, loading } = useGroupStats(groupId, range, refreshToken);
  const profiles = useProfileMap((data?.board || []).map((r) => r.user_id));

  const total = Number(data?.total_minutes) || 0;
  const goal = data?.goal_hours ?? goalHours ?? null;
  const goalMin = goal ? goal * 60 : 0;
  const pct = goalMin ? Math.min(100, (total / goalMin) * 100) : 0;

  return (
    <section className="sb-card sb-gt-stats" aria-label="Room stats">
      <SectionTitle
        icon={Trophy}
        right={<button type="button" className="sb-gt-link-btn" onClick={() => setRulesOpen(true)}><HelpCircle size={14} /> How is this counted?</button>}
      >
        Room stats
      </SectionTitle>

      <div className="sb-gt-seg sb-gt-seg-sm" role="tablist" aria-label="Period">
        {RANGES.map((r) => (
          <button key={r.id} type="button" role="tab" aria-selected={range === r.id} className={range === r.id ? "on" : ""} onClick={() => setRange(r.id)}>{r.label}</button>
        ))}
      </div>

      {error && <p className="sb-gt-error" role="alert">{error}</p>}
      {!data && loading && <div className="sb-gt-skel" aria-busy="true" />}

      {data && (
        <>
          <div className="sb-gt-tiles">
            <div className="sb-gt-tile"><Clock size={15} /><b>{fmtMinutes(total)}</b><span>studied together</span></div>
            <div className="sb-gt-tile"><BookOpen size={15} /><b>{Number(data.total_sessions)}</b><span>{Number(data.total_sessions) === 1 ? "session" : "sessions"}</span></div>
            <div className="sb-gt-tile"><Users size={15} /><b>{data.active_members}/{data.members_count}</b><span>active</span></div>
            <div className="sb-gt-tile streak"><Flame size={15} /><b>{data.streak_days}</b><span>day room streak</span></div>
          </div>

          {range === "week" && (goal ? (
            <div className="sb-gt-goal">
              <div className="sb-gt-goal-head">
                <span><Target size={14} /> Weekly goal · {goal}h</span>
                <b>{total >= goalMin ? "🎉 Reached!" : `${Math.floor(pct)}%`}</b>
              </div>
              <div className="sb-gt-goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(pct)} aria-label="Weekly room goal">
                <span style={{ width: `${pct}%` }} />
              </div>
              <small className="sb-muted">{fmtMinutes(total)} of {goal}h{total < goalMin ? ` · ${fmtMinutes(goalMin - total)} to go` : ""}</small>
            </div>
          ) : isHost ? (
            <p className="sb-muted sb-gt-none">No weekly goal yet — set one in Manage room.</p>
          ) : null)}

          <Board rows={data.board || []} userId={userId} profiles={profiles} />
          <p className="sb-muted sb-gt-foot">Ranked on exact minutes; shown rounded. Members who left still count toward the room total.</p>
        </>
      )}

      {rulesOpen && <GroupRulesDialog onClose={() => setRulesOpen(false)} />}
    </section>
  );
}

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const fmtDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export function GroupRecapCard({ groupId, userId, refreshToken }) {
  const { data, error, loading } = useGroupStats(groupId, "last_week", refreshToken, { poll: false });
  const profiles = useProfileMap((data?.board || []).slice(0, 3).map((r) => r.user_id));

  const days = data ? weekDates(String(data.from).slice(0, 10)) : [];
  const byDay = new Map((data?.daily || []).map((d) => [String(d.date).slice(0, 10), Number(d.minutes)]));
  const max = Math.max(1, ...days.map((d) => byDay.get(d) || 0));
  const total = Number(data?.total_minutes) || 0;
  const goal = data?.goal_hours;
  const goalPct = goal ? Math.round((total / (goal * 60)) * 100) : null;
  const top3 = (data?.board || []).filter((r) => Number(r.minutes) > 0).slice(0, 3);

  return (
    <section className="sb-card sb-gt-recap" aria-label="Last week's recap">
      <SectionTitle icon={CalendarCheck}>Last week's recap</SectionTitle>
      {error && <p className="sb-gt-error" role="alert">{error}</p>}
      {!data && loading && <div className="sb-gt-skel" aria-busy="true" />}
      {data && (
        <>
          <p className="sb-gt-recap-range">{fmtDate(String(data.from).slice(0, 10))} – {fmtDate(String(data.to).slice(0, 10))}</p>
          {total === 0 ? (
            <p className="sb-muted sb-gt-none">Nothing was logged last week — this week's a fresh start.</p>
          ) : (
            <>
              <div className="sb-gt-recap-total">
                <b>{fmtMinutes(total)}</b>
                <span>{Number(data.total_sessions)} sessions · {data.active_members} active</span>
              </div>
              {goal ? (
                <p className={`sb-gt-recap-goal ${goalPct >= 100 ? "hit" : "miss"}`}>
                  {goalPct >= 100 ? `✅ Goal hit — ${goalPct}% of ${goal}h` : `Goal missed — ${goalPct}% of ${goal}h`}
                </p>
              ) : null}
              <div className="sb-gt-recap-bars" role="img" aria-label="Minutes studied per day last week">
                {days.map((d, i) => {
                  const m = byDay.get(d) || 0;
                  return (
                    <span key={d} className="sb-gt-recap-bar" title={`${fmtDate(d)} · ${fmtMinutes(m)}`}>
                      <span className="fill" style={{ height: `${Math.max(m > 0 ? 8 : 0, (m / max) * 100)}%` }} />
                      <em>{DAY_LETTERS[i]}</em>
                    </span>
                  );
                })}
              </div>
              {top3.length > 0 && (
                <ol className="sb-gt-recap-top">
                  {top3.map((r) => {
                    const p = profiles.get(r.user_id);
                    return (
                      <li key={r.user_id}>
                        <span className="sb-gt-rank">{r.rank}</span>
                        <span className="sb-gt-recap-name">{r.user_id === userId ? "You" : (p?.name || "Study Buddy")}</span>
                        <b>{fmtMinutes(r.minutes)}</b>
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="sb-muted sb-gt-foot"><Flame size={12} /> Room streak now: {data.streak_days} {data.streak_days === 1 ? "day" : "days"}</p>
            </>
          )}
        </>
      )}
    </section>
  );
}
