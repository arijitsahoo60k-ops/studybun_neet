import React from "react";

/*
 * Styles just for the Private Chats page (src/components/community/private/*).
 * Kept separate from CommunityStyle.jsx the same way that file is kept
 * separate from GlobalStyle.jsx — this is its own full-page detail view
 * (see StudyStuffs' sb-page-studystuffs-detail pattern), not another card
 * inside the community settings-shell.
 *
 * Deliberately reuses rather than re-defines: .sb-chat-msg*, .sb-chat-date-sep,
 * .sb-chat-load-older, .sb-chat-expiry-note, .sb-cm-actions-backdrop, and
 * .sb-pt-overlay/.sb-pt-dialog all come from CommunityStyle.jsx / GlobalStyle.jsx
 * — ChatMessage/ChatComposer render those classes verbatim here too, so this
 * file only needs to cover what's actually new: the two-pane shell, the
 * channel list, and the chat header/kebab.
 *
 * NOTE: Community.jsx only renders <PrivateChatStyle /> once — in the regular
 * community shell branch (for the nav pill hover styles). The private-chat
 * full-page branch renders it separately. Both cases are fine because React
 * deduplicates <style> tags by content in the same document. Do NOT add a
 * second import in Community.jsx.
 */
export default function PrivateChatStyle() {
  return (
    <style>{`
      /* Override sb-page max-width when inside private-chat full-page view */
      .sb-page-private-chat { max-width: clamp(680px, 96vw, 1480px); }

      /* ---------- sb-pchat-page: fills the page, centres the wrap ----------
         sb-page gives display:flex + flex-direction:column, but sb-pchat-page
         is a *child* of sb-page and needs its own flex setup so sb-pchat-wrap
         can fill the available height without a fixed vh value on the outer
         container. Without this the wrap's min(84dvh) height was the only
         thing keeping it from collapsing. */
      .sb-pchat-page {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        width: 100%;
      }

      .sb-private-nav-item .sb-settings-nav-icon { filter: none; }

      /* ---------- shell: two panes side by side ---------- */
      .sb-pchat-wrap {
        display: flex; border: 2px solid var(--mascot-outline); border-radius: 22px;
        background: var(--card); box-shadow: 5px 5px 0 var(--sticker-shadow, var(--mascot-outline));
        overflow: hidden;
        flex: 1;
        min-height: 0;
        height: min(84vh, 840px);
        height: min(84dvh, 840px);
      }

      .sb-pchat-list-pane {
        width: 320px; flex-shrink: 0; display: flex; flex-direction: column;
        border-right: 2px solid var(--mascot-outline); background: var(--soft);
        min-height: 0;
      }
      .sb-pchat-chat-pane { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }

      .sb-pchat-mobile-only { display: none; }

      /* ---------- list pane: header ---------- */
      .sb-pchat-list-header {
        display: flex; align-items: center; gap: 8px; padding: 14px 14px 12px;
        border-bottom: 2px solid var(--mascot-outline); flex-shrink: 0;
      }
      .sb-pchat-list-title { font-family: var(--font-display); font-weight: 800; font-size: 17px; color: var(--mascot-ink); flex: 1; }
      .sb-pchat-back-btn, .sb-pchat-add-btn, .sb-pchat-kebab-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 32px; height: 32px; border-radius: 10px; border: 2px solid var(--mascot-outline);
        background: var(--card); color: var(--mascot-ink); cursor: pointer; flex-shrink: 0;
        transition: transform .12s ease, background .12s ease;
      }
      .sb-pchat-back-btn:hover, .sb-pchat-add-btn:hover, .sb-pchat-kebab-btn:hover { background: var(--soft); transform: translateY(-1px); }
      .sb-pchat-add-btn { background: var(--accent); color: #fff; }

      /* ---------- list pane: channel rows ---------- */
      .sb-pchat-channel-list { flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px; min-height: 0; }
      .sb-pchat-list-empty { padding: 18px 10px; }
      .sb-pchat-channel-row {
        display: flex; align-items: center; gap: 10px; padding: 9px 8px; border-radius: 14px;
        border: 2px solid transparent; background: none; cursor: pointer; text-align: left; width: 100%;
        transition: background .12s ease, border-color .12s ease;
      }
      .sb-pchat-channel-row:hover { background: var(--card); }
      .sb-pchat-channel-row.active { background: var(--card); border-color: var(--mascot-outline); box-shadow: 2px 2px 0 var(--sticker-shadow, var(--mascot-outline)); }
      .sb-pchat-channel-avatar { flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%; overflow: hidden; background: var(--card); border: 2px solid var(--mascot-outline); display: flex; align-items: center; justify-content: center; }
      .sb-pchat-channel-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .sb-pchat-channel-name { font-weight: 800; font-size: 13.5px; color: var(--mascot-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sb-pchat-channel-preview { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sb-pchat-channel-time { font-size: 10.5px; color: var(--muted); flex-shrink: 0; align-self: flex-start; margin-top: 2px; }

      .sb-pchat-list-footnote {
        display: flex; align-items: center; gap: 6px; padding: 10px 14px; font-size: 10.5px;
        color: var(--muted); border-top: 2px solid var(--mascot-outline); flex-shrink: 0; line-height: 1.4;
      }
      .sb-pchat-list-footnote svg { flex-shrink: 0; }

      /* ---------- chat pane: header ---------- */
      .sb-pchat-chat-header {
        display: flex; align-items: center; gap: 10px; padding: 12px 16px;
        border-bottom: 2px solid var(--mascot-outline); flex-shrink: 0;
      }
      .sb-pchat-chat-title-wrap { flex: 1; min-width: 0; }
      .sb-pchat-chat-title { font-family: var(--font-display); font-weight: 800; font-size: 16px; color: var(--mascot-ink); }
      .sb-pchat-chat-sub { font-size: 11.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .sb-pchat-kebab-wrap { position: relative; }
      .sb-pchat-kebab-menu {
        position: absolute; top: calc(100% + 6px); right: 0; z-index: 50; min-width: 190px;
        background: var(--card); border: 2px solid var(--mascot-outline); border-radius: 14px;
        box-shadow: 4px 4px 0 var(--sticker-shadow, var(--mascot-outline)); padding: 6px; display: flex; flex-direction: column; gap: 2px;
      }
      .sb-pchat-kebab-menu button {
        display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 9px;
        background: none; border: none; text-align: left; font-size: 12.5px; font-weight: 700;
        color: var(--mascot-ink); cursor: pointer;
      }
      .sb-pchat-kebab-menu button:hover { background: var(--soft); }
      .sb-pchat-kebab-menu button.danger { color: #C24444; }
      .sb-pchat-kebab-menu button.danger:hover { background: #C24444; color: #fff; }

      /* ---------- chat pane: message list ---------- */
      .sb-pchat-msg-list { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 14px 16px; min-height: 0; display: flex; flex-direction: column; }
      .sb-pchat-empty-thread { margin: auto; text-align: center; color: var(--muted); font-size: 13px; font-weight: 700; padding: 20px; }
      .sb-pchat-no-active { align-items: center; justify-content: center; }
      .sb-pchat-no-active-inner { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 20px; }

      /* ---------- shared confirm dialog + modal (create channel / add members / rename) ---------- */
      .sb-pchat-confirm-dialog { max-width: 360px; }
      .sb-pchat-confirm-title { font-family: var(--font-display); font-size: 17px; font-weight: 800; color: var(--mascot-ink); margin: 4px 0 8px; }
      .sb-pchat-confirm-body { font-size: 13px; color: var(--muted); line-height: 1.5; margin-bottom: 4px; }
      .sb-pchat-confirm-btns { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
      .sb-pchat-btn-danger { background: #C24444; border-color: #C24444; color: #fff; }
      .sb-pchat-btn-danger:hover { opacity: .9; }

      .sb-pchat-modal { max-width: 380px; text-align: left; }
      .sb-pchat-modal-sub { font-size: 12.5px; color: var(--muted); margin: -2px 0 14px; }
      .sb-pchat-modal-label { display: block; font-size: 11px; font-weight: 800; color: var(--mascot-ink); text-transform: uppercase; letter-spacing: .03em; margin: 12px 0 6px; }
      .sb-pchat-modal-input {
        width: 100%; padding: 10px 12px; border-radius: 12px; border: 2px solid var(--mascot-outline);
        background: var(--bg, #fff); font-size: 14px; font-weight: 600; color: var(--mascot-ink);
        box-sizing: border-box;
      }
      .sb-pchat-modal-input:focus { outline: none; border-color: var(--accent); }
      .sb-pchat-modal-search {
        display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 12px;
        border: 2px solid var(--mascot-outline); background: var(--bg, #fff); margin-bottom: 8px; color: var(--muted);
      }
      .sb-pchat-modal-search input { flex: 1; border: none; background: none; font-size: 13px; color: var(--mascot-ink); }
      .sb-pchat-modal-search input:focus { outline: none; }
      .sb-pchat-modal-userlist {
        max-height: 240px; overflow-y: auto; border: 2px solid var(--mascot-outline); border-radius: 14px;
        background: var(--soft);
      }
      .sb-pchat-modal-user-row {
        display: flex; align-items: center; gap: 10px; padding: 8px 10px; width: 100%; background: none;
        border: none; border-bottom: 1.5px solid var(--mascot-outline); cursor: pointer; text-align: left;
        box-sizing: border-box;
      }
      .sb-pchat-modal-user-row:last-child { border-bottom: none; }
      .sb-pchat-modal-user-row:hover { background: var(--card); }
      .sb-pchat-modal-user-row.checked { background: var(--card); }
      .sb-pchat-modal-user-avatar { width: 28px; height: 28px; border-radius: 50%; overflow: hidden; flex-shrink: 0; }
      .sb-pchat-modal-user-name { flex: 1; font-size: 13px; font-weight: 700; color: var(--mascot-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sb-pchat-modal-check {
        width: 19px; height: 19px; border-radius: 50%; border: 2px solid var(--mascot-outline); flex-shrink: 0;
        display: flex; align-items: center; justify-content: center; color: #fff;
      }
      .sb-pchat-modal-check.on { background: var(--accent); border-color: var(--accent); }
      .sb-pchat-modal-hint { font-size: 11px; color: var(--muted); margin-top: 8px; }

      /* ---------- inline send/delete error inside chat window ---------- */
      .sb-pchat-chat-err {
        padding: 6px 16px; font-size: 12px; font-weight: 700; color: #C24444;
        background: #fef2f2; border-top: 1.5px solid #f9b0b0; flex-shrink: 0;
        animation: sb-shake .3s ease;
      }
      @keyframes sb-shake {
        0%,100%{ transform: translateX(0); }
        25%{ transform: translateX(-4px); }
        75%{ transform: translateX(4px); }
      }

      /* ---------- responsive: single pane with a back button on phones ---------- */
      @media (max-width: 768px) {
        .sb-pchat-wrap {
          height: min(90vh, 760px);
          height: min(90dvh, 760px);
          border-radius: 18px;
        }
        .sb-pchat-list-pane { width: 100%; border-right: none; }
        .sb-pchat-mobile-only { display: inline-flex !important; }

        .sb-pchat-page[data-pane="list"] .sb-pchat-chat-pane { display: none; }
        .sb-pchat-page[data-pane="chat"] .sb-pchat-list-pane { display: none; }
      }

      @media (min-width: 769px) {
        .sb-pchat-mobile-only { display: none !important; }
      }

      /* ---------- Dark Mode overrides for Private Chat ---------- */
      [data-dark="true"] .sb-pchat-shell {
        background: var(--card);
        border: 1px solid var(--border-subtle);
        box-shadow: var(--clay-raised);
      }
      [data-dark="true"] .sb-pchat-list-pane {
        background: var(--bg-secondary);
        border-right: 1px solid var(--border-subtle);
      }
      [data-dark="true"] .sb-pchat-channel-row.active {
        background: var(--card-hi);
        border-color: var(--border-hi);
        box-shadow: var(--clay-raised-sm);
      }
      [data-dark="true"] .sb-pchat-modal {
        background: var(--card-hi);
        border: 1px solid var(--border-hi);
        box-shadow: var(--clay-raised);
      }
      [data-dark="true"] .sb-pchat-modal-input,
      [data-dark="true"] .sb-pchat-modal-search {
        background: var(--surface-inset);
        color: var(--ink);
        border: 1px solid var(--border-hi);
        box-shadow: var(--clay-pressed);
      }
      [data-dark="true"] .sb-pchat-chat-err {
        background: rgba(255, 110, 108, 0.14);
        border-color: rgba(255, 110, 108, 0.36);
        color: #FF9492;
      }

    `}</style>
  );
}
