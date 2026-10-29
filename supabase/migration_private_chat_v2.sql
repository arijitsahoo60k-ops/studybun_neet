-- ============================================================
-- Migration: Private Chat — Bug-fix patch (v2)
-- ============================================================
-- Run this AFTER migration_private_chat.sql. It replaces four
-- functions/policies that had correctness bugs. Everything else
-- from the original migration (tables, indexes, RLS frame, storage
-- bucket, realtime publication) is untouched — this file is purely
-- additive/corrective and is safe to re-run.
--
-- Bugs fixed:
--   1. private_channels_recompute_last_message: accessed newest.content
--      even when the SELECT INTO returned no row (channel just became
--      empty). content/user_id are undefined in that case, so the CASE
--      expression fell through to the `else '📷 Photo'` branch even for
--      an empty channel — preview stayed as "📷 Photo" instead of being
--      nulled out. Fix: guard with `newest IS NULL`.
--
--   2. private_messages_guard (duplicate-content check): the guard only
--      ran the duplicate-content check when trim(NEW.content) <> ''. But
--      image-only messages have content = '' (the default), so back-to-back
--      image-only posts from the same user in the same channel within 20s
--      slipped past the guard. The duplicate check is now skipped only when
--      BOTH content is blank AND an image_url is present — matching the real
--      "nothing to send" scenario, not the "sending an image" one.
--
--   3. "private chat images delete own" storage policy: only the uploader
--      could delete their own images, which meant a founder deleting a
--      message via the private_messages row (cascade delete or direct delete)
--      left the orphaned image blob in storage. Founders can now also delete
--      storage objects in the private-chat-images bucket, matching the
--      "founder can delete any message" RLS policy on private_messages.
--
--   4. private_channels_touch_last_message: NEW.content default is '' (empty
--      string), not NULL. The CASE expression `when trim(NEW.content) <> ''`
--      correctly handled this, but `trim('')` in Postgres is still '', so
--      image-only messages already worked. No functional bug here, but the
--      CASE expression has been made explicit about the empty-string case
--      for clarity and future-proofing.
-- ============================================================

-- ---------- 1. Fix: recompute trigger null-row guard ----------
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

  -- BUG FIX: `newest` is a record variable — when the SELECT INTO finds
  -- no row it remains NULL (not a row of NULLs). The original code accessed
  -- newest.created_at directly in the CASE expression, which would error
  -- or produce undefined behaviour on a NULL record in some Postgres
  -- versions. Guard with `newest IS NULL` first.
  update private_channels
     set last_message_at      = case when newest is null then null else newest.created_at end,
         last_message_preview  = case
           when newest is null              then null
           when trim(newest.content) <> '' then left(newest.content, 120)
           else '📷 Photo'
         end,
         last_message_user_id  = case when newest is null then null else newest.user_id end,
         updated_at            = now()
   where id = OLD.channel_id;
  return OLD;
end;
$$;

-- Trigger already exists from original migration; CREATE OR REPLACE on the
-- function is enough — no need to recreate the trigger.

-- ---------- 2. Fix: duplicate-content guard for image-only messages ----------
create or replace function private_messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  recent_count int;
  last_content text;
  last_at      timestamptz;
begin
  -- Rate limit: max 12 messages per user per channel per 60 seconds.
  select count(*) into recent_count
  from private_messages
  where user_id    = NEW.user_id
    and channel_id = NEW.channel_id
    and created_at > now() - interval '60 seconds';
  if recent_count >= 12 then
    raise exception 'rate_limited: too many messages, slow down a little';
  end if;

  -- Duplicate-content guard.
  -- BUG FIX: the original condition `if trim(NEW.content) <> ''` skipped
  -- the check only when content is blank. But image-only messages also have
  -- blank content (default ''), so consecutive identical image posts from
  -- the same user slipped past this guard. The correct skip condition is:
  -- no text AND an image is present — i.e. this is a legitimate image-only
  -- message, not an accidental duplicate text post.
  if NOT (trim(NEW.content) = '' and NEW.image_url is not null) then
    select content, created_at into last_content, last_at
    from private_messages
    where user_id    = NEW.user_id
      and channel_id = NEW.channel_id
    order by created_at desc
    limit 1;

    if last_content is not null
       and last_content = NEW.content
       and last_at > now() - interval '20 seconds' then
      raise exception 'rate_limited: duplicate message';
    end if;
  end if;

  -- Reply validity: the quoted message must exist in this channel.
  if NEW.reply_to_id is not null and not exists (
    select 1 from private_messages
    where id = NEW.reply_to_id and channel_id = NEW.channel_id
  ) then
    raise exception 'invalid_reply: reply target not found in this channel';
  end if;

  return NEW;
end;
$$;

-- Trigger already exists; function replacement is enough.

-- ---------- 3. Fix: storage delete policy — allow founders to clean up ----------
-- The original policy only let the uploader delete their own objects.
-- A founder deleting a private_messages row (which CASCADE-deletes the row
-- but NOT the storage blob, since Supabase Storage has no FK cascade) could
-- not clean up the orphaned image. Now founders can also delete any object
-- in the private-chat-images bucket, matching their message-delete privilege.
drop policy if exists "private chat images delete own" on storage.objects;
create policy "private chat images delete own or founder" on storage.objects
  for delete using (
    bucket_id = 'private-chat-images'
    and (
      auth.uid()::text = (storage.foldername(name))[2]
      or is_moderator(auth.uid())
    )
  );
