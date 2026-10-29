import { useAuth } from "../lib/AuthContext";
import { useFounderIds } from "./useFounderIds";

/**
 * "Is the signed-in user a founder?" — the one-boolean version of
 * useFounderIds, for the places that only care about *me* (the mascot picker
 * in Settings and onboarding) rather than about badging other people's names.
 *
 * Returns false while the founder list is still loading rather than null,
 * because every caller wants the same answer to "should I show the exclusive
 * options yet": not yet. The exclusive mascots simply appear a moment later
 * for a founder, which is far better than the reverse — flashing lion and
 * dragon at every member for 200ms on every page load.
 *
 * Purely cosmetic gating, as with the Founder badge. Nothing here is a
 * security boundary; the profile-update trigger in
 * supabase/migration_founder_mascots.sql is.
 */
export function useIsFounder() {
  const { user } = useAuth();
  const founderIds = useFounderIds();
  if (!user?.id || !founderIds) return false;
  return founderIds.has(user.id);
}
