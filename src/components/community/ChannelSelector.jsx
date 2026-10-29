import React from "react";
import { Lock } from "lucide-react";

const NONE = new Set();

// `unreadIds` (optional Set of channel ids) — channels with messages from
// other people the viewer hasn't seen get a red ring around their pill.
// The selected channel never shows it (it's the one on screen).
export default function ChannelSelector({ channels, activeId, onSelect, unreadIds = NONE }) {
  return (
    <div className="sb-channel-selector">
      {channels.map((c) => {
        const isActive = activeId === c.id;
        const hasUnread = !isActive && !!unreadIds?.has?.(c.id);
        return (
          <button
            key={c.id}
            type="button"
            className={`sb-chip small ${isActive ? "active" : ""} ${c.is_locked ? "locked" : ""} ${hasUnread ? "unread" : ""}`}
            aria-label={hasUnread ? `${c.name}, new messages` : undefined}
            onClick={() => onSelect(c.id)}
          >
            {c.is_locked && <Lock size={11} className="sb-chip-lock-icon" aria-hidden="true" />}
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
