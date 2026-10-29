-- ============================================================
-- Migration: device_id -> Supabase Auth (user_id)
-- ============================================================
-- Only run this if you already ran the OLD schema.sql (the one
-- scoped by a random per-device UUID) against this Supabase
-- project. Brand-new projects should just run schema.sql instead
-- — it already creates everything with user_id from the start.
--
-- IMPORTANT — READ FIRST:
-- Old rows are keyed by a random device_id that has no
-- relationship to any real auth.users row, so there is no
-- automatic way to hand that old data to a specific signed-up
-- account. This migration clears existing app data as part of
-- switching the columns over to a real user_id foreign key. If
-- you need to keep the old data, export it first (Table Editor
-- → each table → Export CSV) and re-import it manually per user
-- after they sign up, matching rows to their new auth.uid().
-- ============================================================

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'profiles','user_settings','study_sessions','timer_sessions',
      'syllabus_subjects','syllabus_chapters','chapter_progress','backlog',
      'question_logs','mock_tests','mock_analysis','revision_plans','revision_logs',
      'tasks','achievements','notifications','ai_insights_history','user_statistics'
    ])
  loop
    -- Drop the old permissive policy so nothing is briefly wide open mid-migration.
    execute format('drop policy if exists "device access" on %I;', t);

    -- Old data can't be attributed to a real auth user — clear it before
    -- the column becomes a foreign key into auth.users (see warning above).
    execute format('delete from %I;', t);

    -- device_id -> user_id, now backed by a real foreign key.
    execute format('alter table %I rename column device_id to user_id;', t);
    execute format('alter table %I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade;', t, t || '_user_id_fkey');

    execute format('create policy "user access" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
  end loop;
end $$;

-- Rebuild the device-scoped indexes under their new names (harmless if they
-- don't exist under the old names on your project).
drop index if exists idx_study_sessions_device;
create index if not exists idx_study_sessions_user on study_sessions(user_id, session_date);
drop index if exists idx_timer_sessions_device;
create index if not exists idx_timer_sessions_user on timer_sessions(user_id, created_at);
drop index if exists idx_chapter_progress_device;
create index if not exists idx_chapter_progress_user on chapter_progress(user_id);
drop index if exists idx_question_logs_device;
create index if not exists idx_question_logs_user on question_logs(user_id, log_date);
drop index if exists idx_mock_tests_device;
create index if not exists idx_mock_tests_user on mock_tests(user_id, mock_date);
drop index if exists idx_revision_plans_device;
create index if not exists idx_revision_plans_user on revision_plans(user_id, due_date);
drop index if exists idx_tasks_device;
create index if not exists idx_tasks_user on tasks(user_id, due_date);
drop index if exists idx_ai_insights_device;
create index if not exists idx_ai_insights_user on ai_insights_history(user_id, generated_at desc);
