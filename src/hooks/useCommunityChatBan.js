import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

/** "Blocked from Community Chat" — see supabase/migration_chat_ban.sql.
 *
 * NOT the personal block in useCommunityModeration (blockUser/isBlocked,
 * which only hides someone from the blocker's own view), NOT the personal
 * Focus Lock, and NOT the channel lock. This is: one specific person
 * (is_chat_ban_admin) can stop a user from using Community Chat, and that
 * user sees a banner instead of the chat until they're unblocked.
 *
 * Two roles in one hook, because Community.jsx needs both:
 *  - everyone: `banned` — is MY chat access blocked (read from my own row,
 *    kept live by realtime, re-checked when the tab regains focus).
 *  - the chat-ban admin only: `isBanAdmin`, `bannedIds` (everyone currently
 *    blocked), `setBan(userId, nextBanned)` and `fetchDirectory()` (the
 *    member list the header's "Block someone" picker searches).
 *
 * `isBanAdmin` is cosmetic (decides whether the controls render). The
 * real gate is set_chat_ban() server-side, and the real block on posting
 * is the BEFORE INSERT trigger on community_messages — a stale or
 * tampered client can't grant or dodge either.
 *
 * Lives in Community.jsx (not CommunityChat) for the same reason the
 * focus lock does: CommunityChat unmounts on every tab switch, which
 * would refetch and flash the wrong state on each return.
 */
export function useCommunityChatBan() {
  const { user } = useAuth();
  const userId = user?.id;
  const [banned, setBanned] = useState(false);
  const [isBanAdmin, setIsBanAdmin] = useState(false);
  const [bannedIds, setBannedIds] = useState(() => new Set());
  const inFlightRef = useRef(new Set());

  const fetchOwn = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("community_chat_bans")
      .select("is_banned")
      .eq("user_id", userId)
      .maybeSingle();
    // On a failed read keep whatever we already believed — failing open
    // here is fine (the server trigger is the real block) and failing
    // closed would hide the chat from everyone on a network blip.
    if (error) return;
    setBanned(!!data?.is_banned);
  }, [userId]);

  // Own state + admin flag + live updates for my own row.
  useEffect(() => {
    if (!userId) { setBanned(false); setIsBanAdmin(false); return; }
    let cancelled = false;

    Promise.resolve(supabase.rpc("is_chat_ban_admin", { uid: userId })).then(({ data }) => {
      if (!cancelled) setIsBanAdmin(!!data);
    });
    fetchOwn();

    const rt = supabase
      .channel(`rt:community_chat_bans:me:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_chat_bans", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "DELETE") { setBanned(false); return; }
          setBanned(!!payload.new?.is_banned);
        }
      )
      .subscribe();

    // Safety net if the realtime socket was asleep (phone locked, laptop
    // lid closed): re-read my own row whenever the tab becomes visible.
    const onVisible = () => { if (document.visibilityState === "visible") fetchOwn(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(rt);
    };
  }, [userId, fetchOwn]);

  // Admin only: the full blocked list, live.
  useEffect(() => {
    if (!userId || !isBanAdmin) { setBannedIds(new Set()); return; }
    let cancelled = false;

    const rt = supabase
      .channel(`rt:community_chat_bans:all:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_chat_bans" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = payload.old?.user_id;
            if (!id) return;
            setBannedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
            return;
          }
          const row = payload.new;
          if (!row?.user_id) return;
          setBannedIds((prev) => {
            const next = new Set(prev);
            if (row.is_banned) next.add(row.user_id); else next.delete(row.user_id);
            return next;
          });
        }
      )
      .subscribe();

    supabase
      .from("community_chat_bans")
      .select("user_id")
      .eq("is_banned", true)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setBannedIds((prev) => {
          const next = new Set(prev);
          for (const r of data || []) next.add(r.user_id);
          return next;
        });
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(rt);
    };
  }, [userId, isBanAdmin]);

  const setBan = useCallback(
    async (targetUserId, nextBanned) => {
      if (!userId || !targetUserId || targetUserId === userId) return { ok: false };
      if (inFlightRef.current.has(targetUserId)) return { ok: false };
      inFlightRef.current.add(targetUserId);
      const { data, error } = await supabase.rpc("set_chat_ban", {
        p_user_id: targetUserId,
        p_banned: nextBanned,
      });
      inFlightRef.current.delete(targetUserId);
      if (error) {
        return { ok: false, error: nextBanned ? "Couldn't block that user. Try again." : "Couldn't unblock that user. Try again." };
      }
      const nowBanned = !!data;
      setBannedIds((prev) => {
        const next = new Set(prev);
        if (nowBanned) next.add(targetUserId); else next.delete(targetUserId);
        return next;
      });
      return { ok: true };
    },
    [userId]
  );

  // Admin only: everyone who can be blocked, for the header's "Block
  // someone" picker (server re-checks via get_chat_ban_directory()).
  // Returns {ok, data:[{user_id,name,mascot,is_banned}], error?}.
  const fetchDirectory = useCallback(async () => {
    if (!userId) return { ok: false, data: [], error: "Not signed in." };
    const { data, error } = await supabase.rpc("get_chat_ban_directory");
    if (error) return { ok: false, data: [], error: "Couldn't load members. Try again." };
    return { ok: true, data: (data || []).filter((r) => r?.user_id && r.user_id !== userId) };
  }, [userId]);

  return useMemo(
    () => ({ banned, isBanAdmin, bannedIds, setBan, fetchDirectory, refresh: fetchOwn }),
    [banned, isBanAdmin, bannedIds, setBan, fetchDirectory, fetchOwn]
  );
}
