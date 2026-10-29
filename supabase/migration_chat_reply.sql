-- ============================================================
-- Migration: Community chat — reply-to-message
-- ============================================================
-- Safe to run on the existing production database — additive only,
-- idempotent, and backward-compatible with the frontend currently deployed.
-- Run this BEFORE deploying the frontend changes that read/write these columns.

-- ---------- 1. new columns on community_messages ----------
alter table community_messages
  add column if not exists reply_to_id uuid,
  add column if not exists reply_to_user_id uuid,
  add column if not exists reply_to_name text,
  add column if not exists reply_to_content text;

-- Deliberately NOT a foreign key with ON DELETE SET NULL: we need to null
-- reply_to_id AND reply_to_content together, atomically, whenever the
-- original message is removed (see trigger below) — a plain FK cascade
-- can only null the FK column itself, not the content snapshot next to
-- it, and mixing our own trigger with a competing FK-driven cascade on
-- the same column risks an ordering race. This trigger is the single
-- source of truth for cleaning up reply_to_* on deletion.
create index if not exists idx_community_messages_reply_to on community_messages(reply_to_id);

-- ---------- 2. extend the existing insert guard: reply must be same-channel ----------
create or replace function community_messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  recent_count int;
  last_content text;
  last_at timestamptz;
begin
  select count(*) into recent_count
  from community_messages
  where user_id = NEW.user_id and created_at > now() - interval '60 seconds';
  if recent_count >= 12 then
    raise exception 'rate_limited: too many messages, slow down a little';
  end if;

  select content, created_at into last_content, last_at
  from community_messages
  where user_id = NEW.user_id
  order by created_at desc
  limit 1;

  if last_content is not null and last_content = NEW.content and last_at > now() - interval '20 seconds' then
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

-- ---------- 3. scrub quoted snapshots when the original is removed ----------
-- Fires on self-delete, moderator delete, AND the 5-day expiry cron
-- (api/cron/community-cleanup.js) — all of them go through a real
-- DELETE on this table, so this trigger covers every path uniformly.
create or replace function scrub_reply_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update community_messages
     set reply_to_id = null,
         reply_to_content = null
   where reply_to_id = OLD.id;
  return OLD;
end;
$$;

drop trigger if exists trg_scrub_reply_snapshot on community_messages;
create trigger trg_scrub_reply_snapshot
  after delete on community_messages
  for each row execute function scrub_reply_snapshot();
