import React, { useState } from "react";
import { Lock, Unlock, Loader2 } from "lucide-react";

// Only ever rendered when moderation.isChannelLockAdmin is true — see
// useCommunityModeration. That flag is cosmetic (decides whether this
// even shows up); the actual power is re-checked server-side by
// set_channel_lock() on every call, by a single hardcoded user_id, not
// by role — see supabase/migration_channel_lock.sql for why this is
// deliberately narrower than "founder".
//
// Reads as a physical switch on purpose: this is the one control on the
// whole page that can silence every other user at once, so it should
// never look like a casual checkbox. Locked = filled red track + "CLOSED",
// unlocked = filled green track + "OPEN" — the same red used for
// destructive actions elsewhere in Community (#C24444).
export default function ChannelLockToggle({ channelName, locked, onToggle }) {
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState(null);

  const handleClick = async () => {
    if (pending) return;
    setPending(true);
    setErr(null);
    const res = await onToggle(!locked);
    setPending(false);
    if (!res.ok) setErr(res.error || "Couldn't update that.");
  };

  return (
    <div className="sb-channel-lock">
      <button
        type="button"
        className={`sb-channel-lock-switch ${locked ? "locked" : "unlocked"}`}
        role="switch"
        aria-checked={locked}
        aria-label={locked ? `Reopen #${channelName}` : `Close #${channelName} for everyone`}
        onClick={handleClick}
        disabled={pending}
        title={locked ? "Only you can reopen this channel" : "Closes this channel for every user, instantly"}
      >
        <span className="sb-channel-lock-track">
          <span className="sb-channel-lock-knob">
            {pending ? <Loader2 size={12} className="sb-spin" /> : locked ? <Lock size={12} /> : <Unlock size={12} />}
          </span>
        </span>
        <span className="sb-channel-lock-label">{locked ? "Closed" : "Open"}</span>
      </button>
      {err && <span className="sb-channel-lock-err">{err}</span>}
    </div>
  );
}
