-- ============================================================
-- Migration: Community Chat "block from chat" (single-founder moderation)
-- ============================================================
-- Run AFTER migration_community.sql and migration_channel_lock.sql.
-- Idempotent — safe to re-run.
--
-- What this is: one specific person (the same single user_id that holds
-- the channel lock, see is_channel_lock_admin in migration_channel_lock.sql)
-- can block any other user from COMMUNITY CHAT ONLY. A blocked user sees a
-- banner in place of the chat (same idea as Focus Lock's banner), cannot
-- send messages, and everything else in the app — Study feed, private
-- chats, accountability, leaderboard, timer — is untouched. Unblocking
-- restores normal chat immediately.
--
-- NOT to be confused with:
--   - community_blocks (personal "hide this person from MY view" block)
--   - community_focus_locks (self-imposed lock on your own view)
--   - community_channels.is_locked (closes a channel for everyone)
-- This table is a fourth, independent thing: "this user may not post in
-- Community Chat", decided by the chat-ban admin, enforced in the database.
--
-- Unblock UPDATEs the row (is_banned=false) instead of deleting it so the
-- realtime UPDATE event (which Supabase can filter and RLS-check) reaches
-- the unblocked user's open tab instantly; DELETE events can't be filtered.
--
-- ---------- 0. who may block ----------
-- Delegates to is_channel_lock_admin() so there is exactly ONE place that
-- names the person (the uuid literal in migration_channel_lock.sql). If
-- you ever want a different person for blocking than for the channel
-- lock, put a uuid literal here instead and re-run this file.
create or replace function is_chat_ban_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(is_channel_lock_admin(uid), false);
$$;
revoke all on function is_chat_ban_admin(uuid) from public, anon;
grant execute on function is_chat_ban_admin(uuid) to authenticated;

-- ---------- 1. state table ----------
create table if not exists community_chat_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_banned boolean not null default true,
  banned_at timestamptz,
  banned_by uuid references auth.users(id) on delete set null
);
alter table community_chat_bans enable row level security;

-- A user may read ONLY their own row (that's how their client learns it
-- should show the banner). The chat-ban admin may read every row (to
-- render the "Blocked" list). Nobody else can see anyone's state.
drop policy if exists "chat_bans select own or admin" on community_chat_bans;
create policy "chat_bans select own or admin" on community_chat_bans
  for select using (auth.uid() = user_id or is_chat_ban_admin(auth.uid()));
-- No insert/update/delete policy: every write goes through set_chat_ban().

-- ---------- 2. block / unblock RPC ----------
create or replace function set_chat_ban(p_user_id uuid, p_banned boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(is_chat_ban_admin(auth.uid()), false) then
    raise exception 'not_authorized: chat blocking is restricted';
  end if;
  if p_user_id is null then
    raise exception 'invalid_user: no user given';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_block_self: you cannot block yourself';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'user_not_found: %', p_user_id;
  end if;
  insert into community_chat_bans (user_id, is_banned, banned_at, banned_by)
    values (p_user_id, p_banned, case when p_banned then now() else null end,
            case when p_banned then auth.uid() else null end)
  on conflict (user_id) do update
    set is_banned = excluded.is_banned,
        banned_at = excluded.banned_at,
        banned_by = excluded.banned_by;
  -- A blocked user must stop showing up in everyone's "seen by" list, and
  -- that list is built from community_channel_reads (migration_community_
  -- chat_read_receipts.sql, which only feeds "seen by" — no unread badge
  -- reads it). Drop their existing receipts on block; the trigger in
  -- section 3b stops new ones. Guarded so this file still applies if the
  -- read-receipts migration was never run.
  if p_banned and to_regclass('public.community_channel_reads') is not null then
    execute 'delete from community_channel_reads where user_id = $1' using p_user_id;
  end if;
  return p_banned;
end;
$$;
revoke all on function set_chat_ban(uuid, boolean) from public, anon;
grant execute on function set_chat_ban(uuid, boolean) to authenticated;

-- ---------- 2b. member directory for the "Block someone" picker ----------
-- profiles' own RLS only lets a user read their own row, so the admin's
-- header picker cannot select everyone directly. This returns every
-- community member (minus the caller, minus people who opted out of the
-- community) with their current blocked flag. Someone who is blocked AND
-- opted out is still returned so they can always be unblocked. Gated on
-- is_chat_ban_admin() (NOT is_admin()) so it works for exactly the one
-- person who can block, whether or not that person also holds the founder
-- role.
create or replace function get_chat_ban_directory()
returns table(user_id uuid, name text, mascot text, is_banned boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(is_chat_ban_admin(auth.uid()), false) then
    raise exception 'not_authorized: chat blocking is restricted';
  end if;
  return query
    select p.user_id, p.name, p.mascot, coalesce(b.is_banned, false)
    from profiles p
    left join community_chat_bans b on b.user_id = p.user_id
    where p.user_id <> auth.uid()
      and (coalesce(p.community_opt_out, false) = false or coalesce(b.is_banned, false))
    order by p.name asc;
end;
$$;
revoke all on function get_chat_ban_directory() from public, anon;
grant execute on function get_chat_ban_directory() to authenticated;

-- ---------- 3. a blocked user can't post in Community Chat ----------
-- A separate BEFORE INSERT trigger rather than another edit to
-- community_messages_guard() (that function has been re-created by four
-- earlier migrations; touching it again risks reverting one of them) or
-- to the "messages insert own" policy (migration_community.sql re-runs
-- would silently drop a clause). Named with an "a_" prefix so it fires
-- before trg_community_messages_guard (Postgres runs same-event triggers
-- alphabetically): a blocked user gets a clean 'chat_banned' error, not
-- a rate-limit one. Only community_messages is covered — feed posts,
-- replies and private chat are deliberately unaffected.
create or replace function community_chat_ban_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from community_chat_bans
    where user_id = new.user_id and is_banned
  ) then
    raise exception 'chat_banned: you are blocked from community chat';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_community_messages_a_ban_check on community_messages;
create trigger trg_community_messages_a_ban_check
  before insert on community_messages
  for each row execute function community_chat_ban_check();

-- ---------- 3b. a blocked user leaves no "seen by" receipts ----------
-- mark_channel_read() and the table's own "upsert own" policy both write
-- community_channel_reads. Rather than re-creating either (migration_
-- focus_lock.sql owns mark_channel_read), this BEFORE trigger quietly
-- skips the write while the user is blocked — no error, so a stale client
-- that still calls it doesn't break. Same pattern as Focus Lock's own
-- "locked users record nothing". Created only if the table exists.
create or replace function community_chat_ban_reads_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from community_chat_bans
    where user_id = new.user_id and is_banned
  ) then
    return null;
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.community_channel_reads') is not null then
    execute 'drop trigger if exists trg_channel_reads_a_ban_check on community_channel_reads';
    execute 'create trigger trg_channel_reads_a_ban_check
      before insert or update on community_channel_reads
      for each row execute function community_chat_ban_reads_check()';
  end if;
end $$;

-- ---------- 4. realtime ----------
-- Instant banner on block, instant restore on unblock, for a user already
-- sitting in the app. RLS (section 1) decides who receives which row's
-- events: a normal user only ever gets their own.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'community_chat_bans'
  ) then
    execute 'alter publication supabase_realtime add table community_chat_bans;';
  end if;
end $$;
alter table community_chat_bans replica identity full;
