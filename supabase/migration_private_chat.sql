-- ============================================================
-- Migration: Private Chat (founder-created, invite-only groups)
-- ============================================================
-- Safe to run on the existing production database — additive only,
-- idempotent (create-if-not-exists / drop-if-exists-then-create).
-- Run this BEFORE deploying the frontend changes that read/write these
-- tables.
--
-- Depends on migration_community.sql (is_moderator(), is_blocked_by_viewer
-- pattern) and migration_founder_tag.sql (founder role => is_moderator()
-- true). Run those first if you haven't already.
--
-- Design decisions:
--   • Reuses the existing role system instead of inventing a new one —
--     "founder" already implies full moderation power via is_moderator(),
--     so channel create/rename/delete/add-member/remove-member/delete-any-
--     message are all gated on is_moderator(auth.uid()), same function
--     the rest of Community already trusts. Any founder (Poco, Astha, or
--     anyone else granted the role later) can manage ANY private channel,
--     not just ones they personally created — matches a shared-admin
--     model rather than a single-owner one.
--   • Membership is the read boundary: a plain member only ever sees
--     channels they've been explicitly added to. A founder sees every
--     private channel regardless of membership (the `or is_moderator(...)`
--     clause on every select policy below) — same "founders can see
--     everything" shape as the rest of Community's moderation tools.
--   • No 5-day expiry (unlike community_messages) — these are
--     intentional, invite-only groups, not a public firehose that needs
--     pruning for clutter's sake.
--   • last_message_* columns on private_channels are a denormalized
--     cache, kept in sync by trigger on private_messages insert/delete.
--     Lets the channel list render WhatsApp-style previews with one
--     cheap query instead of a per-channel latest-message join.
--   • Images: private-chat-images bucket, same public-read /
--     uploader-scoped-write shape as community-chat-images, just at a
--     private-channel path (`${channel_id}/${uploader_id}/${uuid}.ext`).
--     NOTE — this is a deliberate v1 tradeoff, not an oversight: bucket
--     objects are technically fetchable by URL by anyone who has the
--     exact (random, unguessable) URL, same security model already
--     accepted for community-chat-images. The private_messages ROWS
--     (who's in the chat, what was said, replies) are fully
--     membership-gated by RLS — only the image blob itself has this
--     "unlisted, not unreadable" property. Fine for a v1; a signed-URL
--     upgrade (fetch a fresh time-limited URL per render instead of
--     storing a permanent public one) is a clean follow-up if you want
--     stricter guarantees later, without any schema change.
-- ============================================================

-- ---------- 1. channels ----------
create table if not exists private_channels (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_preview text,
  last_message_user_id uuid
);
create index if not exists idx_private_channels_last_message on private_channels(last_message_at desc nulls last);

-- ---------- 2. membership ----------
create table if not exists private_channel_members (
  channel_id uuid not null references private_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists idx_private_channel_members_user on private_channel_members(user_id);

create or replace function is_private_channel_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from private_channel_members where channel_id = cid and user_id = auth.uid()
  );
$$;
revoke all on function is_private_channel_member(uuid) from public;
grant execute on function is_private_channel_member(uuid) to authenticated;

-- ---------- 3. channels RLS ----------
alter table private_channels enable row level security;

drop policy if exists "private channels read member or founder" on private_channels;
create policy "private channels read member or founder" on private_channels
  for select using (
    is_private_channel_member(id) or is_moderator(auth.uid())
  );

drop policy if exists "private channels insert founder only" on private_channels;
create policy "private channels insert founder only" on private_channels
  for insert with check (is_moderator(auth.uid()) and created_by = auth.uid());

drop policy if exists "private channels update founder only" on private_channels;
create policy "private channels update founder only" on private_channels
  for update using (is_moderator(auth.uid())) with check (is_moderator(auth.uid()));

drop policy if exists "private channels delete founder only" on private_channels;
create policy "private channels delete founder only" on private_channels
  for delete using (is_moderator(auth.uid()));

-- ---------- 4. membership RLS ----------
alter table private_channel_members enable row level security;

drop policy if exists "private members read member or founder" on private_channel_members;
create policy "private members read member or founder" on private_channel_members
  for select using (
    is_private_channel_member(channel_id) or is_moderator(auth.uid())
  );

drop policy if exists "private members insert founder only" on private_channel_members;
create policy "private members insert founder only" on private_channel_members
  for insert with check (is_moderator(auth.uid()));

-- Delete covers both "founder removes someone" and "member leaves
-- themself" — either is allowed, nothing else is.
drop policy if exists "private members delete founder or self" on private_channel_members;
create policy "private members delete founder or self" on private_channel_members
  for delete using (is_moderator(auth.uid()) or user_id = auth.uid());

-- ---------- 5. messages ----------
create table if not exists private_messages (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid not null references private_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  image_url text,
  created_at timestamptz not null default now(),
  reply_to_id uuid,
  reply_to_user_id uuid,
  reply_to_name text,
  reply_to_content text,
  check (
    (char_length(trim(content)) > 0 and char_length(content) <= 1000)
    or image_url is not null
  ),
  check (image_url is null or char_length(image_url) <= 600)
);
create index if not exists idx_private_messages_channel on private_messages(channel_id, created_at desc);
create index if not exists idx_private_messages_user on private_messages(user_id, created_at desc);
create index if not exists idx_private_messages_reply_to on private_messages(reply_to_id);

-- DELETE events need the full old row (see migration_community_chat_fixes.sql's
-- identical fix for community_messages) or Realtime's channel_id filter on
-- the DELETE event never matches and other members never see the message
-- disappear.
alter table private_messages replica identity full;

alter table private_messages enable row level security;

drop policy if exists "private messages read members only" on private_messages;
create policy "private messages read members only" on private_messages
  for select using (
    is_private_channel_member(channel_id) or is_moderator(auth.uid())
  );

drop policy if exists "private messages insert own if member" on private_messages;
create policy "private messages insert own if member" on private_messages
  for insert with check (
    auth.uid() = user_id
    and (is_private_channel_member(channel_id) or is_moderator(auth.uid()))
  );

drop policy if exists "private messages delete own or founder" on private_messages;
create policy "private messages delete own or founder" on private_messages
  for delete using (auth.uid() = user_id or is_moderator(auth.uid()));

-- ---------- 6. insert guard: rate limit + reply validity (per channel) ----------
create or replace function private_messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  recent_count int;
  last_content text;
  last_at      timestamptz;
begin
  select count(*) into recent_count
  from private_messages
  where user_id = NEW.user_id
    and channel_id = NEW.channel_id
    and created_at > now() - interval '60 seconds';
  if recent_count >= 12 then
    raise exception 'rate_limited: too many messages, slow down a little';
  end if;

  if trim(NEW.content) <> '' then
    select content, created_at into last_content, last_at
    from private_messages
    where user_id = NEW.user_id
      and channel_id = NEW.channel_id
    order by created_at desc
    limit 1;

    if last_content is not null
       and last_content = NEW.content
       and last_at > now() - interval '20 seconds' then
      raise exception 'rate_limited: duplicate message';
    end if;
  end if;

  if NEW.reply_to_id is not null and not exists (
    select 1 from private_messages
    where id = NEW.reply_to_id and channel_id = NEW.channel_id
  ) then
    raise exception 'invalid_reply: reply target not found in this channel';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_private_messages_guard on private_messages;
create trigger trg_private_messages_guard
  before insert on private_messages
  for each row execute function private_messages_guard();

-- ---------- 7. scrub quoted snapshots when the original is removed ----------
create or replace function scrub_private_reply_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update private_messages
     set reply_to_id = null,
         reply_to_content = null
   where reply_to_id = OLD.id;
  return OLD;
end;
$$;

drop trigger if exists trg_scrub_private_reply_snapshot on private_messages;
create trigger trg_scrub_private_reply_snapshot
  after delete on private_messages
  for each row execute function scrub_private_reply_snapshot();

-- ---------- 8. keep private_channels.last_message_* in sync ----------
create or replace function private_channels_touch_last_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update private_channels
     set last_message_at = NEW.created_at,
         last_message_preview = case
           when trim(NEW.content) <> '' then left(NEW.content, 120)
           else '📷 Photo'
         end,
         last_message_user_id = NEW.user_id,
         updated_at = now()
   where id = NEW.channel_id;
  return NEW;
end;
$$;

drop trigger if exists trg_private_channels_touch_last_message on private_messages;
create trigger trg_private_channels_touch_last_message
  after insert on private_messages
  for each row execute function private_channels_touch_last_message();

-- When the message that's currently the cached preview gets deleted,
-- recompute from whatever's left (or null it out if the channel is now
-- empty). Cheap in practice — private groups don't run into the message
-- volume that would make this a real per-delete cost.
create or replace function private_channels_recompute_last_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  newest record;
begin
  select content, created_at, user_id into newest
  from private_messages
  where channel_id = OLD.channel_id
  order by created_at desc
  limit 1;

  update private_channels
     set last_message_at = newest.created_at,
         last_message_preview = case
           when newest.created_at is null then null
           when trim(newest.content) <> '' then left(newest.content, 120)
           else '📷 Photo'
         end,
         last_message_user_id = newest.user_id,
         updated_at = now()
   where id = OLD.channel_id;
  return OLD;
end;
$$;

drop trigger if exists trg_private_channels_recompute_last_message on private_messages;
create trigger trg_private_channels_recompute_last_message
  after delete on private_messages
  for each row execute function private_channels_recompute_last_message();

-- ---------- 9. founder-only user directory (for the "add members" picker) ----------
-- Deliberately narrow — just user_id/name/mascot, same shape as
-- get_community_profiles — and gated to founders/moderators only. Regular
-- members never get a full user list; they only ever see the members
-- already in a channel they're part of (via private_channel_members +
-- get_community_profiles). Respects community_opt_out the same way the
-- rest of Community does.
create or replace function get_private_chat_directory() returns table(user_id uuid, name text, mascot text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_moderator(auth.uid()) then
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

-- ---------- 10. storage bucket for private chat images ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-chat-images',
  'private-chat-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Objects stored at `${channel_id}/${uploader_id}/${uuid}.ext`. Read is
-- public (see the note in the header comment above re: the v1 tradeoff);
-- write is restricted to actual members of that channel, uploading only
-- into their own sub-folder.
drop policy if exists "private chat images public read" on storage.objects;
create policy "private chat images public read" on storage.objects
  for select using (bucket_id = 'private-chat-images');

-- `or is_moderator(...)` mirrors the same override on the private_messages
-- insert policy above — a founder can already post text in a channel they
-- weren't explicitly added to (shared-admin model), so image uploads need
-- the identical override or a founder could message but not attach a photo
-- in a channel they don't have a membership row for.
drop policy if exists "private chat images insert own if member" on storage.objects;
create policy "private chat images insert own if member" on storage.objects
  for insert with check (
    bucket_id = 'private-chat-images'
    and auth.uid()::text = (storage.foldername(name))[2]
    and (
      is_private_channel_member(((storage.foldername(name))[1])::uuid)
      or is_moderator(auth.uid())
    )
  );

drop policy if exists "private chat images delete own" on storage.objects;
create policy "private chat images delete own" on storage.objects
  for delete using (
    bucket_id = 'private-chat-images'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

-- ---------- 11. realtime ----------
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'private_channels', 'private_channel_members', 'private_messages'
  ])
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I;', t);
    end if;
  end loop;
end $$;

-- ---------- 12. drop the old, over-exposed is_private_channel_member ----------
-- Security fix: the original signature took an arbitrary `uid uuid` second
-- argument. Every real call site (all the policies and the storage check
-- above) always passed `auth.uid()` for it — but because the function also
-- had to be `grant execute ... to authenticated` for RLS to work, Supabase's
-- API layer exposed it as a directly callable RPC too, with NO restriction
-- on which uid a caller could ask about. Any logged-in user could call
-- `is_private_channel_member(<any channel>, <any other user>)` and use it as
-- a membership oracle for channels/people they have no business knowing
-- about — the entire opposite of "invite-only, invisible to non-members."
-- Fixed above by dropping the `uid` argument entirely and always checking
-- auth.uid() internally, matching every real call site's behavior exactly.
-- This drop only runs down here, AFTER every policy that references the
-- function has already been switched to the new signature (all the
-- `drop policy` / `create policy` pairs above) — dropping it any earlier
-- would fail with "cannot drop function ... because other objects depend on
-- it" on a database where the original (vulnerable) migration already ran.
drop function if exists is_private_channel_member(uuid, uuid);
