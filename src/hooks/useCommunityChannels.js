import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

/** Fixed system channels (General, NEET UG, Biology, Physics, ...). Small and
 * rarely changes, so a plain fetch-once is enough — no realtime needed
 * for the channel list itself. is_locked is the one field on this row
 * that CAN change while someone's sitting on the page (a founder flips
 * it live), so that one column is kept in sync via realtime — see
 * "realtime for the lock" below. */
export function useCommunityChannels() {
  const { user } = useAuth();
  const userId = user?.id;
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    supabase
      .from("community_channels")
      .select("id, name, slug, description, subject, is_locked, locked_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(async ({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          // Safety net for exactly one deploy-order mistake: this build
          // shipped before supabase/migration_channel_lock.sql was run,
          // so is_locked/locked_at don't exist in the DB yet and the
          // select above 400s. Falling through to setChannels([]) here
          // (the old un-guarded behavior) would silently empty out the
          // channel list and break Community Chat entirely, for every
          // user, for a feature nobody's even using yet. Retry with the
          // original column list instead — channels just render as
          // permanently unlocked until the migration actually runs.
          const fallback = await supabase
            .from("community_channels")
            .select("id, name, slug, description, subject")
            .eq("is_active", true)
            .order("sort_order", { ascending: true });
          if (cancelled) return;
          const rows = (fallback.data || []).map((c) => ({ ...c, is_locked: false, locked_at: null }));
          setChannels(rows);
          setActiveChannelId((prev) => prev || rows[0]?.id || null);
          setLoading(false);
          return;
        }
        setChannels(data || []);
        setActiveChannelId((prev) => prev || data?.[0]?.id || null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  // Realtime for the lock: a founder-side toggle on the "off/on" switch
  // (see ChannelLockToggle) should close/reopen a channel for everyone
  // already sitting in Community Chat, not just on their next reload —
  // that's the whole point of "it shuts off for all users as well".
  useEffect(() => {
    if (!userId) return undefined;
    const rtChannel = supabase
      .channel("rt:community_channels:locks")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "community_channels" },
        (payload) => {
          const row = payload.new;
          setChannels((prev) => prev.map((c) => (c.id === row.id ? { ...c, is_locked: row.is_locked, locked_at: row.locked_at } : c)));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(rtChannel); };
  }, [userId]);

  // Only ever succeeds for the one person set_channel_lock() checks for
  // server-side (see supabase/migration_channel_lock.sql) — a caller
  // this wasn't meant for gets back { ok: false } from the RPC error,
  // nothing changes locally. Optimistic local update on success so the
  // toggler's own screen doesn't wait on their own realtime echo.
  const setChannelLock = useCallback(async (channelId, locked) => {
    const { error: err } = await supabase.rpc("set_channel_lock", { p_channel_id: channelId, p_locked: locked });
    if (err) return { ok: false, error: "Couldn't update that — you may not have permission." };
    setChannels((prev) => prev.map((c) => (c.id === channelId ? { ...c, is_locked: locked, locked_at: locked ? new Date().toISOString() : null } : c)));
    return { ok: true };
  }, []);

  return { channels, activeChannelId, setActiveChannelId, loading, setChannelLock };
}
