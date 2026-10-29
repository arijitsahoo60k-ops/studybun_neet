-- ============================================================
-- Focus Mode ambient scene preference (Focus Timer page).
--
-- One row per user holding which ambient scene they last picked in
-- Focus Mode (rain, snow, fireplace...). Single-row-per-user, same
-- shape as mock_ai_comparison / ai_insights, read and written through
-- useDeviceRow so it follows the account across devices and browsers.
-- `scene` is free text on purpose: the client validates it against the
-- current scene list and falls back to "rain" for anything unknown, so
-- adding/removing scenes never needs a migration.
--
-- Safe to run standalone against an existing DB -- also folded into
-- schema.sql for fresh installs.
-- ============================================================

create table if not exists focus_mode_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  scene text not null default 'rain',
  updated_at timestamptz default now()
);

alter table focus_mode_settings enable row level security;
drop policy if exists "device access" on focus_mode_settings;
drop policy if exists "user access" on focus_mode_settings;
create policy "user access" on focus_mode_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'focus_mode_settings'
  ) then
    alter publication supabase_realtime add table focus_mode_settings;
  end if;
end $$;
