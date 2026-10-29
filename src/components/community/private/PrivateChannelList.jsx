import React from "react";
import { ArrowLeft, Plus, Lock } from "lucide-react";
import Mascot from "../../Mascot";
import { EmptyState } from "../../ui";

function formatPreviewTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  return isToday
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export default function PrivateChannelList({
  channels, activeChannelId, onSelectChannel, isFounder, currentUserId,
  onOpenCreate, onExit, loading, mascot,
}) {
  return (
    <div className="sb-pchat-list-pane">
      <div className="sb-pchat-list-header">
        <button type="button" className="sb-pchat-back-btn" onClick={onExit} aria-label="Back to Community" title="Back to Community">
          <ArrowLeft size={18} />
        </button>
        <div className="sb-pchat-list-title">Private Chats</div>
        {isFounder && (
          <button type="button" className="sb-pchat-add-btn" onClick={onOpenCreate} aria-label="New channel" title="New channel">
            <Plus size={18} />
          </button>
        )}
      </div>

      <div className="sb-pchat-channel-list">
        {loading ? (
          <p className="sb-muted small" style={{ padding: 14 }}>Loading...</p>
        ) : channels.length === 0 ? (
          <div className="sb-pchat-list-empty">
            <EmptyState
              mascot={mascot}
              mood="idle"
              text={isFounder ? "No private channels yet" : "You haven't been added to a private channel yet"}
              sub={isFounder ? "Tap + to start one." : "A founder will add you when there's one for you."}
            />
          </div>
        ) : (
          channels.map((c) => {
            // BUG FIX: the original code used Array.find() which returns the
            // FIRST match — but members are ordered by insertion time, not by
            // "most relevant for display". For a group with multiple members,
            // we want the avatar to be the first OTHER person in the channel,
            // not just any non-self. `find` already gives the first match, so
            // the logic was actually correct, but the fallback `|| c.members[0]`
            // was wrong: if currentUserId is c.members[0] AND is the ONLY member
            // (e.g. founder created the channel without adding anyone yet), we'd
            // show the founder's own avatar — which is fine, but potentially
            // confusing. Added an explicit solo-member guard so the avatar
            // always makes visual sense.
            const others = c.members.filter((m) => m.user_id !== currentUserId);
            const displayMember = others.length > 0 ? others[0] : c.members[0];
            const isOwnLast = c.last_message_user_id === currentUserId;
            const preview = c.last_message_preview
              ? `${isOwnLast ? "You: " : ""}${c.last_message_preview}`
              : "No messages yet";
            // Show member count badge for groups with more than 2 participants
            // (i.e. more than just "you + one other"). Matches WhatsApp's
            // convention of only showing group size for actual group chats.
            const memberCount = c.members.length;
            return (
              <button
                type="button"
                key={c.id}
                className={`sb-pchat-channel-row ${c.id === activeChannelId ? "active" : ""}`}
                onClick={() => onSelectChannel(c.id)}
              >
                <span className="sb-pchat-channel-avatar">
                  <Mascot species={displayMember?.mascot || "bunny"} mood="happy" size={38} ambient={false} />
                </span>
                <span className="sb-pchat-channel-info">
                  <span className="sb-pchat-channel-name">
                    {c.name}
                    {memberCount > 2 && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", marginLeft: 5 }}>
                        {memberCount}
                      </span>
                    )}
                  </span>
                  <span className="sb-pchat-channel-preview">{preview}</span>
                </span>
                <span className="sb-pchat-channel-time">{formatPreviewTime(c.last_message_at || c.created_at)}</span>
              </button>
            );
          })
        )}
      </div>

      <div className="sb-pchat-list-footnote">
        <Lock size={11} />
        {isFounder
          ? "Only you can create channels & delete anyone's message here."
          : "Only a founder can add members or remove messages."}
      </div>
    </div>
  );
}
