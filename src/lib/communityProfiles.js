import { supabase } from "./supabaseClient";

// Module-level cache: user_id -> {name, mascot, ...}. A profile rarely
// changes mid-session, so once we've fetched someone once we don't need
// to hit get_community_profiles again for them. Without this, a busy
// chat (several people posting back-to-back) fired one RPC round-trip
// PER INCOMING MESSAGE before that message could even render — that
// serialized network latency was the actual cause of the chat feeling
// laggy when multiple people talked at once. Lives for the tab's
// lifetime; a stale cached name/mascot just means the person needs to
// reload after changing their profile, same as most chat apps.
const profileCache = new Map();

// user_id -> Promise. Dedupes concurrent RPCs for the same not-yet-cached
// id. Without this, two people posting their first-ever message in the
// same second (e.g. several new users joining a channel around the same
// time) each triggered their own independent RPC for the same missing
// id — same class of duplicate-network-call problem the cache above was
// meant to eliminate, just for the "haven't been cached yet" moment.
const inFlight = new Map();

function cacheProfiles(list) {
  for (const p of list || []) if (p?.user_id) profileCache.set(p.user_id, p);
}

async function fetchMissing(ids) {
  const { data } = await supabase.rpc("get_community_profiles", { uids: ids });
  cacheProfiles(data);
  return data;
}

// Ensures every id in `ids` is either already cached or has a request for
// it in flight, then waits for whichever of those apply. Callers read the
// actual values back out of `profileCache` afterward.
async function ensureProfiles(ids) {
  const toFetch = ids.filter((id) => !profileCache.has(id) && !inFlight.has(id));
  if (toFetch.length) {
    const batchPromise = fetchMissing(toFetch).finally(() => {
      for (const id of toFetch) inFlight.delete(id);
    });
    for (const id of toFetch) inFlight.set(id, batchPromise);
  }
  const waits = [...new Set(ids.filter((id) => inFlight.has(id)).map((id) => inFlight.get(id)))];
  if (waits.length) await Promise.all(waits);
}

// community_messages/community_posts/community_replies/accountability_goals
// all reference auth.users(id) directly (same as every other StudyBun
// table), not profiles(user_id) — so there's no FK path PostgREST can use
// for an embedded `profiles:user_id(...)` select. This does the same job
// with one batched lookup instead: fetch the rows, collect the distinct
// user_ids, fetch just those profiles, and merge client-side.
//
// NOTE: this goes through the `get_community_profiles` RPC (see
// migration_community_chat_fixes.sql), not a plain `.from("profiles")`
// select — profiles' RLS policy only allows a user to read their own
// row, so a direct select here would silently return nothing for
// everyone else and every message would show as "Study Buddy".
export async function attachProfiles(rows, getUserId = (r) => r.user_id) {
  const ids = [...new Set((rows || []).map(getUserId).filter(Boolean))];
  if (!ids.length) return rows || [];
  await ensureProfiles(ids);
  return (rows || []).map((r) => ({ ...r, profiles: profileCache.get(getUserId(r)) || null }));
}

// Same lookup for a single user — used by realtime INSERT handlers,
// which only get a bare user_id in the payload and need just that
// person's name/mascot.
export async function fetchOneProfile(userId) {
  if (!userId) return null;
  await ensureProfiles([userId]);
  return profileCache.get(userId) || null;
}

// Batched lookup returning a Map(user_id -> {name, mascot}) instead of
// merging into rows — used by StudyingNowCard, which has bare ids from the
// presence channel (see useStudyPresence) and nothing else to merge them
// into.
export async function fetchProfilesByIds(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  await ensureProfiles(ids);
  return new Map(ids.map((id) => [id, profileCache.get(id)]));
}

// Synchronous cache peek — no network, no await. Used by the realtime
// INSERT handler so a new message can render immediately (with whatever
// we already know about the sender, possibly nothing yet) instead of
// blocking its appearance on a profile round-trip. That wait was what let
// simultaneous messages from different senders render out of order —
// whichever profile fetch happened to resolve first, not whichever
// message was actually sent first.
export function getCachedProfile(userId) {
  return profileCache.get(userId) || null;
}

// Read-receipts lookup for the "seen by" (i) popup on a message you sent.
// Goes through get_message_readers (see migration_community_chat_read_receipts.sql)
// which already joins profiles server-side, so this is one round trip —
// no separate get_community_profiles call needed, which is what keeps the
// popup opening instantly instead of chaining two network hops.
export async function fetchMessageReaders(channelId, createdAtIso) {
  if (!channelId || !createdAtIso) return [];
  const { data, error } = await supabase.rpc("get_message_readers", {
    p_channel_id: channelId,
    p_after: createdAtIso,
  });
  if (error) throw error;
  return data || [];
}
