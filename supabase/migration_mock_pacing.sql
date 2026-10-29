-- ============================================================
-- Per-subject time tracking on mocks (pacing insight).
-- Safe to run standalone against an existing DB — also folded
-- into schema.sql for fresh installs.
-- ============================================================
alter table mock_tests add column if not exists physics_minutes numeric;
alter table mock_tests add column if not exists chemistry_minutes numeric;
alter table mock_tests add column if not exists math_minutes numeric;

-- ============================================================
-- One mistake-analysis row per mock (mock review / mistake-tagging flow).
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mock_analysis_mock_id_key') then
    alter table mock_analysis add constraint mock_analysis_mock_id_key unique (mock_id);
  end if;
end $$;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'mock_analysis'
  ) then
    alter publication supabase_realtime add table mock_analysis;
  end if;
end $$;

