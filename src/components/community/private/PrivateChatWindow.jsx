import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MoreVertical, UserPlus, Pencil, Trash2, LogOut } from "lucide-react";
import ChatMessage from "../ChatMessage";
import ChatComposer from "../ChatComposer";
import ConfirmDialog from "./ConfirmDialog";
import { EmptyState } from "../../ui";

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const STICK_TO_BOTTOM_THRESHOLD_PX = 80;

function dateLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

// Same grouping logic as CommunityChat.jsx's buildRenderItems — kept as a
// local copy rather than a shared import since the two lists otherwise
// have no shared dependency and community chat's file is deliberately
// left untouched by this feature.
function buildRenderItems(messages) {
  const items = [];
  let lastDay = null;
  let prev = null;
  for (const m of messages) {
    const day = new Date(m.created_at).toDateString();
    if (day !== lastDay) {
      items.push({ kind: "date", key: `date-${day}`, label: dateLabel(m.created_at) });
      lastDay = day;
      prev = null;
    }
    const sameSender = prev && prev.user_id === m.user_id;
    const withinWindow = prev && (new Date(m.created_at) - new Date(prev.created_at)) < GROUP_WINDOW_MS;
    const showMeta = !(sameSender && withinWindow && !m.reply_to_name);
    items.push({ kind: "msg", key: m.id, message: m, showMeta });
    prev = m;
  }
  return items;
}

export default function PrivateChatWindow({
  channel, messages, loading, sending, sendMessage, deleteMessage, hasMore, loadOlder,
  currentUserId, myProfile, isFounder, founderIds, canDeleteMessage, mascot, onBack,
  onRequestAddMembers, onRequestRename, onRequestDeleteChannel, onRequestLeaveChannel,
}) {
  const [replyTo, setReplyTo] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  // BUG FIX: expose inline errors from sendMessage and deleteMessage so the
  // user gets feedback when something goes wrong (rate limit, upload failure,
  // etc.). Previously the results were silently discarded — ChatComposer
  // already shows its own error for send failures, but deleteMessage failures
  // had zero user feedback.
  const [chatErr, setChatErr] = useState(null);
  const listRef = useRef(null);
  const msgRefs = useRef({});
  const refCallbacks = useRef(new Map());
  const highlightTimeoutRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const pendingOlderLoadRef = useRef(null);
  // BUG FIX: same fix as CommunityChat.jsx's scrollToMessage — only the
  // most recent PAGE_SIZE messages are loaded up front (see usePrivateChat),
  // so tapping a reply quote pointing further back than that "worked
  // sometimes" depending on how much history happened to already be
  // loaded, and did nothing the rest of the time. This holds the target
  // id while the retry effect below keeps paging back via loadOlder()
  // until it's found (or hasMore runs out).
  const pendingJumpIdRef = useRef(null);
  // Auto-dismiss inline error after a few seconds
  const chatErrTimerRef = useRef(null);

  const showChatErr = useCallback((msg) => {
    setChatErr(msg);
    window.clearTimeout(chatErrTimerRef.current);
    chatErrTimerRef.current = window.setTimeout(() => setChatErr(null), 4000);
  }, []);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < STICK_TO_BOTTOM_THRESHOLD_PX;
  }, []);

  const handleLoadOlder = useCallback(() => {
    const el = listRef.current;
    pendingOlderLoadRef.current = el ? el.scrollHeight : null;
    loadOlder();
  }, [loadOlder]);

  const handleSendMessage = useCallback(
    async (text, reply, imageFile) => {
      const res = await sendMessage(text, reply, imageFile);
      if (res.ok) stickToBottomRef.current = true;
      // ChatComposer already displays res.error inline for send failures,
      // so we don't double-show it here — just return the result so the
      // composer can clear its draft on success.
      return res;
    },
    [sendMessage]
  );

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (pendingOlderLoadRef.current != null) {
      el.scrollTop = el.scrollHeight - pendingOlderLoadRef.current;
      pendingOlderLoadRef.current = null;
      return;
    }
    if (stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    stickToBottomRef.current = true;
    pendingOlderLoadRef.current = null;
    pendingJumpIdRef.current = null;
    msgRefs.current = {};
    refCallbacks.current = new Map();
    setReplyTo(null);
    setMenuOpen(false);
    setChatErr(null);
    window.clearTimeout(chatErrTimerRef.current);
  }, [channel?.id]);

  useEffect(() => () => {
    window.clearTimeout(highlightTimeoutRef.current);
    window.clearTimeout(chatErrTimerRef.current);
  }, []);

  // Actually performs the scroll + highlight once the target is known to
  // be rendered — shared by the direct-hit path below and the "found it
  // after loading more" retry effect.
  //
  // BUG FIX (layout-dependent jump): same fix as CommunityChat.jsx —
  // el.scrollIntoView() walks every scrollable ancestor, not just
  // .sb-pchat-msg-list, so whether the jump actually landed on the
  // message also depended on the surrounding page layout (mobile single-
  // pane vs desktop two-pane, how far the page itself was scrolled,
  // etc). Computing the offset against our own list container and
  // scrolling just that container keeps it fully local to the chat pane
  // regardless of layout/breakpoint.
  const jumpToLoadedMessage = useCallback((id) => {
    const el = msgRefs.current[id];
    const container = listRef.current;
    if (!el || !container) return false;
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offsetWithinContainer = elRect.top - containerRect.top + container.scrollTop;
    const target = offsetWithinContainer - container.clientHeight / 2 + el.clientHeight / 2;
    const maxScroll = container.scrollHeight - container.clientHeight;
    container.scrollTo({ top: Math.max(0, Math.min(target, maxScroll)), behavior: "smooth" });
    setHighlightedId(id);
    window.clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = window.setTimeout(() => setHighlightedId(null), 1200);
    return true;
  }, []);

  const scrollToMessage = useCallback((id) => {
    if (jumpToLoadedMessage(id)) return;
    // Not currently loaded — most likely an older message than the
    // current page covers. Keep paging back until it turns up.
    if (hasMore) {
      pendingJumpIdRef.current = id;
      handleLoadOlder();
    }
  }, [jumpToLoadedMessage, hasMore, handleLoadOlder]);

  // Resolves a pending jump once loadOlder() brings in a fresh page: if
  // the target is now rendered, jump to it; if it's still missing and
  // there's more history, keep paging back; otherwise give up quietly
  // (message was deleted, or this thread simply doesn't have it).
  useEffect(() => {
    const id = pendingJumpIdRef.current;
    if (!id) return;
    if (jumpToLoadedMessage(id)) {
      pendingJumpIdRef.current = null;
    } else if (hasMore) {
      handleLoadOlder();
    } else {
      pendingJumpIdRef.current = null;
    }
  }, [messages, hasMore, handleLoadOlder, jumpToLoadedMessage]);

  const cancelReply = useCallback(() => setReplyTo(null), []);

  const getRefCallback = useCallback((id) => {
    let fn = refCallbacks.current.get(id);
    if (!fn) {
      fn = (el) => { msgRefs.current[id] = el; };
      refCallbacks.current.set(id, fn);
    }
    return fn;
  }, []);

  // A moderator may clear out other people's messages in a channel they
  // were added to — but never a founder's, and never in a channel they
  // aren't a member of (they can't even see those; RLS hides them).
  // canDeleteMessage answers all of that per author. Falls back to the
  // founder flag if the prop is missing, so this component still works
  // standalone.
  const resolveCanDelete = useCallback(
    (authorId) => (canDeleteMessage ? canDeleteMessage(authorId) : isFounder),
    [canDeleteMessage, isFounder]
  );

  const renderItems = useMemo(() => buildRenderItems(messages), [messages]);
  const myName = myProfile?.name || "You";
  const myMascotSpecies = myProfile?.mascot || "bunny";

  // ChatMessage fires onDelete the instant its own trash icon is tapped —
  // that's fine in Community Chat (no confirm there today) but private
  // chat should ask first, same as Study Feed. Intercepting here means
  // ChatMessage.jsx itself needs zero changes: it still just calls
  // onDelete(id), we just don't let that be the real delete.
  const requestDelete = useCallback((id) => setPendingDeleteId(id), []);
  const confirmDelete = useCallback(async () => {
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    if (!id) return;
    const res = await deleteMessage(id);
    // BUG FIX: surface delete errors — previously deleteMessage result was
    // silently dropped, so a Supabase error (network, RLS) gave zero feedback.
    if (!res.ok) showChatErr(res.error || "Couldn't delete that message.");
  }, [pendingDeleteId, deleteMessage, showChatErr]);

  if (!channel) {
    return (
      <div className="sb-pchat-chat-pane sb-pchat-no-active">
        <div className="sb-pchat-no-active-inner">
          <EmptyState
            mascot={mascot}
            mood="idle"
            text="Select a chat to start messaging"
            sub="Or create a new channel to get going."
          />
        </div>
      </div>
    );
  }

  const membersLabel = channel.members.map((m) => (m.user_id === currentUserId ? "You" : m.name)).join(", ");

  return (
    <div className="sb-pchat-chat-pane">
      <div className="sb-pchat-chat-header">
        {/* Hidden on desktop via CSS (@media min-width), not a JS check —
            keeps this component agnostic of viewport size. */}
        <button type="button" className="sb-pchat-back-btn sb-pchat-mobile-only" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="sb-pchat-chat-title-wrap">
          <div className="sb-pchat-chat-title">{channel.name}</div>
          <div className="sb-pchat-chat-sub">{membersLabel}</div>
        </div>
        <div className="sb-pchat-kebab-wrap">
          <button type="button" className="sb-pchat-kebab-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Channel options">
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <>
              <div className="sb-cm-actions-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="sb-pchat-kebab-menu" role="menu">
                {isFounder && (
                  <button type="button" onClick={() => { setMenuOpen(false); onRequestAddMembers(); }}>
                    <UserPlus size={13} /> Add members
                  </button>
                )}
                {isFounder && (
                  <button type="button" onClick={() => { setMenuOpen(false); onRequestRename(); }}>
                    <Pencil size={13} /> Rename channel
                  </button>
                )}
                {isFounder ? (
                  <button type="button" className="danger" onClick={() => { setMenuOpen(false); onRequestDeleteChannel(); }}>
                    <Trash2 size={13} /> Delete group
                  </button>
                ) : (
                  <button type="button" className="danger" onClick={() => { setMenuOpen(false); onRequestLeaveChannel(); }}>
                    <LogOut size={13} /> Leave group
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="sb-pchat-msg-list" ref={listRef} onScroll={handleScroll}>
        {hasMore && (
          <button type="button" className="sb-chat-load-older" onClick={handleLoadOlder}>Load earlier messages</button>
        )}
        {loading ? (
          <p className="sb-muted small" style={{ padding: 8 }}>Loading...</p>
        ) : messages.length === 0 ? (
          <div className="sb-pchat-empty-thread">Start the conversation. What are you studying today?</div>
        ) : (
          renderItems.map((item) =>
            item.kind === "date" ? (
              <div key={item.key} className="sb-chat-date-sep"><span>{item.label}</span></div>
            ) : (
              <ChatMessage
                key={item.key}
                ref={getRefCallback(item.message.id)}
                message={item.message}
                showMeta={item.showMeta}
                isOwn={item.message.user_id === currentUserId}
                myName={myName}
                myMascotSpecies={myMascotSpecies}
                canDelete={resolveCanDelete(item.message.user_id)}
                founderIds={founderIds}
                memberIds={undefined}
                onDelete={requestDelete}
                onReply={setReplyTo}
                onJumpToReply={scrollToMessage}
                highlighted={highlightedId === item.message.id}
              />
            )
          )
        )}
      </div>

      {/* BUG FIX: inline error bar for delete failures (send failures are
          handled inside ChatComposer already). Shown between the message
          list and the composer so it doesn't push the list content. */}
      {chatErr && <div className="sb-pchat-chat-err">{chatErr}</div>}

      <ChatComposer
        channelId={channel.id}
        replyTo={replyTo}
        onCancelReply={cancelReply}
        sendMessage={handleSendMessage}
        sending={sending}
        placeholder={`Message ${channel.name}...`}
        expiryNote={null}
      />

      <ConfirmDialog
        open={pendingDeleteId != null}
        title="Delete this message?"
        body="This can't be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
