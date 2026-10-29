import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

const MIN_RECHECK_GAP_MS = 60_000; // don't hammer the RPC
const MEANINGFUL_DELTA = 0.5; // ignore sub-point rounding noise

/**
 * Self-heal watcher for the leaderboard/points system (Study Score).
 *
 * study_score in leaderboard_public is never incremented directly — it's
 * fully recomputed from raw study data by lb_recompute() every time a
 * relevant table changes (see supabase/migration_leaderboard.sql). That
 * recompute is now serialized per-user with an advisory lock (see
 * supabase/migration_leaderboard_integrity.sql) so two near-simultaneous
 * writes for the same account (two devices, two tabs, a flaky retry) can
 * no longer race and drop or clobber each other's points.
 *
 * This hook is the safety net on top of that fix: it calls
 * lb_recompute_and_report(), a server RPC that forces a fresh recompute for
 * the signed-in user right now and reports the before/after score, so any
 * drift — however it happened — gets found and corrected instead of sitting
 * silently wrong until the user's next study-log write.
 *
 * Deliberately only checks on PASSIVE triggers (app open, tab/app regaining
 * focus, and a slow periodic tick) — never right after the user's own
 * action. Their own actions already update the score live through the
 * normal insert -> trigger -> realtime path, so re-checking immediately
 * after would just re-confirm the same number and risk a false "missed
 * points found" toast for an entirely normal score bump. Checking only on
 * these passive triggers means any upward correction found really is
 * unexplained by anything the user just did in this tab.
 */
export function useLeaderboardReconciliation(userId, onRecovered) {
  const lastCheckRef = useRef(0);
  const onRecoveredRef = useRef(onRecovered);
  useEffect(() => {
    onRecoveredRef.current = onRecovered;
  }, [onRecovered]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const check = async () => {
      const now = Date.now();
      if (now - lastCheckRef.current < MIN_RECHECK_GAP_MS) return;
      lastCheckRef.current = now;

      const { data, error } = await supabase.rpc("lb_recompute_and_report");
      if (cancelled || error || !data || !data.length) return;

      const row = data[0];
      // First score this account has ever had — a starting point, not a
      // "correction", so never surface this as recovered points.
      if (!row.had_prior_row) return;

      const delta = Number(row.new_score) - Number(row.old_score);
      if (delta >= MEANINGFUL_DELTA) onRecoveredRef.current?.(delta);
    };

    check(); // app open / sign-in

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    // Safety net for a long-lived tab that never backgrounds/refocuses.
    const interval = setInterval(check, 5 * 60_000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
      clearInterval(interval);
    };
  }, [userId]);
}
