-- ============================================================
-- Migration: Daily question target
-- ============================================================
-- Safe to re-run (idempotent) — same pattern as the other
-- migrations in this folder.
--
-- What this adds:
--   • profiles.daily_question_target — mirrors the existing
--     `daily_goal` (daily study-hours target) column, but for the
--     number of questions the student wants to solve each day.
--     Editable in Settings, shown/tracked in Question Practice's
--     "Today's pulse" card, Dashboard, and Daily Recap.
--   • Existing rows get the same default (50) new signups get via
--     the app's useDeviceRow default, so nobody's card silently
--     shows "0 / 0" the moment this migration runs.
-- ============================================================

alter table profiles
  add column if not exists daily_question_target int not null default 50;
