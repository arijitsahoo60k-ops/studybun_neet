import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Mascot from "../Mascot";
import { fetchMessageReaders } from "../../lib/communityProfiles";
import { useModalScrollLock } from "../../hooks/useModalScrollLock";

/** WhatsApp-style "message info" popup — reuses the same
 * .sb-pt-overlay/.sb-pt-dialog chrome as the Periodic Table / Focus
 * Timer / "who's studying" dialogs so it opens centered with zero new
 * overlay plumbing.
 *
 * Fetches lazily, only while open, and only for the one message being
 * inspected — a chat can have hundreds of messages on screen, and
 * nothing here is computed until someone actually taps the (i). That,
 * plus the channel-level read watermark this reads from (see
 * migration_community_chat_read_receipts.sql), is what keeps this from
 * adding any per-message cost to the chat itself.
 *
 * `message` is only ever one of the current user's own — CommunityChat
 * only opens this from the (i) button ChatMessage shows on `isOwn`
 * messages, and the RPC itself excludes the caller from the results,
 * so there's nothing to double-guard here.
 */
export default function MessageInfoModal({ open, channelId, message, onClose }) {
  const [readers, setReaders] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(null);
  const dialogRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!open || !message) return;
    const requestId = ++requestIdRef.current;
    setReaders(null);
    setLoadError(null);
    fetchMessageReaders(channelId, message.created_at)
      .then((rows) => {
        if (requestIdRef.current === requestId) setReaders(rows);
      })
      .catch(() => {
        if (requestIdRef.current === requestId) setLoadError("Couldn't load this right now.");
      });
  }, [open, channelId, message]);

  useEffect(() => {
    if (!open) return undefined;
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // See src/hooks/useModalScrollLock.js -- without this, dragging on the
  // black backdrop scrolls the chat behind the dialog instead of staying put.
  // This component stays mounted while closed (toggled via `open`), so the
  // lock is gated on `active` rather than mount/unmount.
  useModalScrollLock(dialogRef, open);

  if (!open || !message) return null;

  const hasText = Boolean(message.content?.trim());
  const previewText = hasText ? message.content : message.image_url ? "📷 Photo" : "";

  // Portaled out of .sb-main (this component's DOM ancestor on every
  // route) because .sb-main sets `contain: layout`, which per spec makes
  // it the containing block for `position: fixed` descendants -- same
  // effect as a transform. Left un-portaled, this overlay is "fixed" to
  // .sb-main's own scrollable box instead of the viewport: scroll .sb-main
  // down first and the overlay renders anchored to where .sb-main's top
  // used to be, so it opens above-center and the scrim falls short of the
  // real bottom of the screen.
  //
  // The portal target is .sb-app, NOT document.body. Every theme color
  // this dialog's CSS reads (--card, --mascot-outline, --mascot-ink, etc.,
  // see src/App.jsx) is set as an inline custom property on .sb-app, not
  // on <body> -- portaling straight to body escapes that scope too and
  // the dialog renders with no colors at all (transparent background,
  // invisible border). .sb-app has no transform/contain/filter of its own,
  // so mounting there keeps the overlay a sibling of .sb-main -- clear of
  // its containing-block trap -- while still inheriting every theme
  // variable normally.
  const portalTarget =
    (typeof document !== "undefined" && document.querySelector(".sb-app")) ||
    (typeof document !== "undefined" ? document.body : null);
  if (!portalTarget) return null;

  return createPortal(
    <div className="sb-pt-overlay sb-msginfo-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="sb-pt-dialog sb-msginfo-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Message info"
        ref={dialogRef}
        tabIndex={-1}
      >
        <button className="sb-pt-dialog-close" title="Close" aria-label="Close" onClick={onClose}>
          <X size={15} />
        </button>

        <h3 className="sb-msginfo-title">Seen by</h3>
        {previewText && <p className="sb-msginfo-preview">{previewText}</p>}

        {readers === null ? (
          <div className="sb-muted small sb-msginfo-status">Loading…</div>
        ) : loadError ? (
          <div className="sb-muted small sb-msginfo-status">{loadError}</div>
        ) : readers.length === 0 ? (
          <div className="sb-msginfo-empty">No one's seen this yet.</div>
        ) : (
          <div className="sb-msginfo-list">
            {readers.map((r) => (
              <div key={r.user_id} className="sb-msginfo-row">
                <Mascot species={r.mascot || "bunny"} mood="happy" size={30} ambient={false} />
                <span className="sb-msginfo-name">{r.name || "Study Buddy"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    portalTarget
  );
}
