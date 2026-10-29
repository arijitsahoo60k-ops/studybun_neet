import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/** Which community channels have messages the signed-in user hasn't seen
 * yet — drives the red ring around a channel pill (see ChannelSelector).
 *
 * Deliberately client-only: no migration, no new table, no schema change.
 * It reads what already exists:
 *   - community_channel_reads  (the per-channel "read up to" watermark that
 *     mark_channel_read() writes — see migration_community_chat_read_receipts.sql)
 *   - community_messages       (same RLS as the chat itself, so a user the
 *     viewer has blocked never counts as "new")
 *
 * Two inputs keep it accurate:
 *   1. A fetch (on load, on tab-refocus, on reconnect) that compares each
 *      channel's newest message from SOMEONE ELSE against the watermark.
 *   2. One realtime INSERT subscription for every channel at once, so a
 *      message landing in a channel the user is NOT looking at lights it up
 *      immediately.
 *
 * A channel with NO read watermark is not "everything unread": a chat
 * block deletes the blocked user's watermarks (set_chat_ban(), to clear
 * them from "seen by"), so after an unblock every channel would
 * otherwise light up even though they'd read it all. For such a channel
 * the newest message at first sight becomes a baseline (kept in
 * localStorage, server timestamps only so a skewed device clock can't
 * matter) and only messages newer than that count. The baseline is
 * dropped the moment a real watermark exists for the channel.
 *
 * Rules:
 *   - Your own messages never count as unread.
 *   - The currently selected channel never shows as unread — it's the one
 *     on screen (CommunityChat marks it read itself). Selecting a channel
 *     clears its flag instantly.
 *   - Nothing here ever writes a read watermark except one trailing write
 *     for a message that arrived while the user was actually looking at
 *     that channel (see scheduleTrailingMark) — it closes the gap left by
 *     markChannelRead's 4s throttle so a reload doesn't flag a channel
 *     that was open on screen a moment ago.
 *
 * `viewing` = the chat is genuinely on screen for this user (chat tab
 * open, not blocked, not self-locked). `enabled` = false stops all work.
 */

const REFETCH_MIN_GAP_MS = 15000;
const TRAILING_MARK_MS = 4500;
const EMPTY = new Set();

function sameSet(a, b) {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// ── baseline for channels that have no watermark ────────────────────────────
// "" is a real value: the channel was empty at first sight.
const baselineKey = (userId, channelId) => `sb_unread_base:${userId}:${channelId}`;
const memoryBaselines = new Map(); // fallback when localStorage is unavailable

function readBaseline(userId, channelId) {
  const key = baselineKey(userId, channelId);
  try {
    const v = window.localStorage.getItem(key);
    if (v !== null) return v;
  } catch { /* storage blocked — fall through to memory */ }
  return memoryBaselines.has(key) ? memoryBaselines.get(key) : undefined;
}

function writeBaseline(userId, channelId, value) {
  const key = baselineKey(userId, channelId);
  memoryBaselines.set(key, value);
  try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
}

function forgetBaseline(userId, channelId) {
  const key = baselineKey(userId, channelId);
  memoryBaselines.delete(key);
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

export function useChannelUnread({ channels, activeChannelId, userId, enabled = true, viewing = false }) {
  const [unread, setUnread] = useState(EMPTY);

  const activeRef = useRef(activeChannelId);
  const viewingRef = useRef(viewing);
  const channelIdsRef = useRef([]);
  const touchedRef = useRef({ added: new Set(), cleared: new Set() });
  const fetchSeqRef = useRef(0);
  const lastFetchRef = useRef(0);
  const markTimersRef = useRef(new Map());

  useEffect(() => { activeRef.current = activeChannelId; }, [activeChannelId]);
  useEffect(() => { viewingRef.current = viewing; }, [viewing]);

  // Keyed on the id list, not the channels array: the array gets a new
  // identity every time a founder flips a lock (realtime), and that must
  // not trigger a refetch.
  const channelKey = (channels || []).map((c) => c.id).join(",");
  useEffect(() => {
    channelIdsRef.current = channelKey ? channelKey.split(",") : [];
  }, [channelKey]);

  const addUnread = useCallback((id) => {
    const t = touchedRef.current;
    t.added.add(id);
    t.cleared.delete(id);
    setUnread((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const clearUnread = useCallback((id) => {
    const t = touchedRef.current;
    t.cleared.add(id);
    t.added.delete(id);
    setUnread((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Selecting a channel (or the default one being the one on screen)
  // clears its flag immediately — no waiting on a server round trip.
  useEffect(() => {
    if (activeChannelId) clearUnread(activeChannelId);
  }, [activeChannelId, clearUnread]);

  const refresh = useCallback(async () => {
    const ids = channelIdsRef.current;
    if (!userId || !enabled || ids.length === 0) return;
    lastFetchRef.current = Date.now();
    const seq = ++fetchSeqRef.current;
    // Anything that changes locally while this fetch is in flight (a
    // realtime arrival, the user opening a channel) is newer than what the
    // fetch will report, so it wins when the result is applied below.
    touchedRef.current = { added: new Set(), cleared: new Set() };

    const { data: reads, error: readsErr } = await supabase
      .from("community_channel_reads")
      .select("channel_id, last_read_at")
      .eq("user_id", userId);
    // Fail soft: if the read table isn't reachable, keep whatever state we
    // have rather than lighting every channel up.
    if (readsErr || seq !== fetchSeqRef.current) return;
    const watermarks = new Map((reads || []).map((r) => [r.channel_id, r.last_read_at]));

    const results = await Promise.all(
      ids
        .filter((id) => id !== activeRef.current)
        .map(async (id) => {
          let since = watermarks.get(id);
          if (since) {
            forgetBaseline(userId, id);
          } else {
            since = readBaseline(userId, id);
            if (since === undefined) {
              // First sight of a channel with no watermark: whatever is
              // already there counts as seen. Newest message (any
              // author) becomes the baseline.
              const { data: latest, error: latestErr } = await supabase
                .from("community_messages")
                .select("created_at")
                .eq("channel_id", id)
                .order("created_at", { ascending: false })
                .limit(1);
              if (latestErr) return { id, ok: false, has: false };
              writeBaseline(userId, id, latest?.[0]?.created_at || "");
              return { id, ok: true, has: false };
            }
          }
          let q = supabase
            .from("community_messages")
            .select("id")
            .eq("channel_id", id)
            .neq("user_id", userId)
            .gt("expires_at", new Date().toISOString())
            .limit(1);
          if (since) q = q.gt("created_at", since);
          const { data, error: err } = await q;
          if (err) return { id, ok: false, has: false };
          return { id, ok: true, has: (data || []).length > 0 };
        })
    );
    if (seq !== fetchSeqRef.current) return;

    const { added, cleared } = touchedRef.current;
    setUnread((prev) => {
      const next = new Set();
      for (const r of results) {
        // A channel whose query failed keeps its previous state.
        if (r.ok ? r.has : prev.has(r.id)) next.add(r.id);
      }
      cleared.forEach((id) => next.delete(id));
      added.forEach((id) => next.add(id));
      if (activeRef.current) next.delete(activeRef.current);
      return sameSet(prev, next) ? prev : next;
    });
  }, [userId, enabled]);

  // Initial load, and again if the set of channels or the user changes.
  useEffect(() => {
    if (!userId || !enabled) {
      setUnread((prev) => (prev.size === 0 ? prev : EMPTY));
      return;
    }
    refresh();
  }, [userId, enabled, channelKey, refresh]);

  // Catch up on anything a sleeping tab / dropped connection missed.
  useEffect(() => {
    if (!userId || !enabled) return undefined;
    const maybeRefresh = () => {
      if (Date.now() - lastFetchRef.current < REFETCH_MIN_GAP_MS) return;
      refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") maybeRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", maybeRefresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", maybeRefresh);
    };
  }, [userId, enabled, refresh]);

  // One trailing read-mark for a message that arrived while the user was
  // looking at that channel. markChannelRead() is throttled to one write
  // per 4s, so the very last message of a burst can be left past the
  // saved watermark; this closes that gap. Same RPC, same server clock.
  const scheduleTrailingMark = useCallback((channelId) => {
    const timers = markTimersRef.current;
    clearTimeout(timers.get(channelId));
    timers.set(
      channelId,
      setTimeout(() => {
        timers.delete(channelId);
        supabase.rpc("mark_channel_read", { p_channel_id: channelId }).then(
          () => {},
          () => {}
        );
      }, TRAILING_MARK_MS)
    );
  }, []);

  // Realtime: any new message, any channel (RLS still applies per user).
  useEffect(() => {
    if (!userId || !enabled) return undefined;
    const rt = supabase
      .channel(`rt:community_unread:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages" },
        (payload) => {
          const row = payload?.new;
          if (!row || !row.channel_id || row.user_id === userId) return;
          if (!channelIdsRef.current.includes(row.channel_id)) return;
          if (row.channel_id === activeRef.current) {
            if (viewingRef.current) scheduleTrailingMark(row.channel_id);
            return;
          }
          addUnread(row.channel_id);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(rt); };
  }, [userId, enabled, addUnread, scheduleTrailingMark]);

  return unread;
}
