import { useSyncExternalStore } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * The one place the app learns who wears a badge: founders (👑) and
 * moderators (⚡). One `get_role_ids` RPC for both lists.
 *
 * Why an external store instead of a plain useState hook: <PersonBadge />
 * now resolves roles itself rather than having founderIds threaded down
 * through CommunityChat → ChatMessage, CommunityFeed → CommunityPost,
 * Leaderboard rows, etc. A Leaderboard page renders ~50 of them and a
 * busy channel plenty more — a per-component useEffect + fetch would be
 * 50 identical RPCs on mount. Here every badge subscribes to one
 * module-level snapshot, the request fires once per page load, and each
 * subscriber re-renders once when it lands.
 *
 * Snapshot shape is `{ founderIds, moderatorIds, protectedIds }`, all
 * `null` until the RPC resolves — never empty Sets. Same reasoning as the
 * old useFounderIds: an empty Set reads as "confirmed not a founder",
 * which is what used to flash a Member badge on a founder's own name for
 * a moment. Consumers render nothing until the Sets they need are real.
 *
 * `protectedIds` is admin ∪ founder — exactly who a moderator may never
 * delete (see is_mod_protected in supabase/migration_moderator_role.sql).
 * It's not the same as `founderIds`: admin carries no badge and isn't
 * rendered anywhere, but useCommunityModeration's canDelete still has to
 * treat an admin's content as off-limits to a mod, which is the whole
 * reason this third set exists rather than reusing founderIds for that
 * check (see migration_moderator_protect_admin.sql).
 *
 * Purely cosmetic, as before. Actual delete power is decided by RLS
 * (is_moderator / is_admin / is_mod_protected — see
 * supabase/migration_moderator_role.sql), never by this list.
 */

const EMPTY = { founderIds: null, moderatorIds: null, protectedIds: null };

let snapshot = EMPTY;
let inflight = null;
const listeners = new Set();

function toSet(value) {
  return new Set(Array.isArray(value) ? value : []);
}

function load() {
  if (inflight) return inflight;
  inflight = Promise.resolve(supabase.rpc("get_role_ids"))
    .then(({ data, error }) => {
      if (error || !data) {
        // Leave the snapshot as "unknown" and clear the latch so the
        // next mount retries. A failed roles lookup must never resolve
        // to "nobody has a role" — that would silently strip every
        // badge and, worse, hide moderation controls from a real mod.
        inflight = null;
        return;
      }
      snapshot = {
        founderIds: toSet(data.founders),
        moderatorIds: toSet(data.moderators),
        // Older, not-yet-updated backends (before
        // migration_moderator_protect_admin.sql) won't send `protected`
        // at all — fall back to founders so canDelete degrades to its
        // previous (founder-only-protected) behavior instead of treating
        // every author as unprotected.
        protectedIds: toSet(data.protected !== undefined ? data.protected : data.founders),
      };
      listeners.forEach((l) => l());
    })
    .catch(() => {
      inflight = null;
    });
  return inflight;
}

function subscribe(onChange) {
  listeners.add(onChange);
  load();
  return () => listeners.delete(onChange);
}

function getSnapshot() {
  return snapshot;
}

export function useRoleIds() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Force a re-fetch — for after a role change made in this session.
 * Nothing calls this today (roles are granted from the SQL editor, and
 * everyone else picks the change up on their next load); it exists so a
 * future admin panel doesn't have to reach into this module's internals. */
export function refreshRoleIds() {
  inflight = null;
  load();
}
