import React, { useState } from "react";
import CommunityStyle from "../styles/CommunityStyle";
import PrivateChatStyle from "../styles/PrivateChatStyle";
import CommunityHeader from "../components/community/CommunityHeader";
import AccountabilityCard from "../components/community/AccountabilityCard";
import CheckInsList from "../components/community/CheckInsList";
import CommunityChat from "../components/community/CommunityChat";
import CommunityFeed from "../components/community/CommunityFeed";
import PrivateChatPage from "../components/community/private/PrivateChatPage";
import { useCommunityChannels } from "../hooks/useCommunityChannels";
import { useCommunityChat } from "../hooks/useCommunityChat";
import { useChannelUnread } from "../hooks/useChannelUnread";
import { useAccountability } from "../hooks/useAccountability";
import { useCommunityFeed } from "../hooks/useCommunityFeed";
import { useCommunityModeration } from "../hooks/useCommunityModeration";
import { useFounderIds } from "../hooks/useFounderIds";
import { useStreakMemberIds } from "../hooks/useStreakMemberIds";
import { usePrivateChatAccess } from "../hooks/usePrivateChatAccess";
import { useCommunityFocusLock } from "../hooks/useCommunityFocusLock";
import { useCommunityChatBan } from "../hooks/useCommunityChatBan";

// Same tab shape as Settings' TABS — each card that used to be stacked on
// one long page now lives behind its own side-nav entry, so only one card
// (and its own scroll/space budget) is on screen at a time.
const BASE_TABS = [
  { id: "checkins", emoji: "✅", label: "Check-ins", sub: "Who's studying now" },
  { id: "accountability", emoji: "🎯", label: "My accountability", sub: "Set & track today's goal" },
  { id: "chat", emoji: "💬", label: "Community chat", sub: "Talk with your group" },
  { id: "feed", emoji: "📰", label: "Study feed", sub: "Posts & updates" },
];
const PRIVATE_TAB = { id: "private", emoji: "🔒", label: "Private Chats", sub: "Just for your group" };

export default function CommunityPage(p) {
  const { channels, activeChannelId, setActiveChannelId, setChannelLock } = useCommunityChannels();
  const chat = useCommunityChat(activeChannelId);
  const accountability = useAccountability();
  const feed = useCommunityFeed();
  const moderation = useCommunityModeration();
  const founderIds = useFounderIds();
  const memberIds = useStreakMemberIds();
  const privateAccess = usePrivateChatAccess();
  // BUG FIX: lifted up from CommunityChat, which used to call this hook
  // itself. CommunityChat only mounts while the "chat" tab is active, so
  // its eligible/locked state was being lost and re-fetched from scratch
  // (two network calls) every time someone left and came back to this
  // tab — the source of the 1-2s lag before the focus-lock banner could
  // show. This page-level component stays mounted for the whole time the
  // Community page is open, regardless of which inner tab is selected,
  // so calling it here means the state is already known by the time the
  // chat tab renders.
  const focusLock = useCommunityFocusLock();
  // "Blocked from Community Chat" (single-founder moderation) — lifted here
  // for the same reason as focusLock above: stays mounted across inner-tab
  // switches so the banner state is known the instant the chat tab renders.
  const chatBan = useCommunityChatBan();
  const [tab, setTab] = useState("checkins");

  // Red ring on channel pills that have messages from others the user
  // hasn't seen. Lives here (not in CommunityChat) for the same reason as
  // focusLock/chatBan above: CommunityChat unmounts whenever another inner
  // tab is open, but new messages keep arriving — this page-level hook
  // keeps listening the whole time. `viewing` is true only while the chat
  // is genuinely on screen (not blocked, not self-locked).
  const chatVisibleToMe = tab === "chat" && !chatBan?.banned && !(focusLock.eligible && focusLock.locked);
  const unreadChannelIds = useChannelUnread({
    channels,
    activeChannelId,
    userId: p.userId,
    enabled: !chatBan?.banned,
    viewing: chatVisibleToMe,
  });

  // BUG FIX: this used to be `moderation.isModerator`, which was correct
  // only while founder was the sole role that satisfied is_moderator().
  // With the ⚡ Mod role live, that would have handed every moderator the
  // founder-only private-chat powers (create/rename/delete a group, add
  // members, see every private channel). isAdmin is the real "founder or
  // admin" answer — same set of people as before, now actually named.
  const isFounder = moderation.isAdmin;
  // Founders always see the entry; everyone else only once a founder has
  // actually added them to at least one private channel — mirrors the
  // "invisible until you're invited" behavior from the prototype.
  const showPrivateTab = isFounder || privateAccess.hasMembership;
  const TABS = showPrivateTab ? [...BASE_TABS, PRIVATE_TAB] : BASE_TABS;

  const studyingIds = p.studyingIds || new Set();
  // activeGoals is already grouped one-entry-per-person, so its length is
  // a distinct-person count on its own (a person with several goals today
  // still only counts once here).
  const checkedInToday = accountability.activeGoals.length + (accountability.myGoals.length > 0 ? 1 : 0);

  // Private Chats replaces the ENTIRE community page (hero + side nav +
  // card), not just the sb-settings-content card — same "swap the whole
  // page for a full-bleed detail view" pattern StudyStuffs uses for the
  // Periodic Table and its other tools. A two-pane WhatsApp-style layout
  // needs the full viewport; squeezing it into the settings-card shell
  // (like the other four tabs) would leave it cramped on anything but a
  // wide desktop window.
  if (tab === "private") {
    return (
      // BUG FIX: removed the second <PrivateChatStyle /> that was injected
      // here in addition to the one in the normal community branch below.
      // Both branches render their own <PrivateChatStyle />, which is
      // correct — the two branches are mutually exclusive (only one ever
      // mounts at a time) — so each branch needs its own injection.
      // The bug was the NORMAL branch having TWO <PrivateChatStyle /> calls
      // (one right after <CommunityStyle /> and one more for no reason), not
      // this private branch having one. Fixed in the normal branch below.
      <div className="sb-page sb-page-private-chat">
        {/* BUG FIX: this branch is a completely separate return tree from the
            normal community shell below — it doesn't just skip re-rendering
            CommunityStyle, it never mounts it at all. PrivateChatWindow reuses
            ChatMessage/ChatComposer verbatim (message bubbles, composer pill,
            reply bar, image preview strip, attach button, date separators,
            the action-menu backdrop, error text) and every one of those
            classNames is only defined inside CommunityStyle.jsx — PrivateChatStyle
            deliberately doesn't redefine them (see its header comment). With
            only <PrivateChatStyle /> mounted here, all of that came out as
            unstyled browser-default markup: a plain rectangular textarea and
            send button, borderless message bubbles, an invisible reply bar —
            which is exactly what "private chat UI is not working" looks like
            even though every click handler underneath was firing correctly.
            Mounting CommunityStyle alongside PrivateChatStyle here (both are
            plain <style> tags, safe to have both mounted at once) restores
            every shared class this page depends on. */}
        <CommunityStyle />
        <PrivateChatStyle />
        <PrivateChatPage
          currentUserId={p.userId}
          myProfile={p.profile}
          isFounder={isFounder}
          founderIds={founderIds}
          moderation={moderation}
          mascot={p.mascot}
          onExit={() => setTab("feed")}
        />
      </div>
    );
  }

  return (
    <div className="sb-page sb-community-page">
      <CommunityStyle />
      {/* BUG FIX: was rendering <PrivateChatStyle /> twice in this branch —
          once here and once more at the end of the return, without reason.
          One injection is enough; the style tag is idempotent in the DOM
          but two identical <style> elements are wasteful and confusing.
          The private-tab branch above has its own <PrivateChatStyle />, so
          both paths are covered with exactly one injection each. */}
      <PrivateChatStyle />
      <CommunityHeader activeNowCount={studyingIds.size} checkedInTodayCount={checkedInToday} />

      {/* Reuses the exact settings-page shell/nav classes from GlobalStyle so
          the community page behaves and looks like Settings: a sticky side
          toggle on the left, one card in view on the right. */}
      <div className="sb-settings-shell sb-community-shell">
        <nav className="sb-settings-nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`sb-settings-nav-item ${tab === t.id ? "active" : ""} ${t.id === "private" ? "sb-private-nav-item" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="sb-settings-nav-icon">{t.emoji}</span>
              <span className="sb-settings-nav-text">
                <span className="sb-settings-nav-label">{t.label}</span>
                <span className="sb-settings-nav-sub">{t.sub}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="sb-settings-content sb-community-content" key={tab}>
          {tab === "checkins" && (
            <CheckInsList goals={accountability.activeGoals} mascot={p.mascot} />
          )}

          {tab === "accountability" && (
            <AccountabilityCard
              myGoals={accountability.myGoals}
              weekly={accountability.weekly}
              addGoal={accountability.addGoal}
              updateStatus={accountability.updateStatus}
              deleteGoal={accountability.deleteGoal}
              history={accountability.history}
              historyLoading={accountability.historyLoading}
              historyLoaded={accountability.historyLoaded}
              historyError={accountability.historyError}
              loadHistory={accountability.loadHistory}
              mascot={p.mascot}
            />
          )}

          {tab === "chat" && (
            <CommunityChat
              channels={channels}
              activeChannelId={activeChannelId}
              onSelectChannel={setActiveChannelId}
              setChannelLock={setChannelLock}
              unreadChannelIds={unreadChannelIds}
              messages={chat.messages}
              loading={chat.loading}
              sending={chat.sending}
              sendMessage={chat.sendMessage}
              deleteMessage={chat.deleteMessage}
              hasMore={chat.hasMore}
              loadOlder={chat.loadOlder}
              markChannelRead={chat.markChannelRead}
              currentUserId={p.userId}
              myProfile={p.profile}
              moderation={moderation}
              founderIds={founderIds}
              memberIds={memberIds}
              mascot={p.mascot}
              focusLock={focusLock}
              chatBan={chatBan}
            />
          )}

          {tab === "feed" && (
            <CommunityFeed
              feed={feed}
              currentUserId={p.userId}
              myProfile={p.profile}
              moderation={moderation}
              founderIds={founderIds}
              memberIds={memberIds}
              mascot={p.mascot}
            />
          )}
        </div>
      </div>
    </div>
  );
}
