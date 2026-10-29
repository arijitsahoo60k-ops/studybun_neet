import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

/**
 * Ephemeral "studying right now" indicator, built on Supabase Realtime
 * Presence rather than the database — nothing here is ever written to a
 * table. Each signed-in client joins one shared presence channel and
 * tracks a single boolean (whether their focus timer is currently
 * running); everyone else's clients see that boolean and nothing else.
 * The moment a tab closes or the timer stops, presence clears itself —
 * no cleanup job needed.
 *
 * Mounted once near the app root (same reasoning as useFocusTimer living
 * there) so presence stays accurate even while the person isn't looking
 * at the Leaderboard page themselves.
 */
export function useStudyPresence(isStudyingNow) {
  const { user } = useAuth();
  const userId = user?.id;
  const [studyingIds, setStudyingIds] = useState(() => new Set());
  const channelRef = useRef(null);
  // Always holds the CURRENT isStudyingNow, independent of which render the
  // [userId]-effect below happened to run in. Read by connect() below at
  // (re)join time so a join that lands after isStudyingNow has already
  // changed still tracks the up-to-date value instead of a stale one
  // captured at effect-setup time.
  const isStudyingNowRef = useRef(isStudyingNow);
  useEffect(() => { isStudyingNowRef.current = isStudyingNow; }, [isStudyingNow]);

  useEffect(() => {
    if (!userId) {
      setStudyingIds(new Set());
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const channel = supabase.channel("presence:studying", {
        config: { presence: { key: userId } },
      });
      channelRef.current = channel;

      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const studying = new Set();
        Object.entries(state).forEach(([key, metas]) => {
          if (metas.some((m) => m.studying)) studying.add(key);
        });
        setStudyingIds(studying);
      });

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // .catch: harmless if this loses a race with the teardown below
          // (channel already being replaced) -- never let it surface as an
          // uncaught rejection.
          channel.track({ studying: !!isStudyingNowRef.current }).catch(() => {});
        }
      });
    };

    connect();

    // The real bug: a focus session runs 25-50 min, and it's near-certain
    // the tab gets backgrounded/throttled (screen lock, app switch, PWA
    // suspension) for long enough at some point during that that Realtime's
    // websocket goes fully dead -- and its own automatic reconnect doesn't
    // reliably resume once the tab is foregrounded again on mobile. When
    // that's happened, every track() call after (e.g. the one firing the
    // instant a session ends) silently goes nowhere, and this client stops
    // receiving anyone's sync updates -- itself included -- until something
    // opens a fresh connection. A reload does that by accident; do it on
    // purpose instead, every time the app comes back to the foreground.
    // Cheap even when the old channel was perfectly healthy.
    const onWake = () => {
      if (document.hidden) return;
      const old = channelRef.current;
      channelRef.current = null;
      if (old) supabase.removeChannel(old);
      connect();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("pageshow", onWake);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("pageshow", onWake);
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    // Also fires immediately (not just on the next wake/reconnect) so
    // pause/resume/end feel instant while the tab is in the foreground.
    if (channelRef.current) channelRef.current.track({ studying: !!isStudyingNow }).catch(() => {});
  }, [isStudyingNow]);

  return studyingIds;
}
