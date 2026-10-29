import React, { useState } from "react";
import { MoreHorizontal, Flag, UserX, Trash2 } from "lucide-react";

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "abuse", label: "Abuse" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "misinformation", label: "Academic misinformation" },
  { value: "other", label: "Other" },
];

/**
 * The "⋯" menu on any chat message / post / reply. Report and Block are
 * always available on other people's content; Delete shows for your own
 * content, or when the caller says you may delete this author's content.
 * Reused everywhere instead of a separate BlockDialog/ReportDialog pair
 * per surface.
 *
 * `canDelete` replaced the old `isModerator` flag when the ⚡ Mod role
 * landed: "may I delete this" now depends on WHO wrote it (a mod can't
 * touch a founder's content), so it can't be answered by a single
 * role boolean here. The caller passes the already-resolved answer from
 * useCommunityModeration's canDelete(authorId). Own content is still
 * always deletable regardless of what's passed, so a missing prop can
 * never lock someone out of their own post.
 */
export default function ContentActions({ authorId, currentUserId, canDelete: canDeleteProp, targetType, targetId, onReport, onBlock, onDelete }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null); // null | "report" | "confirmBlock" | "confirmDelete"
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const isOwn = authorId === currentUserId;
  const canDelete = isOwn || !!canDeleteProp;

  const close = () => { setOpen(false); setMode(null); setDetails(""); setReason("spam"); setDone(false); };

  const submitReport = async () => {
    setSubmitting(true);
    const res = await onReport?.({ targetType, targetId, reason, details });
    setSubmitting(false);
    if (res?.ok) setDone(true);
  };

  return (
    <div className="sb-cm-actions">
      <button type="button" className="sb-cm-actions-trigger" onClick={() => setOpen((v) => !v)} aria-label="More actions">
        <MoreHorizontal size={16} />
      </button>
      {open && !mode && (
        <div className="sb-cm-actions-menu" role="menu">
          {!isOwn && (
            <button type="button" role="menuitem" onClick={() => setMode("report")}>
              <Flag size={13} /> Report
            </button>
          )}
          {!isOwn && (
            <button type="button" role="menuitem" onClick={() => setMode("confirmBlock")}>
              <UserX size={13} /> Block user
            </button>
          )}
          {canDelete && (
            <button type="button" role="menuitem" className="danger" onClick={() => setMode("confirmDelete")}>
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      )}
      {open && mode === "report" && (
        <div className="sb-cm-actions-panel" role="dialog" aria-label="Report content">
          {done ? (
            <>
              <p>Report sent. Thanks for helping keep this space safe.</p>
              <button type="button" onClick={close}>Close</button>
            </>
          ) : (
            <>
              <label className="sb-cm-panel-label">Why are you reporting this?</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)}>
                {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <textarea
                placeholder="Add details (optional)"
                value={details}
                maxLength={500}
                onChange={(e) => setDetails(e.target.value)}
              />
              <div className="sb-cm-panel-btns">
                <button type="button" onClick={close}>Cancel</button>
                <button type="button" className="primary" disabled={submitting} onClick={submitReport}>
                  {submitting ? "Sending..." : "Submit report"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {open && mode === "confirmBlock" && (
        <div className="sb-cm-actions-panel" role="dialog" aria-label="Block user">
          <p>Block this student? You won't see their messages or posts anymore.</p>
          <div className="sb-cm-panel-btns">
            <button type="button" onClick={close}>Cancel</button>
            <button type="button" className="primary" onClick={() => { onBlock?.(); close(); }}>Block</button>
          </div>
        </div>
      )}
      {/* Delete is permanent (removes the row + any attached image from
          storage) with no undo, so it gets the same confirm-panel pattern
          as Block instead of firing straight from the menu item. */}
      {open && mode === "confirmDelete" && (
        <div className="sb-cm-actions-panel" role="dialog" aria-label="Delete confirmation">
          <p>Delete this {targetType === "post" ? "post" : "reply"}? This can't be undone.</p>
          <div className="sb-cm-panel-btns">
            <button type="button" onClick={close}>Cancel</button>
            <button type="button" className="primary danger" onClick={() => { onDelete?.(); close(); }}>Delete</button>
          </div>
        </div>
      )}
      {open && <div className="sb-cm-actions-backdrop" onClick={close} />}
    </div>
  );
}
