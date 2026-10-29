-- ============================================================
-- Migration: Community chat fixes v3 — composite index for the guard trigger
-- ============================================================
-- Safe to run on the existing production database — adds one index,
-- nothing else. No trigger/function changes (see
-- migration_community_chat_fixes_v2.sql for that).
--
-- community_messages_guard() (as of v2) runs two SELECTs per INSERT,
-- both filtered on `user_id = NEW.user_id and channel_id = NEW.channel_id`,
-- one of them also ordering by created_at. The table already has
-- idx_community_messages_channel(channel_id, created_at desc) and
-- idx_community_messages_user(user_id, created_at desc) individually, but
-- neither covers the (user_id, channel_id, created_at) combination the
-- trigger actually filters and sorts by — Postgres can still use either
-- single-column index plus a filter step at today's volume, but a
-- composite index makes both of the trigger's lookups a direct index
-- scan instead, which matters more the bigger community_messages gets
-- before the 5-day expiry cron catches up. CREATE INDEX CONCURRENTLY
-- avoids taking a write lock on the table while it builds.
-- ============================================================

create index concurrently if not exists idx_community_messages_user_channel
  on community_messages (user_id, channel_id, created_at desc);
