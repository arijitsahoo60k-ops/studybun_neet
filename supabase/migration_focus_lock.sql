-- ============================================================
-- Migration: Community Chat "Focus Lock" (personal self-lock)
-- ============================================================
-- Run AFTER migration_community.sql and
-- migration_community_chat_read_receipts.sql. Idempotent — safe to re-run.
--
-- What this is: a PERSONAL, SELF-IMPOSED lock. An eligible user can
-- switch it on for themselves to shut Community Chat off for themselves
-- only — messages and the composer are replaced client-side with a
-- "you closed this off, go study" banner, and they stop writing their
-- own read-receipt watermark (so their name drops out of everyone
-- else's "seen by" list) — while Community Chat keeps working normally
-- for every other user. Turning it back off restores normal behavior
-- immediately, for that same user.
--
-- THIS IS NOT THE CHANNEL LOCK (migration_channel_lock.sql) AND MUST
-- NEVER BE CONFUSED WITH IT:
--   - Channel lock: one specific hardcoded user_id, flips `is_locked`
--     on a community_channels ROW, closes that channel for EVERYONE.
--   - Focus lock (this file): any user_id present in
--     community_focus_lock_users, flips a row scoped to THEIR OWN
--     user_id in community_focus_locks, and only ever affects what
--     that one user sees/does. It cannot touch anyone else's view of
--     Community Chat, and does not read or write community_channels
--     at all.
-- They are independent booleans that can each be on or off in any
-- combination for the same channel/user at the same time; the UI
-- renders them as two visually distinct switches so neither is
-- mistaken for the other (see FocusLockToggle.jsx vs ChannelLockToggle.jsx).
--
-- ---------- 0. eligibility allowlist ----------
-- Deliberately a table, not a hardcoded user_id inside a function like
-- is_channel_lock_admin() — the whole point of this feature (per the
-- product ask) is being able to grant it to more people later with a
-- plain insert, no redeploy:
--   insert into community_focus_lock_users (user_id) values ('<uuid>');
-- To find a user_id: select user_id, name from profiles where name ilike '%<name>%';
-- To revoke: delete from community_focus_lock_users where user_id = '<uuid>';
-- (deleting also drops their lock row via the FK cascade in section 1
-- below — community_focus_locks.user_id references THIS table, not
-- auth.users directly, specifically so a revoked user can never be left
-- stuck on the "you closed this off" banner with no toggle left to undo
-- it. If it referenced auth.users instead, revoking someone would leave
-- their old is_locked=true row sitting there orphaned, permanently
-- hiding chat for them with no way back short of another manual delete.)
create table if not exists community_focus_lock_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  note text
);
alter table community_focus_lock_users enable row level security;

-- A user may check ONLY their own eligibility row directly (used by the
-- client purely to decide whether to render the toggle at all — same
-- "cosmetic only" role as is_channel_lock_admin's client-side flag).
-- The real gate is is_focus_lock_eligible(), re-checked server-side by
-- set_my_focus_lock() below on every call.
drop policy if exists "focus_lock_users select own" on community_focus_lock_users;
create policy "focus_lock_users select own" on community_focus_lock_users
  for select using (auth.uid() = user_id);
-- No insert/update/delete policy for anyone — granting/revoking this is
-- an by-hand operation done from the SQL editor with the service role,
-- same trust level as every other privileged grant in this app.

create or replace function is_focus_lock_eligible(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from community_focus_lock_users where user_id = uid);
$$;
revoke all on function is_focus_lock_eligible(uuid) from public;
grant execute on function is_focus_lock_eligible(uuid) to authenticated;

-- ---------- 1. per-user lock state ----------
-- user_id references community_focus_lock_users, NOT auth.users
-- directly — this is what makes the cascade note in section 0 true. If
-- this referenced auth.users instead, revoking someone's eligibility
-- (a plain delete from community_focus_lock_users) would leave this row
-- behind untouched: is_locked could still be true, is_focus_lock_eligible()
-- would now say false, the toggle would stop rendering for them (nothing
-- left to flip it back), and the "eligible && locked" render guard in
-- CommunityChat.jsx (belt-and-suspenders for exactly this) would be the
-- only thing standing between them and a permanently hidden chat. This
-- FK means that situation can't arise in the first place: revoke ⇒ the
-- lock row is gone in the same statement, atomically.
create table if not exists community_focus_locks (
  user_id uuid primary key references community_focus_lock_users(user_id) on delete cascade,
  is_locked boolean not null default false,
  locked_at timestamptz
);
alter table community_focus_locks enable row level security;

-- A user may only ever see their own row. No one else's focus-lock
-- state is exposed by this table to anyone (not even founders/admins) —
-- it has nothing to do with moderation and isn't meant to be visible to
-- other members.
drop policy if exists "focus_locks select own" on community_focus_locks;
create policy "focus_locks select own" on community_focus_locks
  for select using (auth.uid() = user_id);
-- No insert/update policy — all writes go through set_my_focus_lock()
-- below (security definer), same belt-and-suspenders pattern as
-- community_channel_reads: defense in depth in case anything ever
-- tried a direct client write to this table.

-- ---------- 2. toggle RPC ----------
-- Re-checks eligibility server-side (never trusts a stale/forged client
-- flag), and can only ever touch the CALLER's own row — there is no
-- p_user_id parameter, so this cannot be used to lock/unlock anyone
-- else's view even by an eligible caller.
create or replace function set_my_focus_lock(p_locked boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not is_focus_lock_eligible(auth.uid()) then
    raise exception 'not_authorized: focus lock is not enabled for this account';
  end if;
  insert into community_focus_locks (user_id, is_locked, locked_at)
    values (auth.uid(), p_locked, case when p_locked then now() else null end)
  on conflict (user_id) do update
    set is_locked = excluded.is_locked,
        locked_at = excluded.locked_at;
  return p_locked;
end;
$$;
revoke all on function set_my_focus_lock(boolean) from public;
grant execute on function set_my_focus_lock(boolean) to authenticated;

-- ---------- 3. read receipts respect an active focus lock ----------
-- CREATE OR REPLACE of the function from
-- migration_community_chat_read_receipts.sql, adding exactly one guard
-- at the top: a focus-locked user's watermark is left untouched (no
-- insert/update), so they never show up in get_message_readers() results
-- while locked, in any channel — matching "nor my seen by counts" from
-- the product ask. Everything else about the function is byte-for-byte
-- unchanged from that migration.
create or replace function mark_channel_read(p_channel_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from community_focus_locks
    where user_id = auth.uid() and is_locked
  ) then
    return;
  end if;
  insert into community_channel_reads (channel_id, user_id, last_read_at)
    values (p_channel_id, auth.uid(), now())
  on conflict (channel_id, user_id) do update set last_read_at = excluded.last_read_at;
end;
$$;
revoke all on function mark_channel_read(uuid) from public;
grant execute on function mark_channel_read(uuid) to authenticated;

-- ---------- 4. keep multiple open tabs/devices for the same user in sync ----------
-- Scoped to community_focus_locks only — never community_channels, so
-- this can't be confused with (or accidentally piggyback on) the
-- channel-lock realtime wiring in migration_channel_lock.sql. Each row
-- is only ever readable by its own owner (policy above), so adding this
-- table to the realtime publication doesn't expose anyone's lock state
-- to anyone but themselves.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'community_focus_locks'
  ) then
    execute 'alter publication supabase_realtime add table community_focus_locks;';
  end if;
end $$;
alter table community_focus_locks replica identity full;
