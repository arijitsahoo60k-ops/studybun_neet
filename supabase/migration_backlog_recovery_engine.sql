-- ============================================================
-- Migration: Backlog → JEE Recovery Engine
-- ============================================================
-- Evolves the existing `backlog_items` table (rather than adding a
-- parallel table) so the recovery queue and the manual backlog share
-- one CRUD surface, one realtime channel, and one history view.
--
-- Generated recovery cards ("Rotational Motion — Concept gap") are
-- computed fresh on every render from mock_tests + mock_analysis +
-- revision_plans (see src/lib/recoveryEngine.js) — nothing about the
-- *evidence* is stored here. The only things persisted per generated
-- item are the parts that represent a user's own action on it:
-- status (Open/In Progress/Recovered/Dismissed, reusing the existing
-- `status` column), whether it's in today's session, and a temporary
-- dismissal window. `source_key` is the stable dedup identity
-- ("physics::rotational motion::concept_gap") so re-computing the
-- queue on every mock save never creates a duplicate row — it's
-- looked up and upserted instead.
--
-- Safe to run multiple times.
-- ============================================================

alter table backlog_items
  add column if not exists source_type text not null default 'manual',        -- manual | mock_analysis | revision | pacing
  add column if not exists source_key text,                                    -- stable dedup identity for generated items, e.g. "physics::rotational motion::concept_gap"
  add column if not exists chapter text,                                       -- chapter name this recovery item is about (generated items only)
  add column if not exists problem_type text,                                  -- concept_gap | silly_mistake | calculation_error | time_management | guesswork | revision_overdue | pacing
  add column if not exists priority_score numeric,                             -- 0-100 recovery score at last (re)computation, snapshotted for sorting/history
  add column if not exists evidence_count numeric default 1,                   -- how much evidence has been seen so far — used to detect a repeat mistake after the item was closed/dismissed
  add column if not exists last_evidence_at date,                              -- most recent mock date that contributed evidence
  add column if not exists recommended_action text,                           -- concrete next step, snapshotted at creation/update
  add column if not exists dismissed_until date;                              -- "Not now" — hides the card without deleting the underlying evidence

-- One generated recovery item per (user, source_key) — this is what makes
-- saving/editing a mock review update the existing card instead of piling
-- up duplicates.
create unique index if not exists idx_backlog_items_source_key
  on backlog_items(user_id, source_key)
  where source_key is not null;

create index if not exists idx_backlog_items_source_type on backlog_items(user_id, source_type);
