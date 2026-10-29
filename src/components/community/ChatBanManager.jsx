import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ban, X, UserCheck, Loader2, Search } from "lucide-react";
import { fetchProfilesByIds } from "../../lib/communityProfiles";

// Only ever rendered when useCommunityChatBan().isBanAdmin is true — see
// supabase/migration_chat_ban.sql. Cosmetic gate; set_chat_ban() and
// get_chat_ban_directory() re-check server-side on every call.
//
// Two jobs, both reachable from the chat header's "Blocked" button:
//   1. "Block someone": search every community member by name and block
//      them (works for people with no message on screen).
//   2. "Blocked": everyone currently blocked, each with an Unblock button.
// Community messages expire (see api/cron/community-cleanup.js), so a
// message's own Ban icon can't be the only handle for either direction.
//
// Portaled to .sb-app for the same reason as ConfirmDialog / MessageInfoModal
// (.sb-main's `contain: layout` would otherwise trap position: fixed).

// How many search results to render at once — the community is a few
// hundred people, so this only exists to keep the DOM small on a phone.
const MAX_RESULTS = 30;

export default function ChatBanManager({ bannedIds, onBan, onUnban, fetchDirectory, founderIds }) {
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState(() => new Map());
  // { status: "idle" | "loading" | "ok" | "error", rows: [], error?: string }
  const [dir, setDir] = useState({ status: "idle", rows: [] });
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState(null); // member awaiting "Block?" confirm
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState(null);
  const dialogRef = useRef(null);

  const ids = useMemo(() => [...bannedIds].sort(), [bannedIds]);
  const idsKey = ids.join(",");

  const loadDirectory = useCallback(async () => {
    if (!fetchDirectory) return undefined;
    setDir((d) => ({ status: "loading", rows: d.rows }));
    const res = await fetchDirectory();
    setDir(res.ok
      ? { status: "ok", rows: res.data || [] }
      : { status: "error", rows: [], error: res.error || "Couldn't load members. Try again." });
    return res;
  }, [fetchDirectory]);

  // Fresh member list every time the dialog opens, so someone who joined
  // since last time is findable. Nothing is fetched while it's closed.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      if (!fetchDirectory) return;
      setDir((d) => ({ status: "loading", rows: d.rows }));
      const res = await fetchDirectory();
      if (cancelled) return;
      setDir(res.ok
        ? { status: "ok", rows: res.data || [] }
        : { status: "error", rows: [], error: res.error || "Couldn't load members. Try again." });
    })();
    return () => { cancelled = true; };
  }, [open, fetchDirectory]);

  // Names for the blocked list (covers people the directory omits, e.g.
  // someone blocked who later opted out).
  useEffect(() => {
    if (!open || ids.length === 0) return undefined;
    let cancelled = false;
    fetchProfilesByIds(ids).then((map) => {
      if (!cancelled) setNames(map);
    }).catch(() => {});
    return () => { cancelled = true; };
    // idsKey is the stable stand-in for `ids`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idsKey]);

  useEffect(() => {
    if (!open) return undefined;
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => { setOpen(false); setErr(null); setQuery(""); setConfirmId(null); };

  const dirNames = useMemo(() => new Map(dir.rows.map((r) => [r.user_id, r.name])), [dir.rows]);
  const nameOf = (id) => names.get(id)?.name || dirNames.get(id) || "Study Buddy";

  // Everyone not already blocked, filtered by the search box. `bannedIds`
  // (live via realtime) is the source of truth, not the directory's own
  // is_banned flag, which is only as fresh as the moment it was fetched.
  const { results, hiddenCount } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = dir.rows.filter((r) => !bannedIds.has(r.user_id) && (!q || (r.name || "").toLowerCase().includes(q)));
    return { results: pool.slice(0, MAX_RESULTS), hiddenCount: Math.max(0, pool.length - MAX_RESULTS) };
  }, [dir.rows, bannedIds, query]);

  const handleUnban = async (id) => {
    if (busyId) return;
    setBusyId(id);
    setErr(null);
    const res = await onUnban(id);
    setBusyId(null);
    if (!res.ok) setErr(res.error || "Couldn't unblock that user. Try again.");
  };

  const handleBan = async (id) => {
    if (busyId) return;
    setBusyId(id);
    setErr(null);
    const res = await onBan(id);
    setBusyId(null);
    setConfirmId(null);
    if (!res.ok) setErr(res.error || "Couldn't block that user. Try again.");
  };

  const portalTarget =
    (typeof document !== "undefined" && document.querySelector(".sb-app")) ||
    (typeof document !== "undefined" ? document.body : null);

  return (
    <div className="sb-chat-ban-manager">
      <button
        type="button"
        className="sb-chat-ban-manager-btn"
        onClick={() => setOpen(true)}
        title="Block someone or see who's blocked from Community Chat"
        aria-label={`Blocked from chat (${ids.length})`}
      >
        <Ban size={12} />
        <span>Blocked{ids.length > 0 ? ` · ${ids.length}` : ""}</span>
      </button>

      {open && portalTarget && createPortal(
        <div className="sb-pt-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div
            className="sb-pt-dialog sb-pchat-confirm-dialog sb-chat-ban-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Block from Community Chat"
            ref={dialogRef}
            tabIndex={-1}
          >
            <button className="sb-pt-dialog-close" title="Close" aria-label="Close" onClick={close}>
              <X size={15} />
            </button>
            <h3 className="sb-pchat-confirm-title">Community Chat blocks</h3>

            {fetchDirectory && onBan && (
              <>
                <div className="sb-chat-ban-section-title">Block someone</div>
                <label className="sb-chat-ban-search">
                  <Search size={13} aria-hidden="true" />
                  <input
                    type="text"
                    className="sb-input"
                    placeholder="Search members by name"
                    aria-label="Search members to block"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                  />
                </label>

                {dir.status === "loading" && dir.rows.length === 0 ? (
                  <div className="sb-chat-ban-empty"><Loader2 size={13} className="sb-spin" /> Loading members…</div>
                ) : dir.status === "error" ? (
                  <div className="sb-chat-ban-empty">
                    <span>{dir.error}</span>{" "}
                    <button type="button" className="sb-btn sb-btn-ghost sb-chat-ban-retry" onClick={loadDirectory}>Retry</button>
                  </div>
                ) : results.length === 0 ? (
                  <div className="sb-chat-ban-empty">
                    {query.trim() ? "No one matches that name." : "No one left to block."}
                  </div>
                ) : (
                  <ul className="sb-chat-ban-list sb-chat-ban-results" aria-label="Members">
                    {results.map((r) => {
                      const isFounderRow = !!founderIds?.has?.(r.user_id);
                      const confirming = confirmId === r.user_id;
                      return (
                        <li key={r.user_id} className="sb-chat-ban-row">
                          <span className="sb-chat-ban-name">
                            {r.name || "Study Buddy"}
                            {isFounderRow && <span className="sb-chat-ban-tag">founder</span>}
                          </span>
                          {confirming ? (
                            <span className="sb-chat-ban-confirm">
                              <button
                                type="button"
                                className="sb-btn sb-chat-ban-confirm-yes"
                                disabled={busyId != null}
                                onClick={() => handleBan(r.user_id)}
                                aria-label={`Confirm block ${r.name || "this user"}`}
                              >
                                {busyId === r.user_id ? <Loader2 size={12} className="sb-spin" /> : <Ban size={12} />}
                                Sure?
                              </button>
                              <button
                                type="button"
                                className="sb-btn sb-btn-ghost"
                                disabled={busyId != null}
                                onClick={() => setConfirmId(null)}
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="sb-btn sb-btn-ghost sb-chat-ban-block"
                              disabled={busyId != null}
                              onClick={() => { setErr(null); setConfirmId(r.user_id); }}
                              aria-label={`Block ${r.name || "this user"}`}
                            >
                              <Ban size={12} />
                              Block
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {hiddenCount > 0 && (
                  <div className="sb-chat-ban-more">+{hiddenCount} more — type a name to narrow it down</div>
                )}

              </>
            )}

            <div className="sb-chat-ban-section-title">Blocked now{ids.length > 0 ? ` · ${ids.length}` : ""}</div>
            {ids.length === 0 ? (
              <p className="sb-chat-ban-empty">Nobody is blocked right now.</p>
            ) : (
              <ul className="sb-chat-ban-list" aria-label="Blocked members">
                {ids.map((id) => (
                  <li key={id} className="sb-chat-ban-row">
                    <span className="sb-chat-ban-name">{nameOf(id)}</span>
                    <button
                      type="button"
                      className="sb-btn sb-btn-ghost sb-chat-ban-unblock"
                      disabled={busyId != null}
                      onClick={() => handleUnban(id)}
                      aria-label={`Unblock ${nameOf(id)}`}
                    >
                      {busyId === id ? <Loader2 size={12} className="sb-spin" /> : <UserCheck size={12} />}
                      Unblock
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {err && <div className="sb-chat-delete-err">{err}</div>}
          </div>
        </div>,
        portalTarget
      )}
    </div>
  );
}
