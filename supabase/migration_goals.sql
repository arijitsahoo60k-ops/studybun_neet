-- ============================================================
-- Migration: Goals journal — user-created goals table
-- ============================================================
-- Run this on any existing StudyBun project that was set up
-- before the Goals feature existed. Brand-new projects should
-- just run schema.sql instead — it already creates this table.
--
-- This migration:
--   1. Creates goals (freeform, one-goal-per-journal-page table).
--   2. Enables RLS + realtime for it.
-- ============================================================

create table if not exists goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  deadline date,
  starred boolean not null default false,
  notes text,
  status text not null default 'Active', -- Active, Completed
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_goals_user on goals(user_id, status);

alter table goals enable row level security;
drop policy if exists "user access" on goals;
create policy "user access" on goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'goals'
  ) then
    alter publication supabase_realtime add table goals;
  end if;
end $$;
