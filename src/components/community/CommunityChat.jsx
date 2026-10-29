import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Lock, BookOpen, Ban } from "lucide-react";
import { Card, SectionTitle, EmptyState } from "../ui";
import ChatMessage from "./ChatMessage";
import ChatComposer from "./ChatComposer";
import ChannelSelector from "./ChannelSelector";
import ChannelLockToggle from "./ChannelLockToggle";
import FocusLockToggle from "./FocusLockToggle";
import ChatBanManager from "./ChatBanManager";
import ConfirmDialog from "./private/ConfirmDialog";
import MessageInfoModal from "./MessageInfoModal";

// Same-sender messages within this window are visually grouped (avatar
// and name shown once, bubbles pulled tighter) instead of repeating the
// header on every line — this is what actually fixes "cramped" at
// higher message volume: it's not smaller text, it's less repeated
// chrome per message.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

// How close to the bottom (px) counts as "still anchored to the latest
// message" for auto-scroll purposes.
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

// Builds the render list: a date-separator entry whenever the calendar
// day changes, and `showMeta: false` on any message that immediately
// follows one from the same sender within GROUP_WINDOW_MS (a reply
// always keeps its own header, since it's referencing a different
// message and grouping it under someone else's name would be
// confusing).
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

export default function CommunityChat({
  channels, activeChannelId, onSelectChannel, setChannelLock, unreadChannelIds,
  messages, loading, sending, sendMessage, deleteMessage, hasMore, loadOlder, markChannelRead,
  currentUserId, myProfile, moderation, founderIds, memberIds, mascot, focusLock, chatBan,
}) {
  // NOTE: the old `isModerator` prop is gone — "can I delete this" is now
  // a per-author question (a mod may not delete a founder's message), so
  // it's answered per message via moderation.canDelete(authorId) at the
  // ChatMessage call site below.
  const [replyTo, setReplyTo] = useState(null); // { id, user_id, name, content } | null
  const [highlightedId, setHighlightedId] = useState(null);
  // Message the "seen by" popup is currently showing — the full message
  // object (not just an id) since MessageInfoModal needs its created_at
  // and content/image_url for the preview line, and holding it here means
  // the popup keeps showing that content even if the message list
  // reorders underneath it.
  const [infoMessage, setInfoMessage] = useState(null);
  // Pending delete now goes through a confirm step instead of firing the
  // instant the trash icon is tapped — mirrors private chat's
  // requestDelete/confirmDelete split (see PrivateChatWindow.jsx). Holds
  // just the id; ChatMessage still calls onDelete(id) exactly as before,
  // this only intercepts what that callback does with it.
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  // Personal self-lock — entirely separate from the founder-only channel
  // lock above (`setChannelLock`/`isChannelLocked` further down). See
  // supabase/migration_focus_lock.sql for why these are two independent
  // booleans that can be on/off in any combination, never one state.
  //
  // BUG FIX: this used to call useCommunityFocusLock() directly here,
  // which meant its eligible/locked state was tied to CommunityChat's
  // own mount lifetime. Since CommunityChat only exists in the tree
  // while the "chat" tab is active (see Community.jsx), leaving any
  // other tab (e.g. Study feed) and coming back unmounted and remounted
  // this hook every time — re-running its two network calls
  // (is_focus_lock_eligible RPC + community_focus_locks select) from
  // scratch before the banner could reflect the real state, which is
  // exactly the 1-2s lag on switching into this tab. Lifting the hook up
  // to Community.jsx (which stays mounted for as long as the whole
  // Community page is open, independent of which inner tab is active)
  // and passing its result down as a prop means the state persists
  // across tab switches, so it's already known the instant this tab
  // renders.
  // Belt-and-suspenders alongside the FK cascade in the migration (which
  // clears is_locked the instant eligibility is revoked): only ever treat
  // the lock as "in effect" while the user is BOTH still eligible AND
  // locked, so a stale/slow-to-refresh client can never stack up with a
  // DB-level edge case into someone being stuck on the banner with no
  // toggle left to undo it.
  const isFocusLocked = focusLock.eligible && focusLock.locked;
  // "Blocked from Community Chat" by the chat-ban admin (see
  // supabase/migration_chat_ban.sql). A fourth, independent state — not
  // Focus Lock, not the channel lock, not the personal per-user block.
  // Takes precedence over Focus Lock in what's rendered (a blocked user
  // sees the block banner, not "go study"); Focus Lock state itself is
  // left untouched and comes back as-is after an unblock.
  const isChatBanned = !!chatBan?.banned;
  // Pending block/unblock confirmation: { userId, name, banned } | null.
  const [pendingBan, setPendingBan] = useState(null);
  const [banError, setBanError] = useState(null);
  const listRef = useRef(null);
  const msgRefs = useRef({});
  const refCallbacks = useRef(new Map());
  const highlightTimeoutRef = useRef(null);

  // Whether the reader is currently anchored to the bottom of the list.
  // Kept up to date on scroll; read (not a dependency) whenever a new
  // message decides if it should pull the view down. Without this, a
  // message arriving while someone's scrolled up reading history yanks
  // them straight back to the bottom — exactly the kind of thing that
  // gets more disruptive, not less, the more people are chatting at once.
  const stickToBottomRef = useRef(true);

  // Set right before calling loadOlder() so the effect below can restore
  // the reader's scroll position instead of snapping to the bottom once
  // the older messages are prepended. Without this, "Load earlier
  // messages" immediately undoes itself: prepending grows messages.length,
  // which used to trigger scrollTop = scrollHeight every time.
  const pendingOlderLoadRef = useRef(null); // previous scrollHeight, or null

  // BUG FIX: id of a reply-jump target that wasn't in the currently
  // loaded page when scrollToMessage() was called. Only the most recent
  // PAGE_SIZE messages are loaded up front (see useCommunityChat) — so
  // tapping a reply quote that points further back than that "worked
  // sometimes" purely by luck of how much history happened to be loaded
  // already, and silently did nothing the rest of the time. The effect
  // below keeps calling loadOlder() while this is set, until the target
  // shows up in msgRefs (then it jumps) or hasMore runs out (then it
  // gives up — the message was deleted, or belongs to a blocked sender
  // filtered out of `visible`).
  const pendingJumpIdRef = useRef(null);

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

  // Sending your own message should always take you to the bottom, even
  // if you'd scrolled up to read older messages before replying.
  // imageFile is the optional File object from ChatComposer — forwarded
  // straight through to useCommunityChat's sendMessage which handles upload.
  const handleSendMessage = useCallback(
    async (text, reply, imageFile) => {
      const res = await sendMessage(text, reply, imageFile);
      if (res.ok) stickToBottomRef.current = true;
      // Server refused because I'm blocked but my client hadn't heard yet
      // (e.g. a missed realtime event) — re-read my state so the banner
      // appears instead of leaving a composer that can never send.
      else if (res.code === "chat_banned") chatBan?.refresh?.();
      return res;
    },
    [sendMessage, chatBan]
  );

  // While blocked the message list isn't mounted, so there is no scroll
  // position to preserve: make sure the list reopens anchored to the
  // latest message after an unblock (same remount issue as Focus Lock
  // below). Declared before the effect that consumes the flag.
  useLayoutEffect(() => {
    if (isChatBanned) stickToBottomRef.current = true;
  }, [isChatBanned]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (pendingOlderLoadRef.current != null) {
      el.scrollTop = el.scrollHeight - pendingOlderLoadRef.current;
      pendingOlderLoadRef.current = null;
      return;
    }
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    // BUG FIX: isFocusLocked added as a dependency. The message list
    // (.sb-chat-list, holding listRef) only exists in the DOM while
    // !isFocusLocked — it's swapped out for the sb-focus-locked-panel
    // entirely while locked (see the render below). Turning Focus Lock
    // off remounts that list fresh, with the browser default scrollTop
    // of 0 (top), but this effect previously only re-ran when `messages`
    // changed — and unlocking doesn't change `messages` at all, so the
    // freshly-mounted list stayed stuck at the top instead of jumping
    // back down to the latest message. Re-running this effect whenever
    // isFocusLocked flips (in the same layout-effect pass the list
    // remounts in, so listRef.current is already populated) re-applies
    // the normal stick-to-bottom behavior right away.
  }, [messages, isFocusLocked, isChatBanned]);

  useEffect(() => {
    // Fresh channel: always open anchored to the latest messages, and
    // drop everything scoped to the previous channel (stale refs would
    // otherwise point at DOM nodes for messages that no longer exist in
    // this list).
    stickToBottomRef.current = true;
    pendingOlderLoadRef.current = null;
    pendingJumpIdRef.current = null;
    msgRefs.current = {};
    refCallbacks.current = new Map();
    setReplyTo(null);
    setInfoMessage(null);
    setPendingDeleteId(null);
    setDeleteError(null);
    setPendingBan(null);
    setBanError(null);
  }, [activeChannelId]);

  useEffect(() => {
    return () => window.clearTimeout(highlightTimeoutRef.current);
  }, []);

  // Actually performs the scroll + highlight once the target is known to
  // be rendered. Split out so both the direct-hit path in scrollToMessage
  // and the "found it after loading more" path in the retry effect below
  // share the exact same behavior.
  //
  // BUG FIX (layout-dependent jump): this used to call el.scrollIntoView()
  // directly. scrollIntoView() walks *every* scrollable ancestor to bring
  // the target into view — not just .sb-chat-list. So whether the jump
  // "worked" also depended on where the Community Chat card itself
  // happened to sit in the surrounding page: if the card wasn't already
  // fully in view within .sb-main's own scroll (e.g. on a layout/breakpoint
  // where the card sits lower on the page, or the page was scrolled),
  // scrollIntoView would also drag the *outer page* scroll around trying
  // to satisfy block:"center", on top of (or sometimes instead of) the
  // inner list actually centering the message — a different, extra
  // failure mode from the pagination one already fixed. Computing the
  // scroll offset against our own list container via getBoundingClientRect
  // and calling container.scrollTo() keeps this 100% local to
  // .sb-chat-list, so it behaves identically no matter what page layout
  // or breakpoint it's sitting in.
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

  // useCallback with a stable identity so ChatMessage's React.memo isn't
  // defeated by a new function reference on every parent render.
  const scrollToMessage = useCallback((id) => {
    if (jumpToLoadedMessage(id)) return;
    // Not currently loaded — most likely an older message than the
    // current page covers. Keep paging back until it turns up, instead
    // of giving up on the first miss.
    if (hasMore) {
      pendingJumpIdRef.current = id;
      handleLoadOlder();
    }
  }, [jumpToLoadedMessage, hasMore, handleLoadOlder]);

  // Resolves a pending jump once loadOlder() brings in a fresh page:
  // if the target is now rendered, jump to it; if it's still missing and
  // there's more history, keep paging back; otherwise give up quietly.
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

  // Stable per-message ref callback. A fresh inline `(el) => {...}` on
  // every render made React re-invoke every message's ref callback (null,
  // then the node) any time the list re-rendered for an unrelated reason
  // — harmless, but unnecessary churn on every message whenever a new one
  // arrives. Caching one callback per id fixes that.
  const getRefCallback = useCallback((id) => {
    let fn = refCallbacks.current.get(id);
    if (!fn) {
      fn = (el) => { msgRefs.current[id] = el; };
      refCallbacks.current.set(id, fn);
    }
    return fn;
  }, []);

  const visible = useMemo(
    () => messages.filter((m) => !moderation.isBlocked(m.user_id)),
    [messages, moderation]
  );
  const renderItems = useMemo(() => buildRenderItems(visible), [visible]);

  // ChatMessage fires onDelete(id)/onShowInfo(message) the instant its
  // icon is tapped — requestDelete just intercepts what that does (same
  // split as PrivateChatWindow's requestDelete/confirmDelete) so a tap
  // opens a confirmation instead of deleting immediately.
  const requestDelete = useCallback((id) => {
    setDeleteError(null);
    setPendingDeleteId(id);
  }, []);
  const confirmDelete = useCallback(async () => {
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    if (!id) return;
    const res = await deleteMessage(id);
    setDeleteError(res.ok ? null : (res.error || "Couldn't delete that message."));
  }, [pendingDeleteId, deleteMessage]);

  // Block / unblock from a message's action row. Like delete, it goes
  // through a confirm step first — blocking silences someone, so it
  // should never fire from a stray tap.
  const requestBanToggle = useCallback((target) => {
    setBanError(null);
    setPendingBan(target);
  }, []);
  const confirmBanToggle = useCallback(async () => {
    const target = pendingBan;
    setPendingBan(null);
    if (!target || !chatBan) return;
    const res = await chatBan.setBan(target.userId, target.banned);
    setBanError(res.ok ? null : (res.error || "Couldn't update that. Try again."));
  }, [pendingBan, chatBan]);
  const handleBanFromList = useCallback((userId) => chatBan.setBan(userId, true), [chatBan]);
  const handleUnbanFromList = useCallback((userId) => chatBan.setBan(userId, false), [chatBan]);
  const isBanAdmin = !!chatBan?.isBanAdmin;

  // Passing `myProfile` itself down to every ChatMessage meant *any* field
  // on your own profile row changing (theme, streak-freeze tokens, none of
  // it chat-related) — see useDeviceRow's realtime UPDATE handler — handed
  // out a new object reference and defeated React.memo for the *entire*
  // visible list, not just your own messages, since memo does a shallow
  // compare across all props. Deriving primitives here means memo only
  // breaks when the name/mascot text actually changes.
  const myName = myProfile?.name || "You";
  const myMascotSpecies = myProfile?.mascot || "bunny";

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) || null,
    [channels, activeChannelId]
  );
  const isChannelLocked = !!activeChannel?.is_locked;

  // Stable identity so ChannelLockToggle's internal pending/error state
  // isn't reset by a fresh function reference on every parent render.
  const handleToggleLock = useCallback(
    (nextLocked) => setChannelLock(activeChannelId, nextLocked),
    [setChannelLock, activeChannelId]
  );

  // Mark the channel read whenever it's open and has messages on screen —
  // covers both "just switched into this channel" and "a new message
  // arrived while it's open". markChannelRead itself throttles the actual
  // network write (see useCommunityChat), so this firing on every message
  // list change is cheap, not a write per message.
  //
  // Skipped entirely while focus-locked (see "nor my seen by counts" in
  // the design note) — mark_channel_read() already no-ops server-side
  // for a locked user as defense in depth, but not calling it at all
  // client-side means it also never fires a network request in the
  // first place.
  useEffect(() => {
    // Also skipped while blocked: the chat isn't shown to them, so they
    // must not appear as having "seen" anything.
    if (!markChannelRead || isFocusLocked || isChatBanned || visible.length === 0) return;
    markChannelRead();
  }, [activeChannelId, visible.length, markChannelRead, isFocusLocked, isChatBanned]);

  return (
    <Card washi className="sb-community-chat">
      <SectionTitle
        icon={MessageCircle}
        right={
          (moderation.isChannelLockAdmin && activeChannel) || focusLock.eligible || isBanAdmin ? (
            <div className="sb-chat-header-switches">
              {isBanAdmin && (
                <ChatBanManager
                  bannedIds={chatBan.bannedIds}
                  onBan={handleBanFromList}
                  onUnban={handleUnbanFromList}
                  fetchDirectory={chatBan.fetchDirectory}
                  founderIds={founderIds}
                />
              )}
              {focusLock.eligible && (
                <FocusLockToggle locked={focusLock.locked} onToggle={focusLock.toggle} />
              )}
              {moderation.isChannelLockAdmin && activeChannel && (
                <ChannelLockToggle
                  key={activeChannel.id}
                  channelName={activeChannel.name}
                  locked={isChannelLocked}
                  onToggle={handleToggleLock}
                />
              )}
            </div>
          ) : null
        }
      >
        Community Chat
      </SectionTitle>

      {isChatBanned ? (
        // Blocked by the chat-ban admin: replaces the channel pills, the
        // message list AND the composer for THIS user only, and only
        // inside Community Chat — every other tab/page is untouched. No
        // toggle here on purpose; only the admin unblocking lifts it,
        // and the realtime update on their own row restores the chat
        // instantly (no reload needed).
        <div className="sb-chat-banned-panel" role="status">
          <Ban size={28} aria-hidden="true" />
          <p className="sb-chat-banned-title">You're blocked from Community Chat.</p>
          <p className="sb-chat-banned-sub">You can't read or send messages here for now. Everything else in StudyBun works as usual.</p>
        </div>
      ) : isFocusLocked ? (
        // Personal self-lock: replaces the channel pills, the message
        // list AND the composer, all at once — for THIS user only.
        // Nothing here touches `channels`, `messages`, `isChannelLocked`
        // or anyone else's view; flipping the switch above is the only
        // way out, same click either direction.
        <div className="sb-focus-locked-panel" role="status">
          <BookOpen size={28} aria-hidden="true" />
          <p className="sb-focus-locked-title">You closed this off.</p>
          <p className="sb-focus-locked-sub">Community Chat is hidden for you right now — go study. Flip the switch above whenever you're ready to come back.</p>
        </div>
      ) : (
        <>
          <ChannelSelector channels={channels} activeId={activeChannelId} onSelect={onSelectChannel} unreadIds={unreadChannelIds} />

          <div className="sb-chat-list" ref={listRef} onScroll={handleScroll}>
            {hasMore && (
              <button type="button" className="sb-chat-load-older" onClick={handleLoadOlder}>Load earlier messages</button>
            )}
            {loading ? (
              <div className="sb-muted small" style={{ padding: 8 }}>Loading...</div>
            ) : visible.length === 0 ? (
              <EmptyState mascot={mascot} mood="idle" text="Start the conversation." sub="What are you studying today?" />
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
                    canDelete={moderation.canDelete(item.message.user_id)}
                    founderIds={founderIds}
                    memberIds={memberIds}
                    onDelete={requestDelete}
                    onReply={setReplyTo}
                    onJumpToReply={scrollToMessage}
                    onShowInfo={setInfoMessage}
                    highlighted={highlightedId === item.message.id}
                    canBan={isBanAdmin && item.message.user_id !== currentUserId}
                    isAuthorBanned={isBanAdmin && chatBan.bannedIds.has(item.message.user_id)}
                    onToggleBan={isBanAdmin ? requestBanToggle : undefined}
                  />
                )
              )
            )}
          </div>

          {deleteError && <div className="sb-chat-delete-err">{deleteError}</div>}
          {banError && <div className="sb-chat-delete-err">{banError}</div>}

          {isChannelLocked ? (
            // Replaces the composer entirely — for EVERYONE, including the
            // person who closed it. No half-measures like a disabled input;
            // a closed channel shouldn't even look like typing is an option.
            <div className="sb-channel-closed-banner" role="status">
              <Lock size={16} aria-hidden="true" />
              <span>This channel is closed right now — no new messages.</span>
            </div>
          ) : (
            <ChatComposer
              channelId={activeChannelId}
              replyTo={replyTo}
              onCancelReply={cancelReply}
              sendMessage={handleSendMessage}
              sending={sending}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDeleteId != null}
        title="Delete this message?"
        body="This can't be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />

      <ConfirmDialog
        open={pendingBan != null}
        title={pendingBan?.banned ? `Block ${pendingBan?.name || "this user"} from Community Chat?` : `Unblock ${pendingBan?.name || "this user"}?`}
        body={pendingBan?.banned
          ? "They'll see a banner instead of the chat and can't send messages until you unblock them. Nothing else in the app is affected."
          : "They'll get Community Chat back right away."}
        confirmLabel={pendingBan?.banned ? "Block" : "Unblock"}
        danger={!!pendingBan?.banned}
        onConfirm={confirmBanToggle}
        onCancel={() => setPendingBan(null)}
      />

      <MessageInfoModal
        open={!!infoMessage}
        channelId={activeChannelId}
        message={infoMessage}
        onClose={() => setInfoMessage(null)}
      />
    </Card>
  );
}
