-- ============================================================
-- Migration: Moderator tier (⚡ Mod) — founder-protected deletes
-- ============================================================
-- Run AFTER migration_community.sql, migration_founder_tag.sql,
-- migration_founder_mascots.sql, migration_private_chat.sql and
-- migration_private_chat_v2.sql. Idempotent — safe to re-run.
--
-- The 'moderator' role already existed in user_roles and already
-- satisfied is_moderator(), which meant a moderator inherited EVERY
-- founder power the moment you granted the role:
--   • could delete a founder's posts/messages,
--   • could read every private channel in the app (the select
--     policies all said `or is_moderator(auth.uid())`),
--   • could create/rename/delete private channels, add/remove
--     members, and enumerate the whole user directory.
-- That is not what a mod is. This migration splits the two tiers:
--
--   founder / admin  → unchanged. Everything they could do before.
--   moderator        → can delete OTHER people's community posts,
--                      replies, community-chat messages, and private
--                      messages in channels they are a member of.
--                      Cannot touch anything authored by a founder or
--                      admin. No channel admin powers, no directory,
--                      no visibility into private channels they were
--                      not added to.
--
-- Mechanism: is_admin(uid) is true for admin+founder only, so it is
-- used as (a) "outranks a moderator" and (b) "is protected from a
-- moderator". is_moderator(uid) stays the broad "has any delete
-- power" check. Nothing else in the app changes meaning.
-- ============================================================

-- ---------- 1. protection predicate ----------
-- "Is this author off-limits to a plain moderator?" Founders and
-- admins are. Kept as its own function so the intent reads clearly in
-- every policy below and there is one place to change it later.
create or replace function is_mod_protected(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles
    where user_id = target and role in ('admin', 'founder')
  );
$$;
revoke all on function is_mod_protected(uuid) from public;
grant execute on function is_mod_protected(uuid) to authenticated;

-- ---------- 2. public role lookup for the badges ----------
-- One round trip instead of two (the client renders both badges from
-- the same snapshot — see src/hooks/useRoleIds.js). Same exposure as
-- the existing get_founder_ids(): who wears a badge is public by
-- design, that IS the badge. 'admin' is deliberately NOT returned —
-- it has no badge and no reason to be advertised.
-- get_founder_ids() is left in place untouched: an installed PWA can
-- still be running yesterday's JS out of the service-worker cache and
-- calling it.
create or replace function get_role_ids() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'founders', coalesce(
      (select jsonb_agg(user_id) from user_roles where role = 'founder'),
      '[]'::jsonb
    ),
    'moderators', coalesce(
      (select jsonb_agg(user_id) from user_roles where role = 'moderator'),
      '[]'::jsonb
    )
  );
$$;
revoke all on function get_role_ids() from public;
grant execute on function get_role_ids() to authenticated;

-- ---------- 3. community chat / feed: mods can't touch founders ----------
drop policy if exists "messages delete own or mod" on community_messages;
create policy "messages delete own or mod" on community_messages
  for delete using (
    auth.uid() = user_id
    or is_admin(auth.uid())
    or (is_moderator(auth.uid()) and not is_mod_protected(user_id))
  );

drop policy if exists "posts delete own or mod" on community_posts;
create policy "posts delete own or mod" on community_posts
  for delete using (
    auth.uid() = user_id
    or is_admin(auth.uid())
    or (is_moderator(auth.uid()) and not is_mod_protected(user_id))
  );

drop policy if exists "replies delete own or mod" on community_replies;
create policy "replies delete own or mod" on community_replies
  for delete using (
    auth.uid() = user_id
    or is_admin(auth.uid())
    or (is_moderator(auth.uid()) and not is_mod_protected(user_id))
  );

-- ---------- 4. private chat: founder powers stay founder-only ----------
-- Every one of these said `is_moderator(auth.uid())` and was written
-- back when that could only mean a founder. They now say is_admin(),
-- which is exactly the same set of people as before this migration —
-- no behaviour change for Poco/Astha, it just stops a newly granted
-- moderator from inheriting all of it.

drop policy if exists "private channels read member or founder" on private_channels;
create policy "private channels read member or founder" on private_channels
  for select using (is_private_channel_member(id) or is_admin(auth.uid()));

drop policy if exists "private channels insert founder only" on private_channels;
create policy "private channels insert founder only" on private_channels
  for insert with check (is_admin(auth.uid()) and created_by = auth.uid());

drop policy if exists "private channels update founder only" on private_channels;
create policy "private channels update founder only" on private_channels
  for update using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

drop policy if exists "private channels delete founder only" on private_channels;
create policy "private channels delete founder only" on private_channels
  for delete using (is_admin(auth.uid()));

drop policy if exists "private members read member or founder" on private_channel_members;
create policy "private members read member or founder" on private_channel_members
  for select using (is_private_channel_member(channel_id) or is_admin(auth.uid()));

drop policy if exists "private members insert founder only" on private_channel_members;
create policy "private members insert founder only" on private_channel_members
  for insert with check (is_admin(auth.uid()));

drop policy if exists "private members delete founder or self" on private_channel_members;
create policy "private members delete founder or self" on private_channel_members
  for delete using (is_admin(auth.uid()) or user_id = auth.uid());

drop policy if exists "private messages read members only" on private_messages;
create policy "private messages read members only" on private_messages
  for select using (is_private_channel_member(channel_id) or is_admin(auth.uid()));

drop policy if exists "private messages insert own if member" on private_messages;
create policy "private messages insert own if member" on private_messages
  for insert with check (
    auth.uid() = user_id
    and (is_private_channel_member(channel_id) or is_admin(auth.uid()))
  );

-- The one genuinely new power: a moderator may delete other people's
-- messages in a private channel they were actually added to, and only
-- if the author isn't a founder/admin. No membership = no reach; this
-- is what keeps "the chat of founders" out of a mod's hands even when
-- a founder is talking in a channel the mod belongs to.
drop policy if exists "private messages delete own or founder" on private_messages;
create policy "private messages delete own or founder" on private_messages
  for delete using (
    auth.uid() = user_id
    or is_admin(auth.uid())
    or (
      is_moderator(auth.uid())
      and is_private_channel_member(channel_id)
      and not is_mod_protected(user_id)
    )
  );

-- Image blobs follow the same rule as the rows they belong to. Path is
-- `${channel_id}/${uploader_id}/${uuid}.ext`, so segment 2 is the author.
drop policy if exists "private chat images delete own or founder" on storage.objects;
create policy "private chat images delete own or founder" on storage.objects
  for delete using (
    bucket_id = 'private-chat-images'
    and (
      auth.uid()::text = (storage.foldername(name))[2]
      or is_admin(auth.uid())
      or (
        is_moderator(auth.uid())
        and not is_mod_protected(((storage.foldername(name))[2])::uuid)
      )
    )
  );

-- Directory of all 241 users stays founder-only — a mod moderates what
-- is in front of them, they don't get a roster of everyone.
create or replace function get_private_chat_directory() returns table(user_id uuid, name text, mascot text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'not_authorized: founders only';
  end if;
  return query
    select p.user_id, p.name, p.mascot
    from profiles p
    where coalesce(p.community_opt_out, false) = false
      and p.user_id <> auth.uid()
    order by p.name asc;
end;
$$;
revoke all on function get_private_chat_directory() from public;
grant execute on function get_private_chat_directory() to authenticated;

-- ---------- 5. granting the role (run by hand, service role only) ----------
-- There is still no insert/update policy on user_roles for the client,
-- so this only ever runs in the SQL editor. Find the user first:
--   select user_id, name from profiles where name ilike '%<name>%';
-- Then:
--   insert into user_roles (user_id, role) values
--     ('00000000-0000-0000-0000-000000000000', 'moderator')
--   on conflict (user_id) do update set role = excluded.role;
--
-- Demote back to a normal member:
--   update user_roles set role = 'user' where user_id = '<uuid>';
--
-- Check who holds what:
--   select r.role, p.name from user_roles r
--     join profiles p on p.user_id = r.user_id
--    where r.role <> 'user' order by r.role, p.name;
--
-- Badges are cached per page load in the client, so a promotion shows
-- up for everyone else on their next refresh.
