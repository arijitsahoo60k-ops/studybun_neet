-- ============================================================
-- Migration: Community Chat channel lock (founder-exclusive)
-- ============================================================
-- Run AFTER migration_community.sql and migration_founder_tag.sql.
-- Idempotent — safe to re-run.
--
-- What this adds: a per-channel off/on switch that closes a Community
-- Chat channel for EVERYONE (no one — not mods, not the other founder,
-- not the person who locked it — can post while it's locked), while the
-- channel stays visible to all users with a clear "closed" state. Only
-- one specific person can flip it.
--
-- Deliberately NOT role-based. There are two 'founder' rows in
-- user_roles (see migration_founder_tag.sql), and this power is for one
-- specific person, not "whoever holds the founder role" — so it is not
-- gated by is_admin()/is_founder() the way everything else in Community
-- is. is_channel_lock_admin(uid) below checks a single hardcoded
-- user_id, same trust level as every other privileged change in this
-- app (granted by hand in the SQL editor), just scoped to one person
-- instead of one role.
--
-- ---------- 0. lock admin user_id ----------
-- Already set below to the user_id supplied for this deploy
-- (f50ed60c-21d4-4662-bce8-946d156f72c2). To change who holds this
-- power later, look up the new user_id:
--   select user_id, name from profiles where name ilike '%<name>%';
-- and update the uuid literal inside is_channel_lock_admin() below,
-- then re-run this file (safe — create or replace).
--
-- ---------- ordering note ----------
-- migration_community.sql's own docs call it "safe to re-run". It is —
-- EXCEPT that re-running it after this file will drop and recreate the
-- "messages insert own" policy on community_messages WITHOUT the
-- `not c.is_locked` clause section 4 below adds, silently letting new
-- messages back into a locked channel at the database level (the UI
-- would still hide the composer, but a direct API call would not be
-- blocked). If you ever re-run migration_community.sql, re-run this
-- file again right after it to restore that clause.
-- ============================================================

create or replace function is_channel_lock_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid = 'f50ed60c-21d4-4662-bce8-946d156f72c2'::uuid;
$$;
revoke all on function is_channel_lock_admin(uuid) from public;
grant execute on function is_channel_lock_admin(uuid) to authenticated;

-- ---------- 1. columns ----------
alter table community_channels
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references auth.users(id) on delete set null;

-- ---------- 2. only the lock admin may flip it ----------
-- Belt-and-suspenders alongside the RPC below (which is security
-- definer and doesn't strictly need this) — direct table writes stay
-- locked down the same way.
drop policy if exists "channels update lock admin only" on community_channels;
create policy "channels update lock admin only" on community_channels
  for update using (is_channel_lock_admin(auth.uid()))
  with check (is_channel_lock_admin(auth.uid()));

-- ---------- 3. toggle RPC ----------
-- Server-sets locked_at/locked_by from auth.uid()/now() rather than
-- trusting client-supplied values for either. Raises a plain exception
-- (surfaced to the client as an error) for anyone else — including a
-- founder who isn't THE founder.
create or replace function set_channel_lock(p_channel_id uuid, p_locked boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_channel_lock_admin(auth.uid()) then
    raise exception 'not_authorized: channel lock is restricted';
  end if;
  update community_channels
    set is_locked = p_locked,
        locked_at = case when p_locked then now() else null end,
        locked_by = case when p_locked then auth.uid() else null end
    where id = p_channel_id;
  -- Without this, a bad/stale channel id matches zero rows, the UPDATE
  -- still "succeeds" (0 rows affected isn't a Postgres error), and the
  -- client would read that as ok:true and optimistically show a channel
  -- as locked that was never actually touched server-side.
  if not found then
    raise exception 'channel_not_found: %', p_channel_id;
  end if;
end;
$$;
revoke all on function set_channel_lock(uuid, boolean) from public;
grant execute on function set_channel_lock(uuid, boolean) to authenticated;

-- ---------- 4. a locked channel accepts no new messages, from anyone ----------
drop policy if exists "messages insert own" on community_messages;
create policy "messages insert own" on community_messages
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from community_channels c
      where c.id = channel_id and c.is_active and not c.is_locked
    )
  );

-- ---------- 5. realtime, so a lock/unlock is instant for everyone already
--               sitting in Community Chat, not just on next reload ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'community_channels'
  ) then
    execute 'alter publication supabase_realtime add table community_channels;';
  end if;
end $$;
alter table community_channels replica identity full;