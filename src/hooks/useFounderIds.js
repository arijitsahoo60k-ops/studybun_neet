import { useRoleIds } from "./useRoleIds";

/** Just the small set of user_ids with role = 'founder', for rendering the
 * "Founder" badge on Leaderboard/Community. Purely cosmetic — actual
 * delete/moderation power comes from is_moderator()/is_admin() on the
 * backend (see useCommunityModeration), not from this list.
 *
 * Now a thin read off the shared role snapshot (useRoleIds) instead of its
 * own `get_founder_ids` RPC: since the ⚡ Mod badge landed, every caller
 * that wants founders also needs moderators, and both come back in the
 * same request. The return value is unchanged — a Set, or `null` while
 * still loading — so every existing caller (Leaderboard, Community,
 * useIsFounder) keeps working as-is.
 *
 * Starts as `null` (status unknown), not an empty Set — an empty Set
 * would make everyone look like "not a founder" for the brief window
 * before the RPC resolves, which is exactly the flash that let the
 * Member badge show on a founder's own name for a moment. */
export function useFounderIds() {
  return useRoleIds().founderIds;
}
