-- ============================================================
-- Migration: Community chat images
-- ============================================================
-- Adds image sharing to community_messages (chat).
-- Run after migration_community.sql (and after
-- migration_community_chat_fixes_v2.sql / _v3.sql, since this migration
-- re-replaces community_messages_guard() on top of the v2 body).
-- Safe to re-run.
--
-- Design decisions:
--   • image_url is nullable — text-only messages are unaffected.
--   • content stays validated the same way (non-empty, <= 1000 chars)
--     for text messages, but the table-level check is relaxed to also
--     allow image-only messages (content = '' when an image is attached).
--   • Storage bucket: community-chat-images  (public read,
--     uploader-scoped writes, 8 MB limit, same as post images).
-- ============================================================

-- ---------- 1. Add image_url column ----------
alter table community_messages add column if not exists image_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'community_messages_image_url_len') then
    alter table community_messages
      add constraint community_messages_image_url_len
      check (image_url is null or char_length(image_url) <= 600) not valid;
  end if;
end $$;

-- Relax the original content check so image-only messages (empty string
-- content + non-null image_url) are allowed.
--
-- BUG FIX: the original inline `check (char_length(trim(content)) > 0 and
-- char_length(content) <= 1000)` in migration_community.sql was unnamed,
-- so Postgres auto-named it `community_messages_content_check` (its
-- convention for a single-column check is `<table>_<column>_check`).
-- The first version of this migration tried to find that constraint by
-- matching `pg_get_constraintdef(oid) like '%char_length(trim(content))
-- > 0%'` — but Postgres reformats stored expressions when it reconstructs
-- them (`trim(content)` comes back as `TRIM(BOTH FROM content)`), so that
-- literal-text pattern never matched anything. `v_conname` stayed null,
-- the drop was skipped, and the old constraint kept rejecting every
-- image-only insert (content = '') even after this migration "succeeded".
--
-- Fixed by finding the constraint via its column reference (conkey)
-- instead of matching against reformatted expression text: any CHECK
-- constraint whose *only* column is `content` is the old one, regardless
-- of its name or how Postgres re-renders the expression. This is also
-- naturally safe against dropping our own replacement below, since that
-- constraint's conkey covers two columns (content, image_url), not one.
do $$
declare
  v_content_attnum smallint;
  v_conname        text;
begin
  select attnum into v_content_attnum
  from pg_attribute
  where attrelid = 'community_messages'::regclass
    and attname = 'content'
    and not attisdropped;

  for v_conname in
    select conname
    from pg_constraint
    where conrelid = 'community_messages'::regclass
      and contype = 'c'
      and conkey = array[v_content_attnum]
  loop
    execute format('alter table community_messages drop constraint %I', v_conname);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'community_messages'::regclass
      and conname = 'community_messages_content_or_image'
  ) then
    alter table community_messages
      add constraint community_messages_content_or_image
      check (
        (char_length(trim(content)) > 0 and char_length(content) <= 1000)
        or image_url is not null
      ) not valid;
  end if;
end $$;

-- ---------- 2. Storage bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-chat-images',
  'community-chat-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------- 3. Storage RLS ----------
-- Objects stored at `${auth.uid()}/${uuid}.ext` — first segment is
-- the uploader's own user id. Mirrors community-post-images policies.

drop policy if exists "community chat images public read" on storage.objects;
create policy "community chat images public read" on storage.objects
  for select using (bucket_id = 'community-chat-images');

drop policy if exists "community chat images insert own" on storage.objects;
create policy "community chat images insert own" on storage.objects
  for insert with check (
    bucket_id = 'community-chat-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "community chat images delete own" on storage.objects;
create policy "community chat images delete own" on storage.objects
  for delete using (
    bucket_id = 'community-chat-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---------- 4. Fix the duplicate-message guard for image-only messages ----------
-- BUG FIX: community_messages_guard() (as of migration_community_chat_fixes_v2.sql)
-- compares NEW.content to the same user's last message in the same channel
-- to block rapid identical sends within 20 seconds. Image-only messages all
-- have content = '' (empty string), so sending two different photos back to
-- back in the same channel within 20 seconds tripped this as a false-positive
-- "duplicate message" — even though the images themselves are different.
--
-- Fixed by only running the duplicate-content check when the new message
-- actually has non-empty text content. Image-only sends skip that check
-- entirely; the burst rate limit (12 msgs/60s) and reply-target validation
-- below are unchanged and still apply to every insert, image or not.
create or replace function community_messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  recent_count int;
  last_content text;
  last_at      timestamptz;
begin
  select count(*) into recent_count
  from community_messages
  where user_id = NEW.user_id
    and channel_id = NEW.channel_id
    and created_at > now() - interval '60 seconds';
  if recent_count >= 12 then
    raise exception 'rate_limited: too many messages, slow down a little';
  end if;

  if trim(NEW.content) <> '' then
    select content, created_at into last_content, last_at
    from community_messages
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
    select 1 from community_messages
    where id = NEW.reply_to_id and channel_id = NEW.channel_id
  ) then
    raise exception 'invalid_reply: reply target not found in this channel';
  end if;

  return NEW;
end;
$$;
-- trigger trg_community_messages_guard already exists and points at this
-- function — CREATE OR REPLACE is enough, no need to re-create the trigger.
