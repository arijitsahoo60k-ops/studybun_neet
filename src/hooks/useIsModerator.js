import { useAuth } from "../lib/AuthContext";
import { useRoleIds } from "./useRoleIds";

/**
 * "Is the signed-in user specifically a moderator?" — the one-boolean
 * version of the shared role snapshot, for the mascot picker's lion
 * unlock (see pickableMascots in data/mascots.js). Mirrors useIsFounder's
 * shape exactly.
 *
 * Deliberately narrow: this is `role === 'moderator'` only, not "has mod
 * powers" (a founder already gets the lion through their own isFounder
 * check, no need to double-count them here).
 *
 * Returns false while the role list is still loading rather than null —
 * same reasoning as useIsFounder: every caller wants "should I show the
 * lion tile yet" answered as "not yet", not as a flash of undefined.
 *
 * Purely cosmetic gating, as with the Founder-only mascots. The real lock
 * is the database trigger in supabase/migration_moderator_mascot_unlock.sql.
 */
export function useIsModerator() {
  const { user } = useAuth();
  const { moderatorIds } = useRoleIds();
  if (!user?.id || !moderatorIds) return false;
  return moderatorIds.has(user.id);
}
