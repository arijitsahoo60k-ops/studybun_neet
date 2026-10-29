import React, { useState } from "react";
import { Settings, Info, Plus, KeyRound, Copy, Check, LogOut, Trash2, Globe2, Lock, Users, Image as ImageIcon, Palette } from "lucide-react";
import { Btn, SectionTitle } from "../ui";
import GtDialog from "./GtDialog";
import {
  GT_GIFS, GT_COLORS, isValidHex, plateFor, normalizeCode, prettyCode,
} from "../../lib/groupTimer";

/* ------------------------------------------------------------------ */
/* Room settings: change the GIF and the timer colour                  */
/* ------------------------------------------------------------------ */
export function GroupSettingsDialog({ settings, onChange, onClose }) {
  const plate = plateFor(settings.color);
  return (
    <GtDialog onClose={onClose} label="Group timer settings" className="sb-gt-settings-dialog">
      <SectionTitle icon={Settings}>Room Settings</SectionTitle>

      <div className="sb-gt-set-block">
        <span className="sb-gt-set-label"><ImageIcon size={15} /> Background</span>
        <div className="sb-gt-gif-grid" role="radiogroup" aria-label="Background animation">
          {GT_GIFS.map((g) => {
            const on = settings.gif === g.id;
            return (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`sb-gt-gif-opt ${on ? "on" : ""}`}
                onClick={() => onChange({ ...settings, gif: g.id })}
              >
                <img src={g.thumb} alt="" loading="lazy" draggable="false" />
                <span>{g.label}</span>
                {on && <span className="sb-gt-gif-check" aria-hidden="true"><Check size={12} /></span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sb-gt-set-block">
        <span className="sb-gt-set-label"><Palette size={15} /> Timer colour</span>
        <div className="sb-gt-swatches" role="radiogroup" aria-label="Timer colour">
          {GT_COLORS.map((c) => {
            const on = settings.color.toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={c.label}
                title={c.label}
                className={`sb-gt-swatch ${on ? "on" : ""}`}
                style={{ background: c.hex }}
                onClick={() => onChange({ ...settings, color: c.hex })}
              >
                {on && <Check size={14} color="#1b1620" strokeWidth={3} />}
              </button>
            );
          })}
          <label className="sb-gt-swatch sb-gt-swatch-custom" title="Pick any colour">
            <input
              type="color"
              value={isValidHex(settings.color) ? settings.color : "#ffffff"}
              onChange={(e) => onChange({ ...settings, color: e.target.value })}
              aria-label="Custom timer colour"
            />
            <Plus size={14} aria-hidden="true" />
          </label>
        </div>

        <div className="sb-gt-preview" style={{ backgroundImage: `url(${(GT_GIFS.find((g) => g.id === settings.gif) || GT_GIFS[0]).thumb})` }}>
          <span className="sb-gt-preview-plate" style={{ background: plate.background, borderColor: plate.edge, color: settings.color }}>
            25:00
          </span>
        </div>
      </div>

      <p className="sb-muted" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>
        Saved on this device. Only you see your own look — it doesn't change anyone else's room.
      </p>
    </GtDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Copy-to-clipboard button (works without the async clipboard API)    */
/* ------------------------------------------------------------------ */
function CopyButton({ text, label = "Copy code" }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch { /* give up quietly */ }
    }
    if (ok) {
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    }
  };
  return (
    <Btn variant="soft" onClick={copy}>
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Copied!" : label}
    </Btn>
  );
}

/* ------------------------------------------------------------------ */
/* Info (i): join code for private rooms, details, leave / delete       */
/* ------------------------------------------------------------------ */
export function GroupInfoDialog({ group, memberCount, canDelete, isHost, onManage, onLeave, onDelete, onClose }) {
  // Two-step confirm for the two destructive buttons, same spirit as the
  // reset / delete confirms elsewhere in the app -- a stray tap never leaves
  // a group or deletes it.
  const [confirm, setConfirm] = useState(null); // null | "leave" | "delete"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const act = async (fn) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (res?.error) setError(res.error);
  };

  return (
    <GtDialog onClose={onClose} label="Group info" className="sb-gt-info-dialog">
      <SectionTitle icon={Info}>{group.name}</SectionTitle>

      <div className="sb-gt-info-badges">
        <span className={`sb-gt-vis ${group.is_public ? "pub" : "priv"}`}>
          {group.is_public ? <Globe2 size={13} /> : <Lock size={13} />} {group.is_public ? "Public" : "Private"}
        </span>
        {typeof memberCount === "number" && (
          <span className="sb-gt-vis neutral"><Users size={13} /> {memberCount} {memberCount === 1 ? "member" : "members"}</span>
        )}
      </div>

      {group.description && <p className="sb-gt-info-text sb-gt-desc">{group.description}</p>}
      {group.rules && (
        <div className="sb-gt-rules-box">
          <span className="sb-gt-code-label">Room rules</span>
          <p className="sb-gt-info-text" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{group.rules}</p>
        </div>
      )}

      {group.is_public ? (
        <p className="sb-muted sb-gt-info-text">
          Anyone on StudyBun can find and join this room from the Group Timer page.
        </p>
      ) : (
        <div className="sb-gt-code-box">
          <span className="sb-gt-code-label">Join code</span>
          <span className="sb-gt-code" aria-label={`Join code ${group.join_code}`}>{prettyCode(group.join_code)}</span>
          <p className="sb-muted sb-gt-info-text" style={{ margin: 0 }}>
            Share this with friends. They enter it under <b>Private → Join with a code</b>.
          </p>
          <CopyButton text={group.join_code || ""} />
        </div>
      )}

      {error && <p className="sb-gt-error" role="alert">{error}</p>}

      <div className="sb-gt-info-actions">
        {confirm === "leave" ? (
          <>
            <span className="sb-gt-confirm-q">Leave this group?</span>
            <Btn variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>Stay</Btn>
            <Btn variant="soft" onClick={() => act(onLeave)} disabled={busy}><LogOut size={14} /> Yes, leave</Btn>
          </>
        ) : confirm === "delete" ? (
          <>
            <span className="sb-gt-confirm-q">Delete for everyone?</span>
            <Btn variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>Cancel</Btn>
            <Btn variant="soft" onClick={() => act(onDelete)} disabled={busy}><Trash2 size={14} /> Delete group</Btn>
          </>
        ) : (
          <>
            {isHost && onManage && <Btn variant="soft" onClick={onManage}><Settings size={14} /> Manage room</Btn>}
            <Btn variant="ghost" onClick={() => setConfirm("leave")}><LogOut size={14} /> Leave group</Btn>
            {canDelete && <Btn variant="ghost" onClick={() => setConfirm("delete")}><Trash2 size={14} /> Delete</Btn>}
          </>
        )}
      </div>
    </GtDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Create a group                                                       */
/* ------------------------------------------------------------------ */
export function CreateGroupDialog({ canMakePublic, onCreate, onEnter, onClose }) {
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  const trimmed = name.replace(/\s+/g, " ").trim();
  const valid = trimmed.length >= 2 && trimmed.length <= 40;

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const res = await onCreate(trimmed, canMakePublic && isPublic);
    setBusy(false);
    if (res.error) setError(res.error);
    else setCreated(res.group);
  };

  if (created) {
    return (
      <GtDialog onClose={onClose} label="Group created" className="sb-gt-info-dialog">
        <SectionTitle icon={Check}>{created.name} is ready</SectionTitle>
        {created.is_public ? (
          <p className="sb-muted sb-gt-info-text">Your public room is live in the Public list.</p>
        ) : (
          <div className="sb-gt-code-box">
            <span className="sb-gt-code-label">Join code</span>
            <span className="sb-gt-code" aria-label={`Join code ${created.join_code}`}>{prettyCode(created.join_code)}</span>
            <p className="sb-muted sb-gt-info-text" style={{ margin: 0 }}>
              Send this to your friends. You can always find it again with the (i) button inside the room.
            </p>
            <CopyButton text={created.join_code || ""} />
          </div>
        )}
        <div className="sb-gt-info-actions">
          <Btn onClick={() => onEnter(created)}>Enter room</Btn>
        </div>
      </GtDialog>
    );
  }

  return (
    <GtDialog onClose={onClose} label="Create a group" className="sb-gt-form-dialog">
      <SectionTitle icon={Plus}>Create a group</SectionTitle>
      <form onSubmit={submit} className="sb-gt-form">
        <label htmlFor="sb-gt-name">Group name</label>
        <input
          id="sb-gt-name"
          className="sb-input"
          value={name}
          maxLength={40}
          autoFocus
          placeholder="e.g. Night Owls 🦉"
          onChange={(e) => setName(e.target.value)}
        />
        {canMakePublic && (
          <div className="sb-gt-seg sb-gt-seg-sm" role="radiogroup" aria-label="Visibility">
            <button type="button" role="radio" aria-checked={!isPublic} className={!isPublic ? "on" : ""} onClick={() => setIsPublic(false)}><Lock size={13} /> Private</button>
            <button type="button" role="radio" aria-checked={isPublic} className={isPublic ? "on" : ""} onClick={() => setIsPublic(true)}><Globe2 size={13} /> Public</button>
          </div>
        )}
        <p className="sb-muted sb-gt-info-text" style={{ margin: 0 }}>
          {canMakePublic && isPublic
            ? "Public rooms are listed for everyone."
            : "Private rooms are invisible to everyone without the join code."}
        </p>
        {error && <p className="sb-gt-error" role="alert">{error}</p>}
        <div className="sb-gt-info-actions">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" disabled={!valid || busy}>{busy ? "Creating…" : "Create"}</Btn>
        </div>
      </form>
    </GtDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Join a private group with a code                                     */
/* ------------------------------------------------------------------ */
export function JoinCodeDialog({ onJoin, onClose }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const clean = normalizeCode(code);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (clean.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    const res = await onJoin(clean);
    setBusy(false);
    if (res?.error) setError(res.error);
  };

  return (
    <GtDialog onClose={onClose} label="Join with a code" className="sb-gt-form-dialog">
      <SectionTitle icon={KeyRound}>Join with a code</SectionTitle>
      <form onSubmit={submit} className="sb-gt-form">
        <label htmlFor="sb-gt-code-input">6-character code</label>
        <input
          id="sb-gt-code-input"
          className="sb-input sb-gt-code-input"
          value={code}
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          placeholder="ABC-123"
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 10))}
        />
        {error && <p className="sb-gt-error" role="alert">{error}</p>}
        <div className="sb-gt-info-actions">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" disabled={clean.length !== 6 || busy}>{busy ? "Joining…" : "Join group"}</Btn>
        </div>
      </form>
    </GtDialog>
  );
}
