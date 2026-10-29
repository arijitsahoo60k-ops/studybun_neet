import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

/** Personal, self-imposed Community Chat lock — see
 * supabase/migration_focus_lock.sql for the full design note.
 *
 * NOT the founder-only channel lock (see useCommunityModeration's
 * isChannelLockAdmin / ChannelLockToggle). This one only ever affects
 * the signed-in user's own view: `eligible` is purely cosmetic (decides
 * whether the toggle renders at all), the real gate is re-checked
 * server-side by set_my_focus_lock() on every call, and there is no way
 * for this hook to read or change anyone else's lock state.
 */
export function useCommunityFocusLock() {
  const { user } = useAuth();
  const userId = user?.id;
  const [eligible, setEligible] = useState(false);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!userId) { setEligible(false); setLocked(false); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    supabase.rpc("is_focus_lock_eligible", { uid: userId }).then(({ data }) => {
      if (!cancelled) setEligible(!!data);
    });

    // Not eligible or never toggled on before ⇒ no row exists yet ⇒
    // .maybeSingle() returns null data (not an error) ⇒ defaults to
    // unlocked, which is the correct starting state either way.
    supabase
      .from("community_focus_locks")
      .select("is_locked")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setLocked(!!data?.is_locked);
        setLoading(false);
      });

    // Keeps a second open tab/device for the same account in sync —
    // filtered to this user's own row only (see the RLS policy in the
    // migration), so this subscription can never see anyone else's state.
    const rtChannel = supabase
      .channel(`rt:community_focus_locks:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_focus_locks", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "DELETE") { setLocked(false); return; }
          setLocked(!!payload.new?.is_locked);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(rtChannel);
    };
  }, [userId]);

  const toggle = useCallback(
    async (nextLocked) => {
      if (pending) return { ok: false };
      setPending(true);
      const { data, error: err } = await supabase.rpc("set_my_focus_lock", { p_locked: nextLocked });
      setPending(false);
      if (err) return { ok: false, error: "Couldn't update that. Try again." };
      setLocked(!!data);
      return { ok: true };
    },
    [pending]
  );

  return useMemo(
    () => ({ eligible, locked, loading, pending, toggle }),
    [eligible, locked, loading, pending, toggle]
  );
}
