import React, { useCallback, useState } from "react";
import { X } from "lucide-react";
import { usePrivateChannels } from "../../../hooks/usePrivateChannels";
import { usePrivateChat } from "../../../hooks/usePrivateChat";
import PrivateChannelList from "./PrivateChannelList";
import PrivateChatWindow from "./PrivateChatWindow";
import PrivateChannelModal from "./PrivateChannelModal";
import ConfirmDialog from "./ConfirmDialog";

// Tiny one-off rename dialog — just a text field + confirm, not worth its
// own file. Shares the same .sb-pt-overlay/.sb-pt-dialog shell as
// ConfirmDialog/PrivateChannelModal for visual consistency.
function RenameDialog({ open, initialName, onSubmit, onClose }) {
  const [value, setValue] = useState(initialName || "");
  const [submitting, setSubmitting] = useState(false);
  // BUG FIX: `value` was initialised from useState(initialName) which only
  // runs once. If the channel was already renamed once and the dialog is
  // reopened, the input kept the old name. The useEffect below syncs `value`
  // whenever `open` flips to true or `initialName` changes, covering both
  // the first-open and re-open cases.
  React.useEffect(() => { if (open) setValue(initialName || ""); }, [open, initialName]);
  if (!open) return null;
  const submit = async () => {
    if (!value.trim() || submitting) return;
    setSubmitting(true);
    await onSubmit(value.trim());
    setSubmitting(false);
  };
  return (
    <div className="sb-pt-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sb-pt-dialog sb-pchat-modal" role="dialog" aria-modal="true" aria-label="Rename channel">
        <button className="sb-pt-dialog-close" title="Close" aria-label="Close" onClick={onClose}><X size={15} /></button>
        <h3 className="sb-pchat-confirm-title">Rename channel</h3>
        <input
          type="text"
          className="sb-pchat-modal-input"
          maxLength={60}
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        <div className="sb-pchat-confirm-btns">
          <button type="button" className="sb-btn sb-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="sb-btn sb-btn-primary" disabled={!value.trim() || submitting} onClick={submit}>
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Full-screen Private Chats page. Opened from Community.jsx's nav the same
 * way StudyStuffs swaps its whole page for a tool's detail view (see
 * StudyStuffs.jsx) — this replaces Community's entire shell (hero + side
 * nav + tab content), not just the content-area card, so the two-pane chat
 * layout gets the full viewport to work with instead of being squeezed
 * into a settings-style card. */
export default function PrivateChatPage({ currentUserId, myProfile, isFounder, founderIds, moderation, mascot, onExit }) {
  const {
    channels, activeChannelId, setActiveChannelId, loading,
    createChannel, renameChannel, deleteChannel, addMembers, removeMember, leaveChannel, fetchDirectory,
  } = usePrivateChannels();
  const chat = usePrivateChat(activeChannelId);

  const [mobileShowingChat, setMobileShowingChat] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDeleteChannel, setConfirmDeleteChannel] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Toast error for page-level operation failures (rename, delete channel,
  // add members, leave) — these happen outside the chat window and need
  // a visible error path that isn't buried in a now-closed modal.
  const [pageErr, setPageErr] = useState(null);
  const pageErrTimerRef = React.useRef(null);

  const showPageErr = useCallback((msg) => {
    setPageErr(msg);
    window.clearTimeout(pageErrTimerRef.current);
    pageErrTimerRef.current = window.setTimeout(() => setPageErr(null), 5000);
  }, []);

  React.useEffect(() => () => window.clearTimeout(pageErrTimerRef.current), []);

  const activeChannel = channels.find((c) => c.id === activeChannelId) || null;

  // First-load convenience: land on a channel if the user has exactly one
  // or more, same "auto-pick the first one" courtesy useCommunityChannels
  // already gives the fixed system channels. Never flips the mobile pane
  // itself — on a phone this still opens on the list, same as WhatsApp.
  React.useEffect(() => {
    if (!activeChannelId && channels.length > 0) setActiveChannelId(channels[0].id);
  }, [channels, activeChannelId, setActiveChannelId]);

  const handleSelectChannel = useCallback((id) => {
    setActiveChannelId(id);
    setMobileShowingChat(true);
  }, [setActiveChannelId]);

  const handleBackToList = useCallback(() => setMobileShowingChat(false), []);

  const handleCreateSubmit = useCallback(async (name, memberIds) => {
    const res = await createChannel(name, memberIds);
    if (res.ok) {
      setCreateOpen(false);
      setActiveChannelId(res.data.id);
      setMobileShowingChat(true);
    } else if (res.error) {
      // Don't close the modal on failure — the user may want to retry.
      // The modal will show the error via its own state if needed, but
      // for channel-creation failures we surface it at page level since
      // the modal has no inline error region.
      showPageErr(res.error);
    }
    return res;
  }, [createChannel, setActiveChannelId, showPageErr]);

  const handleAddMembersSubmit = useCallback(async (_name, memberIds) => {
    const res = await addMembers(activeChannelId, memberIds);
    if (res.ok) {
      setAddMembersOpen(false);
    } else if (res.error) {
      showPageErr(res.error);
    }
    return res;
  }, [addMembers, activeChannelId, showPageErr]);

  const handleRenameSubmit = useCallback(async (newName) => {
    const res = await renameChannel(activeChannelId, newName);
    if (res.ok) {
      setRenameOpen(false);
    } else if (res.error) {
      // Keep the dialog open so the user can try a different name.
      showPageErr(res.error);
    }
    return res;
  }, [renameChannel, activeChannelId, showPageErr]);

  // BUG FIX: the original handleConfirmDeleteChannel swallowed the result
  // of deleteChannel entirely — if Supabase returned an error (e.g. RLS
  // blocked it, network failure) the channel stayed in the list but the
  // confirm dialog was already closed, so the user had no feedback and no
  // way to retry. Now we check the result and show a page-level error if
  // it failed, and only clear the active pane on success.
  const handleConfirmDeleteChannel = useCallback(async () => {
    setConfirmDeleteChannel(false);
    const res = await deleteChannel(activeChannelId);
    if (res.ok) {
      setMobileShowingChat(false);
    } else {
      showPageErr(res.error || "Couldn't delete that group. Try again.");
    }
  }, [deleteChannel, activeChannelId, showPageErr]);

  const handleConfirmLeave = useCallback(async () => {
    setConfirmLeave(false);
    const res = await leaveChannel(activeChannelId);
    if (res.ok) {
      setMobileShowingChat(false);
    } else {
      showPageErr(res.error || "Couldn't leave that group. Try again.");
    }
  }, [leaveChannel, activeChannelId, showPageErr]);

  return (
    <div className="sb-pchat-page" data-pane={mobileShowingChat ? "chat" : "list"}>
      {/* Page-level error toast (rename/delete/leave/add-members failures) */}
      {pageErr && (
        <div
          className="sb-pchat-chat-err"
          style={{ borderRadius: 12, margin: "0 0 8px", borderTop: "none", border: "2px solid #f9b0b0" }}
        >
          {pageErr}
          <button
            type="button"
            style={{ marginLeft: 10, background: "none", border: "none", cursor: "pointer", color: "#C24444", fontWeight: 800 }}
            onClick={() => setPageErr(null)}
            aria-label="Dismiss"
          >✕</button>
        </div>
      )}

      <div className="sb-pchat-wrap">
        <PrivateChannelList
          channels={channels}
          activeChannelId={activeChannelId}
          onSelectChannel={handleSelectChannel}
          isFounder={isFounder}
          currentUserId={currentUserId}
          onOpenCreate={() => setCreateOpen(true)}
          onExit={onExit}
          loading={loading}
          mascot={mascot}
        />
        <PrivateChatWindow
          channel={activeChannel}
          messages={chat.messages}
          loading={chat.loading}
          sending={chat.sending}
          sendMessage={chat.sendMessage}
          deleteMessage={chat.deleteMessage}
          hasMore={chat.hasMore}
          loadOlder={chat.loadOlder}
          currentUserId={currentUserId}
          myProfile={myProfile}
          isFounder={isFounder}
          founderIds={founderIds}
          canDeleteMessage={moderation?.canDelete}
          mascot={mascot}
          onBack={handleBackToList}
          onRequestAddMembers={() => setAddMembersOpen(true)}
          onRequestRename={() => setRenameOpen(true)}
          onRequestDeleteChannel={() => setConfirmDeleteChannel(true)}
          onRequestLeaveChannel={() => setConfirmLeave(true)}
        />
      </div>

      <PrivateChannelModal
        open={createOpen}
        mode="create"
        existingMemberIds={new Set()}
        fetchDirectory={fetchDirectory}
        onSubmit={handleCreateSubmit}
        onClose={() => setCreateOpen(false)}
      />

      <PrivateChannelModal
        open={addMembersOpen}
        mode="addMembers"
        // BUG FIX: activeChannel?.memberIds is a Set (or undefined if the
        // channel is somehow null). `|| new Set()` is correct here but only
        // if memberIds was built as a Set — which it is in usePrivateChannels
        // (see `new Set(members.map(...))`). Safe.
        existingMemberIds={activeChannel?.memberIds || new Set()}
        fetchDirectory={fetchDirectory}
        onSubmit={handleAddMembersSubmit}
        onClose={() => setAddMembersOpen(false)}
      />

      <RenameDialog
        open={renameOpen}
        initialName={activeChannel?.name}
        onSubmit={handleRenameSubmit}
        onClose={() => setRenameOpen(false)}
      />

      <ConfirmDialog
        open={confirmDeleteChannel}
        title="Delete this group?"
        body="This removes it and every message in it for everyone. This can't be undone."
        confirmLabel="Delete group"
        onConfirm={handleConfirmDeleteChannel}
        onCancel={() => setConfirmDeleteChannel(false)}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Leave this group?"
        body="You'll stop seeing new messages unless a founder adds you back."
        confirmLabel="Leave"
        onConfirm={handleConfirmLeave}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
