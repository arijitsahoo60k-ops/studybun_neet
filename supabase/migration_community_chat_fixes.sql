-- ============================================================
-- Migration: Community chat fixes
-- ============================================================
-- Safe to run on an existing StudyBun database — idempotent.
--
-- Fixes two bugs in the community chat:
--
-- 1. "Study Buddy" always showing instead of the real name.
--    `profiles` has one blanket RLS policy: `auth.uid() = user_id`,
--    applied to every table in the app's "user access" loop (see
--    schema.sql). That's correct for every other table (nobody
--    should read someone else's timer sessions), but community
--    chat/feed legitimately needs to show OTHER people's display
--    name + mascot. Since that policy blocks reading anyone else's
--    row, `attachProfiles()` and the realtime INSERT handlers got an
--    empty result for every other person, and the UI fell back to
--    the generic "Study Buddy" label. This adds a narrow
--    security-definer RPC that returns only `name`/`mascot` (never
--    exam date, goals, or anything else in profiles) for a given set
--    of user ids, callable by any authenticated user.
--
-- 2. Deleting a message removes it for you, but not for anyone else.
--    Supabase Realtime's `postgres_changes` DELETE event can only be
--    filtered by `channel_id=eq.X` if the deleted row's replica data
--    actually includes `channel_id`. Postgres' default replica
--    identity only ships the primary key (`id`) on DELETE, so the
--    filter can never match and the DELETE event never reaches other
--    clients — the sender's own optimistic UI update was the only
--    thing that looked like it worked. Setting REPLICA IDENTITY FULL
--    on community_messages makes the full old row available, so the
--    filtered delete event actually broadcasts.
-- ============================================================

-- ---------- 1. narrow public read of display name + mascot ----------
create or replace function get_community_profiles(uids uuid[])
returns table(user_id uuid, name text, mascot text)
language sql stable security definer set search_path = public as $$
  select user_id, name, mascot from profiles where user_id = any(uids);
$$;
revoke all on function get_community_profiles(uuid[]) from public;
grant execute on function get_community_profiles(uuid[]) to authenticated;

-- ---------- 2. make DELETE events broadcast correctly ----------
alter table community_messages replica identity full;
