import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { useRoleIds } from "./useRoleIds";

/** Reporting content and blocking users. Reporter identity is never shown
 * to anyone but the reporter and moderators — enforced by RLS, not just
 * by what the UI chooses to display. */
export function useCommunityModeration() {
  const { user } = useAuth();
  const userId = user?.id;
  const [blockedIds, setBlockedIds] = useState(new Set());
  const [isModerator, setIsModerator] = useState(false);
  // "Outranks a moderator" — true for admin and founder, false for a
  // plain moderator. is_moderator() is deliberately the broad check
  // (anyone with delete power at all), so it can't answer this on its
  // own; see supabase/migration_moderator_role.sql.
  const [isAdmin, setIsAdmin] = useState(false);
  // Not the same thing as isAdmin/founder — see
  // supabase/migration_channel_lock.sql. There are two founders; the
  // channel lock (off/on switch that closes a Community Chat channel
  // for everyone) is restricted to one specific person, checked
  // server-side by user_id, not by role. This is purely "should the
  // toggle render for me" — the RPC re-checks it independently, so a
  // stale/false client value can never grant the actual power.
  const [isChannelLockAdmin, setIsChannelLockAdmin] = useState(false);
  const { protectedIds } = useRoleIds();

  useEffect(() => {
    if (!userId) { setBlockedIds(new Set()); setIsModerator(false); setIsAdmin(false); setIsChannelLockAdmin(false); return; }
    supabase.from("community_blocks").select("blocked_id").eq("blocker_id", userId).then(({ data }) => {
      setBlockedIds(new Set((data || []).map((r) => r.blocked_id)));
    });
    supabase.rpc("is_moderator", { uid: userId }).then(({ data }) => setIsModerator(!!data));
    supabase.rpc("is_admin", { uid: userId }).then(({ data }) => setIsAdmin(!!data));
    supabase.rpc("is_channel_lock_admin", { uid: userId }).then(({ data }) => setIsChannelLockAdmin(!!data));
  }, [userId]);

  /** Can the signed-in user delete content written by `authorId`?
   * Own content: always. Admin/founder: anything. Moderator: anything
   * except content from someone in `protectedIds` (admin ∪ founder —
   * see is_mod_protected in supabase/migration_moderator_role.sql and
   * migration_moderator_protect_admin.sql for why this isn't just
   * founderIds).
   *
   * This is the exact shape of the RLS policies, mirrored client-side
   * purely so the Delete control isn't offered on something that would
   * then be refused. The database is the boundary, not this. */
  const canDelete = useCallback(
    (authorId) => {
      if (!authorId) return false;
      if (authorId === userId) return true;
      if (isAdmin) return true;
      if (!isModerator) return false;
      if (!protectedIds) return false; // roles still loading — don't offer a control we can't judge
      return !protectedIds.has(authorId);
    },
    [userId, isAdmin, isModerator, protectedIds]
  );

  const report = useCallback(
    async ({ targetType, targetId, reason, details }) => {
      if (!userId) return { ok: false };
      const { error: err } = await supabase.from("community_reports").insert({
        reporter_id: userId,
        target_type: targetType,
        target_id: targetId,
        reason,
        details: details ? details.slice(0, 500) : null,
      });
      if (err) return { ok: false, error: "Couldn't submit the report. Try again." };
      return { ok: true };
    },
    [userId]
  );

  const blockUser = useCallback(
    async (targetUserId) => {
      if (!userId || targetUserId === userId) return { ok: false };
      const { error: err } = await supabase.from("community_blocks").insert({ blocker_id: userId, blocked_id: targetUserId });
      if (err) return { ok: false, error: "Couldn't block that user." };
      setBlockedIds((prev) => new Set(prev).add(targetUserId));
      return { ok: true };
    },
    [userId]
  );

  const unblockUser = useCallback(
    async (targetUserId) => {
      if (!userId) return { ok: false };
      const { error: err } = await supabase.from("community_blocks").delete().eq("blocker_id", userId).eq("blocked_id", targetUserId);
      if (err) return { ok: false };
      setBlockedIds((prev) => { const next = new Set(prev); next.delete(targetUserId); return next; });
      return { ok: true };
    },
    [userId]
  );

  // isBlocked only needs to change identity when blockedIds itself
  // changes — and the whole returned object is memoized too, so anything
  // downstream (e.g. CommunityChat's `useMemo(..., [messages, moderation])`
  // filter, or any future memoized child that takes `moderation` as a
  // prop) doesn't get a new reference, and therefore an unnecessary
  // recompute/re-render, on every single render of this hook's caller.
  const isBlocked = useCallback((id) => blockedIds.has(id), [blockedIds]);

  return useMemo(
    () => ({ blockedIds, isBlocked, isModerator, isAdmin, isChannelLockAdmin, canDelete, report, blockUser, unblockUser }),
    [blockedIds, isBlocked, isModerator, isAdmin, isChannelLockAdmin, canDelete, report, blockUser, unblockUser]
  );
}
