-- ============================================================
-- StudyBun AI (AI Insights page) persistence.
--
-- One row per user holding the *last* generated AI Insights result.
-- Same single-row-cache pattern as mock_ai_comparison -- the page
-- only ever needs "what did the AI last say", and this is what
-- makes that survive a page nav, refresh, or switching devices on
-- the same account, instead of living only in local useState (which
-- was the bug: it vanished the moment you left the AI Insights page
-- or reloaded). ai_insights_history stays as-is as an append-only
-- log; this table is the "current" cache the page reads on load.
--
-- Overwritten only when the student explicitly clicks "Generate AI
-- Insights" again; a failed re-run leaves the last good result
-- untouched.
--
-- Safe to run standalone against an existing DB -- also folded
-- into schema.sql for fresh installs.
-- ============================================================

create table if not exists ai_insights (
  user_id uuid primary key references auth.users(id) on delete cascade,
  result jsonb,
  generated_at timestamptz,
  updated_at timestamptz default now()
);

alter table ai_insights enable row level security;
drop policy if exists "device access" on ai_insights;
drop policy if exists "user access" on ai_insights;
create policy "user access" on ai_insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ai_insights'
  ) then
    alter publication supabase_realtime add table ai_insights;
  end if;
end $$;
