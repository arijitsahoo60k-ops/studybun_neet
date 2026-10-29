-- ============================================================
-- Migration: Community chat fixes v2 — scope the message guard by channel
-- ============================================================
-- Safe to run on the existing production database — CREATE OR REPLACE
-- only, no schema changes, no data migration. The trigger
-- trg_community_messages_guard already points at this function, so
-- replacing the function body is enough; no need to touch the trigger.
--
-- Fixes: community_messages_guard() (added in migration_chat_reply.sql)
-- checked a user's rate limit and duplicate-message guard against their
-- last message *across every channel*, not just the channel they're
-- posting in. Concretely:
--   - Burst limit (12 msgs/60s): someone active in Physics, General, and
--     Doubts back-to-back during a study session could hit the global
--     count and get "you're sending messages too fast" even though
--     they've sent far fewer than 12 messages in any single channel.
--   - Duplicate check (same content within 20s): sending "ok" in Physics
--     then switching to General and sending "ok" there within 20 seconds
--     — a completely normal thing to do — got rejected as a duplicate,
--     because the lookup only checked the user's single most recent
--     message, not their most recent message *in that channel*.
-- Both checks now filter on `channel_id = NEW.channel_id` in addition to
-- `user_id = NEW.user_id`, so activity in one channel no longer affects
-- what's allowed in another.
-- ============================================================

create or replace function community_messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  recent_count int;
  last_content text;
  last_at timestamptz;
begin
  select count(*) into recent_count
  from community_messages
  where user_id = NEW.user_id
    and channel_id = NEW.channel_id
    and created_at > now() - interval '60 seconds';
  if recent_count >= 12 then
    raise exception 'rate_limited: too many messages, slow down a little';
  end if;

  select content, created_at into last_content, last_at
  from community_messages
  where user_id = NEW.user_id
    and channel_id = NEW.channel_id
  order by created_at desc
  limit 1;

  if last_content is not null and last_content = NEW.content
     and last_at > now() - interval '20 seconds' then
    raise exception 'rate_limited: duplicate message';
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
