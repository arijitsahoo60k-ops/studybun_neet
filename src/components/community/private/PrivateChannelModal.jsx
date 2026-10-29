import React, { useEffect, useRef, useState } from "react";
import { X, Search, Check } from "lucide-react";
import Mascot from "../../Mascot";

/** Two modes sharing one dialog:
 *   - "create": name field + member picker, used by the "+" button.
 *   - "addMembers": member picker only (existing members pre-excluded),
 *     used by a channel's kebab menu.
 * The user list itself only ever comes from get_private_chat_directory()
 * (founder-only RPC — see migration_private_chat.sql), fetched fresh each
 * time the dialog opens rather than kept in state elsewhere, since it's
 * only needed for the brief moment this picker is open. */
export default function PrivateChannelModal({ open, mode, existingMemberIds, fetchDirectory, onSubmit, onClose }) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [directory, setDirectory] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [dirError, setDirError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setQuery("");
    setSelected(new Set());
    setDirError(null);
    setLoadingDirectory(true);
    fetchDirectory().then((res) => {
      setLoadingDirectory(false);
      if (res.ok) setDirectory(res.data);
      else { setDirectory([]); setDirError(res.error); }
    });
    if (mode === "create") setTimeout(() => nameInputRef.current?.focus(), 30);
  }, [open, mode, fetchDirectory]);

  if (!open) return null;

  const excluded = existingMemberIds || new Set();
  const pickable = directory.filter((u) => !excluded.has(u.user_id));
  const visible = query.trim()
    ? pickable.filter((u) => u.name?.toLowerCase().includes(query.trim().toLowerCase()))
    : pickable;

  const toggle = (uid) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const canSubmit = mode === "create" ? name.trim().length > 0 : selected.size > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    await onSubmit(mode === "create" ? name.trim() : null, [...selected]);
    setSubmitting(false);
  };

  return (
    <div className="sb-pt-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sb-pt-dialog sb-pchat-modal" role="dialog" aria-modal="true" aria-label={mode === "create" ? "New private channel" : "Add members"}>
        <button className="sb-pt-dialog-close" title="Close" aria-label="Close" onClick={onClose}>
          <X size={15} />
        </button>

        <h3 className="sb-pchat-confirm-title">{mode === "create" ? "New private channel" : "Add members"}</h3>
        <p className="sb-pchat-modal-sub">
          {mode === "create" ? "Only people you add can see this chat." : "They'll be able to see the whole history."}
        </p>

        {mode === "create" && (
          <>
            <label className="sb-pchat-modal-label">Channel name</label>
            <input
              ref={nameInputRef}
              type="text"
              className="sb-pchat-modal-input"
              placeholder="e.g. Toppers Circle"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </>
        )}

        <label className="sb-pchat-modal-label">{mode === "create" ? "Add members" : "Pick people to add"}</label>
        <div className="sb-pchat-modal-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search by name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="sb-pchat-modal-userlist">
          {loadingDirectory ? (
            <p className="sb-muted small" style={{ padding: 10 }}>Loading...</p>
          ) : dirError ? (
            <p className="sb-muted small" style={{ padding: 10 }}>{dirError}</p>
          ) : visible.length === 0 ? (
            <p className="sb-muted small" style={{ padding: 10 }}>
              {query.trim()
                ? "No one matches that search."
                : mode === "create"
                ? "No one else to add yet."
                : "Everyone's already in this channel."}
            </p>
          ) : (
            visible.map((u) => {
              const checked = selected.has(u.user_id);
              return (
                <button
                  type="button"
                  key={u.user_id}
                  className={`sb-pchat-modal-user-row ${checked ? "checked" : ""}`}
                  onClick={() => toggle(u.user_id)}
                >
                  <span className="sb-pchat-modal-user-avatar"><Mascot species={u.mascot || "bunny"} mood="happy" size={28} ambient={false} /></span>
                  <span className="sb-pchat-modal-user-name">{u.name || "Study Buddy"}</span>
                  <span className={`sb-pchat-modal-check ${checked ? "on" : ""}`}>{checked && <Check size={12} />}</span>
                </button>
              );
            })
          )}
        </div>

        {mode === "create" && (
          <p className="sb-pchat-modal-hint">You can add more people later from the chat's ⋯ menu.</p>
        )}

        <div className="sb-pchat-confirm-btns">
          <button type="button" className="sb-btn sb-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="sb-btn sb-btn-primary" disabled={!canSubmit || submitting} onClick={handleSubmit}>
            {submitting ? "Working..." : mode === "create" ? "Create" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
