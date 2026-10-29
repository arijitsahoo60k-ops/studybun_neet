import React, { useEffect, useMemo, useState } from "react";
import { Users, Settings, KeyRound, RefreshCw, ShieldCheck, UserX, Ban, Undo2, Lock } from "lucide-react";
import { Btn, SectionTitle } from "../ui";
import GtDialog from "./GtDialog";
import MemberAvatar from "./MemberAvatar";
import { useProfileMap } from "./useProfileMap";
import FocusLockToggle from "../community/FocusLockToggle";
import { fetchBans, kickMember, unbanMember, updateGroup, setFocusLock, regenerateCode } from "../../lib/groupApi";
import { prettyCode, timeAgo } from "../../lib/groupTimer";

/* ------------------------------------------------------------------ */
/* Full roster: online AND offline members, "last studied", host tools   */
/* ------------------------------------------------------------------ */
export function GroupRosterDialog({ group, roster, presence, userId, isHost, onRemoved, onClose }) {
  const [bans, setBans] = useState(null);
  const [pending, setPending] = useState(null); // { id, ban }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);

  const loadBans = async () => {
    if (!isHost) return;
    const res = await fetchBans(group.id);
    if (!res.error) setBans(res.data || []);
  };
  useEffect(() => { loadBans(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [group.id, isHost]);

  const rows = useMemo(() => {
    const list = (roster || []).map((r) => {
      const me = r.user_id === userId;
      const live = me ? presence.self : presence.others.get(r.user_id);
      return { ...r, me, live, online: me || !!live };
    });
    const rank = (x) => (x.live?.phase === "studying" ? 0 : x.online ? 1 : 2);
    return list.sort((a, b) => rank(a) - rank(b)
      || (new Date(b.last_studied_at || 0) - new Date(a.last_studied_at || 0)));
  }, [roster, presence, userId]);

  const profiles = useProfileMap([...(roster || []).map((r) => r.user_id), ...(bans || []).map((b) => b.user_id)]);

  const doKick = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    const res = await kickMember(group.id, pending.id, pending.ban);
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    onRemoved(pending.id);
    setPending(null);
    loadBans();
  };
  const doUnban = async (id) => {
    setBusy(true);
    setError(null);
    const res = await unbanMember(group.id, id);
    setBusy(false);
    if (res.error) setError(res.error);
    else loadBans();
  };

  return (
    <GtDialog onClose={onClose} label="Members" className="sb-gt-roster-dialog">
      <SectionTitle icon={Users}>Members{roster ? ` · ${roster.length}` : ""}</SectionTitle>
      {!roster ? (
        <p className="sb-muted sb-gt-none">Loading members…</p>
      ) : (
        <ul className="sb-gt-roster">
          {rows.map((r) => {
            const p = profiles.get(r.user_id);
            const phase = r.live?.phase;
            const status = phase === "studying" ? "Studying now"
              : r.online ? (phase === "paused" ? "Paused" : "In the room")
              : (r.last_studied_at ? `Offline · studied ${timeAgo(r.last_studied_at, now)}` : "Offline · hasn't studied yet");
            const askingThis = pending?.id === r.user_id;
            return (
              <li key={r.user_id} className={`sb-gt-roster-row ${r.online ? "online" : "offline"}`}>
                <span className="sb-gt-roster-avatar"><MemberAvatar species={p?.mascot} studying={phase === "studying"} size={36} /></span>
                <span className="sb-gt-roster-main">
                  <span className="sb-gt-roster-name">
                    {r.me ? "You" : (p?.name || "Study Buddy")}
                    {r.is_host && <span className="sb-gt-host-badge" title="Host"><ShieldCheck size={11} /> Host</span>}
                  </span>
                  <span className={`sb-gt-roster-status ${phase === "studying" ? "live" : ""}`}>
                    <span className={`sb-gt-dot ${r.online ? "on" : ""}`} aria-hidden="true" /> {status}
                  </span>
                </span>
                {isHost && !r.me && !r.is_host && (
                  askingThis ? (
                    <span className="sb-gt-roster-confirm">
                      <span>{pending.ban ? "Ban?" : "Remove?"}</span>
                      <Btn variant="ghost" onClick={() => setPending(null)} disabled={busy}>No</Btn>
                      <Btn variant="soft" onClick={doKick} disabled={busy}>Yes</Btn>
                    </span>
                  ) : (
                    <span className="sb-gt-roster-actions">
                      <button type="button" className="sb-icon-round" title="Remove from group" aria-label={`Remove ${p?.name || "member"}`} onClick={() => setPending({ id: r.user_id, ban: false })}><UserX size={14} /></button>
                      <button type="button" className="sb-icon-round" title="Remove and ban" aria-label={`Ban ${p?.name || "member"}`} onClick={() => setPending({ id: r.user_id, ban: true })}><Ban size={14} /></button>
                    </span>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}

      {isHost && bans && bans.length > 0 && (
        <>
          <h3 className="sb-gt-subhead">Banned</h3>
          <ul className="sb-gt-roster">
            {bans.map((b) => {
              const p = profiles.get(b.user_id);
              return (
                <li key={b.user_id} className="sb-gt-roster-row offline">
                  <span className="sb-gt-roster-avatar"><MemberAvatar species={p?.mascot} studying={false} size={36} /></span>
                  <span className="sb-gt-roster-main"><span className="sb-gt-roster-name">{p?.name || "Study Buddy"}</span></span>
                  <Btn variant="ghost" onClick={() => doUnban(b.user_id)} disabled={busy}><Undo2 size={13} /> Unban</Btn>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {error && <p className="sb-gt-error" role="alert">{error}</p>}
      <p className="sb-muted sb-gt-foot">"Offline" members aren't in the room right now. Last-studied is shown to everyone in the group.</p>
    </GtDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Manage room (host): rename, description, rules, goal, code, lock      */
/* ------------------------------------------------------------------ */
export function GroupManageDialog({ group, onChanged, onClose }) {
  const [name, setName] = useState(group.name || "");
  const [description, setDescription] = useState(group.description || "");
  const [rules, setRules] = useState(group.rules || "");
  const [goal, setGoal] = useState(group.goal_hours ? String(group.goal_hours) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [confirmCode, setConfirmCode] = useState(false);

  const goalNum = goal.trim() === "" ? null : Number(goal);
  const goalOk = goalNum === null || (Number.isInteger(goalNum) && goalNum >= 1 && goalNum <= 10000);
  const nameOk = name.replace(/\s+/g, " ").trim().length >= 2;

  const save = async (e) => {
    e?.preventDefault?.();
    if (!goalOk || !nameOk || busy) return;
    setBusy(true); setError(null); setSaved(false);
    const res = await updateGroup(group.id, { name, description, rules, goalHours: goalNum });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setSaved(true);
    onChanged();
  };

  const newCode = async () => {
    setBusy(true); setError(null);
    const res = await regenerateCode(group.id);
    setBusy(false);
    setConfirmCode(false);
    if (res.error) setError(res.error);
    else onChanged();
  };

  const toggleLock = async (next) => {
    const res = await setFocusLock(group.id, next);
    if (res.error) return { ok: false, error: res.error };
    onChanged();
    return { ok: true };
  };

  return (
    <GtDialog onClose={onClose} label="Manage room" className="sb-gt-manage-dialog">
      <SectionTitle icon={Settings}>Manage room</SectionTitle>
      <form onSubmit={save} className="sb-gt-form">
        <label htmlFor="sb-gt-m-name">Name</label>
        <input id="sb-gt-m-name" className="sb-input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="sb-gt-m-desc">Description <small>({description.length}/200)</small></label>
        <textarea id="sb-gt-m-desc" className="sb-input sb-gt-textarea" rows={2} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="What is this room about?" />
        <label htmlFor="sb-gt-m-rules">Room rules <small>({rules.length}/600)</small></label>
        <textarea id="sb-gt-m-rules" className="sb-input sb-gt-textarea" rows={3} value={rules} maxLength={600} onChange={(e) => setRules(e.target.value)} placeholder="e.g. Phones away. Be kind. No chatting while the timer runs." />
        <label htmlFor="sb-gt-m-goal">Weekly goal (hours, optional)</label>
        <input id="sb-gt-m-goal" className="sb-input" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))} placeholder="e.g. 100" />
        {!goalOk && <p className="sb-gt-error" role="alert">Goal must be a whole number from 1 to 10000.</p>}
        <div className="sb-gt-info-actions">
          {saved && <span className="sb-gt-saved">Saved ✓</span>}
          <Btn type="submit" disabled={!goalOk || !nameOk || busy}>{busy ? "Saving…" : "Save changes"}</Btn>
        </div>
      </form>

      <div className="sb-gt-manage-block">
        <span className="sb-gt-set-label"><Lock size={15} /> Room focus lock</span>
        <div className="sb-gt-manage-row">
          <p className="sb-muted sb-gt-info-text" style={{ margin: 0 }}>
            While on, cheers and nudges are paused for everyone so the room stays quiet. Timers, goals and stats keep working.
          </p>
          <FocusLockToggle
            locked={!!group.focus_lock}
            onToggle={toggleLock}
            copy={{
              ariaOn: "Turn off the room focus lock",
              ariaOff: "Turn on the room focus lock — pause cheers and nudges for everyone",
              titleOn: "Focus lock is on for this room — tap to turn off",
              titleOff: "Pause cheers and nudges for everyone in this room",
              labelOn: "Focus",
              labelOff: "Open",
            }}
          />
        </div>
      </div>

      {!group.is_public && (
        <div className="sb-gt-manage-block">
          <span className="sb-gt-set-label"><KeyRound size={15} /> Join code</span>
          <div className="sb-gt-manage-row">
            <span className="sb-gt-code sb-gt-code-sm">{prettyCode(group.join_code)}</span>
            {confirmCode ? (
              <span className="sb-gt-roster-confirm">
                <span>Old code stops working</span>
                <Btn variant="ghost" onClick={() => setConfirmCode(false)} disabled={busy}>Cancel</Btn>
                <Btn variant="soft" onClick={newCode} disabled={busy}>Make new code</Btn>
              </span>
            ) : (
              <Btn variant="ghost" onClick={() => setConfirmCode(true)}><RefreshCw size={14} /> New code</Btn>
            )}
          </div>
          <p className="sb-muted sb-gt-info-text" style={{ margin: 0 }}>Use this if the code leaked. People already in the room stay in.</p>
        </div>
      )}
      {error && <p className="sb-gt-error" role="alert">{error}</p>}
    </GtDialog>
  );
}
