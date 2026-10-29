import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Same visual language as Periodic Table / Focus Timer's dialogs
 * (.sb-pt-overlay / .sb-pt-dialog) — reused here rather than the
 * anchored ContentActions popover, since that component is tightly
 * bundled with Report/Block (neither of which applies inside an
 * invite-only private group) and always fires delete instantly with no
 * confirm step. This is the "confirm before delete, like Study Feed"
 * behavior for private chat: message delete, channel delete, remove
 * member, and leave-channel all route through this one dialog instead of
 * acting immediately.
 *
 * Portaled out of .sb-main (this component's DOM ancestor on every
 * route) for the same reason as MessageInfoModal.jsx's "Seen by" popup:
 * .sb-main sets `contain: layout`, which makes it the containing block
 * for `position: fixed` descendants. Left un-portaled, this overlay was
 * "fixed" to .sb-main's own scrolled box instead of the viewport --
 * scroll .sb-main first and the scrim opened off-center, falling short
 * of the real screen edges. Portaling to .sb-app (not document.body)
 * keeps every theme color this dialog's CSS reads (--card,
 * --mascot-outline, etc., set as inline custom properties on .sb-app)
 * while escaping .sb-main's containing-block trap. */
export default function ConfirmDialog({ open, title, body, confirmLabel = "Delete", danger = true, onConfirm, onCancel }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const portalTarget =
    (typeof document !== "undefined" && document.querySelector(".sb-app")) ||
    (typeof document !== "undefined" ? document.body : null);
  if (!portalTarget) return null;

  return createPortal(
    <div className="sb-pt-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div
        className="sb-pt-dialog sb-pchat-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogRef}
        tabIndex={-1}
      >
        <button className="sb-pt-dialog-close" title="Close" aria-label="Close" onClick={onCancel}>
          <X size={15} />
        </button>
        <h3 className="sb-pchat-confirm-title">{title}</h3>
        <p className="sb-pchat-confirm-body">{body}</p>
        <div className="sb-pchat-confirm-btns">
          <button type="button" className="sb-btn sb-btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className={`sb-btn ${danger ? "sb-pchat-btn-danger" : "sb-btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    portalTarget
  );
}
