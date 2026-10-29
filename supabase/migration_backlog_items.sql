-- ============================================================
-- Migration: Backlog rework — user-created backlog_items
-- ============================================================
-- Only run this if you already ran an OLDER schema.sql that
-- created the "backlog" table (chapter-derived analytics
-- snapshots, unused by the app). Brand-new projects should just
-- run schema.sql instead — it already creates backlog_items.
--
-- This migration:
--   1. Creates backlog_items (the new, freeform backlog table).
--   2. Enables RLS + realtime for it.
--   3. Drops the old, unused "backlog" table.
--
-- The old "backlog" table was never read from or written to by
-- the app, so dropping it does not lose any real user data. If
-- you added your own rows to it manually, export first
-- (Table Editor → backlog → Export CSV).
-- ============================================================

create table if not exists backlog_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text not null default 'Other',
  category text not null default 'Custom',
  status text not null default 'Not Started',
  deadline date,
  estimated_amount numeric,
  estimated_unit text default 'hours',
  notes text,
  reason text,
  reason_custom text,
  in_session boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_backlog_items_user on backlog_items(user_id, status);

alter table backlog_items enable row level security;
drop policy if exists "user access" on backlog_items;
create policy "user access" on backlog_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'backlog_items'
  ) then
    alter publication supabase_realtime add table backlog_items;
  end if;
end $$;

drop table if exists backlog;
