import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { MEMBER_STREAK_MIN } from "../components/ui";

/** user_id -> current_streak, for every user with current_streak >= 3 in
 * leaderboard_public. Used to render the "Member" badge next to a name
 * (same spots as FounderBadge: Leaderboard podium/rows/my-rank line,
 * Community posts/replies, Community chat), now WITH the day count
 * ("🔥 12d Member") instead of a flat "Member" pill, so a 3-day streak and
 * a 90-day streak don't look identical — the whole point is to make the
 * longer streak feel earned.
 *
 * A Map instead of a Set: every existing call site only ever did
 * `memberIds.has(userId)`, and Map.has() behaves identically to Set.has(),
 * so nothing downstream breaks by accident. The day count is one
 * `memberIds.get(userId)` away for whoever wants to render it.
 *
 * `current_streak` is the same server-computed value the Leaderboard shows
 * (see lb_calc_streak in supabase/migration_streak_tasks.sql) — it only
 * advances on a day with a real logged study session, a completed focus
 * timer, a logged question set, or a fully-completed task day, so someone
 * who just opens the app without doing anything never earns it. Purely
 * cosmetic, same as the Founder badge — reads the already-public
 * leaderboard_public table, nothing new is exposed.
 *
 * Founders are intentionally excluded by whoever renders this (pair with
 * useFounderIds and only show <MemberBadge /> when the user isn't a
 * founder) rather than filtered here, so this hook stays a single simple
 * query with no dependency on the founder list. */
export function useStreakMemberIds() {
  // Same reasoning as useFounderIds: start at `null` (unknown), not an
  // empty Map, so PersonBadge can tell "still loading" apart from
  // "confirmed no 3-day streak" and never renders early on a guess.
  const [memberIds, setMemberIds] = useState(null);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("leaderboard_public")
      .select("user_id, current_streak")
      .gte("current_streak", MEMBER_STREAK_MIN)
      .then(({ data }) => {
        if (mounted) setMemberIds(new Map((data || []).map((r) => [r.user_id, r.current_streak])));
      });
    return () => { mounted = false; };
  }, []);

  return memberIds;
}
