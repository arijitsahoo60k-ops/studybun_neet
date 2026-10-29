-- ============================================================
-- Smart AI Comparison persistence (Mock Tests page).
--
-- One row per user holding the *last* Smart AI Comparison result.
-- Deliberately a single-row cache (like user_statistics), not a
-- history log like ai_insights_history -- the feature only ever
-- needs "what did the AI last say", and this table is what makes
-- that survive switching devices/browsers on the same account,
-- not just localStorage on one device. Overwritten only when the
-- student explicitly clicks "Compare with AI" again; a failed
-- re-run leaves the last good result untouched.
--
-- Safe to run standalone against an existing DB -- also folded
-- into schema.sql for fresh installs.
-- ============================================================

create table if not exists mock_ai_comparison (
  user_id uuid primary key references auth.users(id) on delete cascade,
  result jsonb,
  updated_at timestamptz default now()
);

alter table mock_ai_comparison enable row level security;
drop policy if exists "device access" on mock_ai_comparison;
drop policy if exists "user access" on mock_ai_comparison;
create policy "user access" on mock_ai_comparison
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'mock_ai_comparison'
  ) then
    alter publication supabase_realtime add table mock_ai_comparison;
  end if;
end $$;
