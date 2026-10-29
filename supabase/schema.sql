-- ============================================================
-- StudyBun NEET — Complete Consolidated Database Schema
-- Run this once in your new Supabase project's SQL Editor.
-- Safe and idempotent: can be run on a brand-new project OR re-run
-- on an existing StudyBun database without data loss.
-- ============================================================
-- Includes:
--   1. Core StudyBun NEET tables (Profiles with PCB/PCMB & Custom Exam
--      Time Trackers, Study Sessions, Timer Sessions, Syllabus, Chapter
--      Progress, Backlog + NEET Recovery Engine, Goals, Question Logs,
--      720-Mark NEET UG Mocks [Botany/Zoology/Physics/Chemistry/Maths],
--      Mock Analysis, Revision Plans/Logs, Daily Planner Tasks, Streak
--      Freezes, Achievements, Notifications, AI Insights & Mock Compare)
--   2. Retry Idempotency tokens & Recurring Task uniqueness guards
--   3. Focus Mode & Focus Music Playlists / Tracks / Settings
--   4. Smart Push Notifications (Subscriptions, Preferences, Send Log)
--   5. Anti-cheat Leaderboard & Canonical 5-Signal Streak Engine (v3)
--   6. Roles (User / Moderator / Admin / Founder) & Mascot Locks
--   7. Community (Channels, Chat w/ Replies & Images, Read Receipts,
--      Channel Lock, Chat Bans, Personal Focus Lock, Accountability
--      Goals, Study Feed v2, Reactions, Reports, Storage Buckets)
--   8. Private Chat (Invite-only Channels, Members, Messages, Triggers)
--   9. Group Timer v2 (Public/Private Study Rooms, Stints, Host Controls,
--      Roster & IST Room Stats / Leaderboard / Streak)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. CORE TABLES
-- ============================================================

-- ---------- PROFILES ----------
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text default '',
  exam text default 'NEET UG',
  exam_date date default '2027-05-02',
  exam_time text default '14:00',
  subject_stream text default 'PCB',
  custom_exams jsonb default '[]'::jsonb,
  daily_goal numeric default 6,
  daily_question_target int not null default 50,
  theme text default 'Sakura Bloom',
  mascot text default 'bunny',
  dark_mode boolean default false,
  streak_freeze_tokens int not null default 1,
  streak_freeze_granted_days int not null default 0,
  bio text default '',
  prep_year int,
  community_opt_out boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles
  add column if not exists exam text default 'NEET UG',
  add column if not exists exam_date date default '2027-05-02',
  add column if not exists exam_time text default '14:00',
  add column if not exists subject_stream text default 'PCB',
  add column if not exists custom_exams jsonb default '[]'::jsonb,
  add column if not exists daily_goal numeric default 6,
  add column if not exists daily_question_target int not null default 50,
  add column if not exists streak_freeze_tokens int not null default 1,
  add column if not exists streak_freeze_granted_days int not null default 0,
  add column if not exists bio text default '',
  add column if not exists prep_year int,
  add column if not exists community_opt_out boolean default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_len') then
    alter table profiles add constraint profiles_bio_len check (char_length(bio) <= 160) not valid;
  end if;
end $$;

-- ---------- USER SETTINGS ----------
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notifications jsonb default '{"study":true,"revision":true,"backlog":true,"mock":true,"task":true,"water":false,"break":false}',
  timer_defaults jsonb default '{"pomodoro":25,"deepFocus":50,"shortBreak":5,"longBreak":15,"cycles":4}',
  revision_formula jsonb default '[1,3,7,14,30]',
  updated_at timestamptz default now()
);

-- ---------- STUDY SESSIONS ----------
create table if not exists study_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null default current_date,
  subject text not null,
  chapter text,
  session_type text not null, -- Lecture, Practice, Revision, Notes, Doubt Solving, Reading NCERT, PYQ Practice
  minutes numeric not null default 0,
  teacher text,
  platform text,
  notes text,
  client_token uuid,
  created_at timestamptz default now()
);
alter table study_sessions add column if not exists client_token uuid;
create index if not exists idx_study_sessions_user on study_sessions(user_id, session_date);
create unique index if not exists idx_study_sessions_user_token on study_sessions(user_id, client_token);

-- ---------- TIMER SESSIONS ----------
create table if not exists timer_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null, -- Pomodoro, Deep Focus, Lecture, Practice, Revision, Stopwatch
  planned_minutes numeric,
  actual_minutes numeric,
  completed boolean default true,
  client_token uuid,
  created_at timestamptz default now()
);
alter table timer_sessions add column if not exists client_token uuid;
create index if not exists idx_timer_sessions_user on timer_sessions(user_id, created_at);
create unique index if not exists idx_timer_sessions_user_token on timer_sessions(user_id, client_token);

-- ---------- SYLLABUS SUBJECTS / CHAPTERS ----------
create table if not exists syllabus_subjects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz default now()
);

create table if not exists syllabus_chapters (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  chapter_group text,
  chapter_name text not null,
  created_at timestamptz default now(),
  unique(user_id, subject, chapter_name)
);

-- ---------- CHAPTER PROGRESS ----------
create table if not exists chapter_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  chapter text not null,
  status text default 'Not Started', -- Not Started, Studying, Completed, Mastered
  priority text default 'Medium',    -- Low, Medium, High
  difficulty text default 'Medium',  -- Easy, Medium, Hard
  weightage numeric default 5,       -- estimated exam weightage out of 10
  lectures_total numeric default 4,
  lectures_done numeric default 0,
  dpp_pending numeric default 2,
  pyq_pending numeric default 10,
  notes_pending numeric default 1,
  deadline date,
  favorite boolean default false,
  personal_notes text default '',
  last_revised date,
  next_revision date,
  completed_at timestamptz,
  updated_at timestamptz default now(),
  unique(user_id, subject, chapter)
);
alter table chapter_progress add column if not exists completed_at timestamptz;
create index if not exists idx_chapter_progress_user on chapter_progress(user_id);
create index if not exists idx_chapter_progress_completed_at on chapter_progress(user_id, completed_at);

-- ---------- BACKLOG ITEMS & NEET RECOVERY ENGINE ----------
create table if not exists backlog_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text not null default 'Biology', -- Biology, Physics, Chemistry, Maths, Other
  category text not null default 'Custom', -- Full Chapter, Lecture, Notes, Questions, DPP, Module, Revision, Mock Analysis, Recovery, Custom
  status text not null default 'Not Started', -- Not Started, In Progress, Completed, Paused
  deadline date,
  estimated_amount numeric,
  estimated_unit text default 'hours', -- hours, sessions
  notes text,
  reason text,
  reason_custom text,
  in_session boolean not null default false,
  completed_at timestamptz,
  source_type text not null default 'manual', -- manual | mock_analysis | revision | pacing
  source_key text,
  chapter text,
  problem_type text,
  priority_score numeric,
  evidence_count numeric default 1,
  last_evidence_at date,
  recommended_action text,
  dismissed_until date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table backlog_items
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_key text,
  add column if not exists chapter text,
  add column if not exists problem_type text,
  add column if not exists priority_score numeric,
  add column if not exists evidence_count numeric default 1,
  add column if not exists last_evidence_at date,
  add column if not exists recommended_action text,
  add column if not exists dismissed_until date;

create index if not exists idx_backlog_items_user on backlog_items(user_id, status);
create unique index if not exists idx_backlog_items_source_key
  on backlog_items(user_id, source_key)
  where source_key is not null;
create index if not exists idx_backlog_items_source_type on backlog_items(user_id, source_type);

-- ---------- GOALS (journal) ----------
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

-- ---------- QUESTION LOGS ----------
create table if not exists question_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  subject text not null,
  chapter text,
  question_type text default 'NCERT', -- PYQ, NCERT, Exemplar, DPP, Coaching Module, Test Series, Book, Custom
  difficulty text default 'Medium',
  count numeric not null default 1,
  correct numeric,
  incorrect numeric,
  skipped numeric,
  time_taken_minutes numeric,
  mistake_tag text,
  mistake_tag_custom text,
  client_token uuid,
  created_at timestamptz default now()
);

alter table question_logs
  add column if not exists mistake_tag text,
  add column if not exists mistake_tag_custom text,
  add column if not exists client_token uuid;

create index if not exists idx_question_logs_user on question_logs(user_id, log_date);
create unique index if not exists idx_question_logs_user_token on question_logs(user_id, client_token);

-- ---------- MOCK TESTS (720-Mark NEET UG + Custom Exam support) ----------
create table if not exists mock_tests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mock_date date not null default current_date,
  exam_name text not null,
  provider text,
  exam_type text not null default 'NEET UG',
  input_mode text default 'counts',
  total_marks numeric default 720,
  biology_marks numeric default 0,
  botany_marks numeric default 0,
  zoology_marks numeric default 0,
  physics_marks numeric default 0,
  chemistry_marks numeric default 0,
  math_marks numeric default 0,
  -- Per-section raw counts (+4/-1 NEET UG pattern: 45 scored questions/section)
  biology_correct numeric,
  biology_incorrect numeric,
  botany_correct numeric,
  botany_incorrect numeric,
  zoology_correct numeric,
  zoology_incorrect numeric,
  physics_correct numeric,
  physics_incorrect numeric,
  chemistry_correct numeric,
  chemistry_incorrect numeric,
  math_correct numeric,
  math_incorrect numeric,
  attempted numeric,
  correct numeric,
  incorrect numeric,
  negative_marks numeric,
  percentile numeric,
  rank numeric,
  duration_minutes numeric,
  -- Per-section time spent for pacing insights
  biology_minutes numeric,
  botany_minutes numeric,
  zoology_minutes numeric,
  physics_minutes numeric,
  chemistry_minutes numeric,
  math_minutes numeric,
  notes text,
  client_token uuid,
  created_at timestamptz default now()
);

alter table mock_tests
  add column if not exists exam_type text not null default 'NEET UG',
  add column if not exists input_mode text default 'counts',
  add column if not exists biology_marks numeric default 0,
  add column if not exists botany_marks numeric default 0,
  add column if not exists zoology_marks numeric default 0,
  add column if not exists biology_correct numeric,
  add column if not exists biology_incorrect numeric,
  add column if not exists botany_correct numeric,
  add column if not exists botany_incorrect numeric,
  add column if not exists zoology_correct numeric,
  add column if not exists zoology_incorrect numeric,
  add column if not exists physics_correct numeric,
  add column if not exists physics_incorrect numeric,
  add column if not exists chemistry_correct numeric,
  add column if not exists chemistry_incorrect numeric,
  add column if not exists math_correct numeric,
  add column if not exists math_incorrect numeric,
  add column if not exists biology_minutes numeric,
  add column if not exists botany_minutes numeric,
  add column if not exists zoology_minutes numeric,
  add column if not exists physics_minutes numeric,
  add column if not exists chemistry_minutes numeric,
  add column if not exists math_minutes numeric,
  add column if not exists client_token uuid;

-- Drop any legacy JEE-only check constraint on mock_tests.exam_type
alter table mock_tests drop constraint if exists mock_tests_exam_type_check;

create index if not exists idx_mock_tests_user on mock_tests(user_id, mock_date);
create unique index if not exists idx_mock_tests_user_token on mock_tests(user_id, client_token);

-- ---------- MOCK ANALYSIS (review notes per mock) ----------
create table if not exists mock_analysis (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mock_id uuid references mock_tests(id) on delete cascade unique,
  silly_mistakes numeric default 0,
  concept_errors numeric default 0,
  calculation_errors numeric default 0,
  time_management_errors numeric default 0,
  guess_work numeric default 0,
  linked_chapters text[],
  revision_needed boolean default false,
  created_at timestamptz default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mock_analysis_mock_id_key') then
    alter table mock_analysis add constraint mock_analysis_mock_id_key unique (mock_id);
  end if;
end $$;

-- ---------- REVISION PLANS / LOGS ----------
create table if not exists revision_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  chapter text not null,
  revision_number numeric default 1,
  due_date date not null,
  status text default 'Pending', -- Pending, Completed, Skipped
  confidence text,
  completed_at timestamptz,
  created_at timestamptz default now()
);
alter table revision_plans add column if not exists completed_at timestamptz;
create index if not exists idx_revision_plans_user on revision_plans(user_id, due_date);

create table if not exists revision_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  revision_id uuid references revision_plans(id) on delete cascade,
  duration_minutes numeric,
  method text,
  completed_date date default current_date,
  notes text,
  created_at timestamptz default now()
);

-- ---------- TASKS (Daily Planner) ----------
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  subject text,
  chapter text,
  priority text default 'Medium',
  status text default 'Pending', -- Pending, Completed, Missed
  category text default 'Study',
  due_date date default current_date,
  reminder_at timestamptz,
  recurring text, -- null, Daily, Weekly, Monthly
  pinned boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_tasks_user on tasks(user_id, due_date);

-- Prevent duplicate spawned copies of a repeating task on the same day across devices
create unique index if not exists idx_tasks_recurring_copy_unique
  on tasks (user_id, description, due_date)
  where left(description, 17) = '__recurring_from:';

-- ---------- STREAK FREEZES ----------
create table if not exists streak_freezes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  frozen_date date not null,
  created_at timestamptz default now(),
  unique (user_id, frozen_date)
);
alter table streak_freezes enable row level security;
drop policy if exists "own streak freezes" on streak_freezes;
create policy "own streak freezes" on streak_freezes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_streak_freezes_user on streak_freezes(user_id, frozen_date);

create or replace function sb_recompute_streak_freeze_grants() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  real_days int;
  tokens_owed int;
  new_grants int;
  cur_tokens int;
  granted_days int;
begin
  if uid is null then return; end if;

  select count(distinct d) into real_days from (
    select session_date as d from study_sessions
      where user_id = uid and minutes >= 5 and (platform is null or platform <> 'Focus Timer')
    union
    select (created_at at time zone 'Asia/Kolkata')::date as d from timer_sessions
      where user_id = uid and completed = true and actual_minutes >= 10
    union
    select log_date as d from question_logs where user_id = uid and count >= 1
    union
    select due_date as d from tasks where user_id = uid
      group by due_date having count(*) filter (where status <> 'Completed') = 0
  ) t;

  select streak_freeze_tokens, streak_freeze_granted_days into cur_tokens, granted_days
  from profiles where user_id = uid;
  if not found then return; end if;

  tokens_owed := real_days / 7;
  new_grants := tokens_owed - granted_days;
  if new_grants > 0 then
    update profiles
    set streak_freeze_tokens = least(cur_tokens + new_grants, 2),
        streak_freeze_granted_days = tokens_owed
    where user_id = uid;
  end if;
end;
$$;
revoke execute on function sb_recompute_streak_freeze_grants() from public;
grant execute on function sb_recompute_streak_freeze_grants() to authenticated;

create or replace function sb_apply_streak_freeze(p_frozen_date date) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur_tokens int;
  rows_affected int;
begin
  if uid is null then return false; end if;

  select streak_freeze_tokens into cur_tokens from profiles where user_id = uid for update;
  if not found or cur_tokens <= 0 then return false; end if;

  insert into streak_freezes (user_id, frozen_date) values (uid, p_frozen_date)
    on conflict (user_id, frozen_date) do nothing;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then
    return false;
  end if;

  update profiles set streak_freeze_tokens = streak_freeze_tokens - 1 where user_id = uid;
  return true;
end;
$$;
revoke execute on function sb_apply_streak_freeze(date) from public;
grant execute on function sb_apply_streak_freeze(date) to authenticated;

-- ---------- ACHIEVEMENTS ----------
create table if not exists achievements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz default now(),
  unique(user_id, achievement_key)
);

-- ---------- NOTIFICATIONS ----------
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- ---------- AI INSIGHTS & MOCK AI COMPARISON ----------
create table if not exists ai_insights_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generated_at timestamptz default now(),
  input_snapshot jsonb,
  output jsonb
);
create index if not exists idx_ai_insights_user on ai_insights_history(user_id, generated_at desc);

create table if not exists mock_ai_comparison (
  user_id uuid primary key references auth.users(id) on delete cascade,
  result jsonb,
  updated_at timestamptz default now()
);

create table if not exists ai_insights (
  user_id uuid primary key references auth.users(id) on delete cascade,
  result jsonb,
  generated_at timestamptz,
  updated_at timestamptz default now()
);

-- ---------- FOCUS MODE & FOCUS TIMER MUSIC ----------
create table if not exists focus_mode_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  scene text not null default 'rain',
  updated_at timestamptz default now()
);

create table if not exists focus_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort_order int not null default 0,
  created_at timestamptz default now()
);
create index if not exists idx_focus_playlists_user on focus_playlists(user_id, sort_order);

create table if not exists focus_playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  playlist_id uuid not null references focus_playlists(id) on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text check (title is null or char_length(title) <= 200),
  author text check (author is null or char_length(author) <= 120),
  sort_order int not null default 0,
  created_at timestamptz default now(),
  unique (playlist_id, video_id)
);
create index if not exists idx_focus_playlist_tracks_pl on focus_playlist_tracks(playlist_id, sort_order);
create index if not exists idx_focus_playlist_tracks_user on focus_playlist_tracks(user_id);

create table if not exists focus_music_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  source text not null default 'stations' check (source in ('stations', 'own')),
  station_id text,
  playlist_id uuid references focus_playlists(id) on delete set null,
  volume int not null default 70 check (volume between 0 and 100),
  shuffle boolean not null default false,
  loop_playlist boolean not null default true,
  updated_at timestamptz default now()
);

alter table focus_playlists enable row level security;
drop policy if exists "user access" on focus_playlists;
create policy "user access" on focus_playlists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table focus_playlist_tracks enable row level security;
drop policy if exists "user access" on focus_playlist_tracks;
create policy "user access" on focus_playlist_tracks
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from focus_playlists p where p.id = playlist_id and p.user_id = auth.uid())
  );

alter table focus_music_settings enable row level security;
drop policy if exists "user access" on focus_music_settings;
create policy "user access" on focus_music_settings
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      playlist_id is null
      or exists (select 1 from focus_playlists p where p.id = playlist_id and p.user_id = auth.uid())
    )
  );

-- ---------- THEMES / MASCOTS / USER STATISTICS ----------
create table if not exists themes (
  id text primary key,
  label text,
  colors jsonb
);

create table if not exists mascots (
  id text primary key,
  label text
);

create table if not exists user_statistics (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_study_minutes numeric default 0,
  total_questions numeric default 0,
  total_mocks numeric default 0,
  current_streak numeric default 0,
  longest_streak numeric default 0,
  updated_at timestamptz default now()
);

-- ---------- SMART PUSH NOTIFICATIONS ----------
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now()
);
create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;
drop policy if exists "user access" on push_subscriptions;
create policy "user access" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  morning boolean not null default true,
  afternoon boolean not null default true,
  evening boolean not null default true,
  timezone text not null default 'Asia/Kolkata',
  updated_at timestamptz default now()
);

alter table notification_prefs enable row level security;
drop policy if exists "user access" on notification_prefs;
create policy "user access" on notification_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists notification_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot text not null,
  send_date date not null default current_date,
  title text,
  body text,
  model_used text,
  status text not null default 'sent',
  error text,
  created_at timestamptz default now(),
  unique (user_id, slot, send_date)
);
create index if not exists idx_notification_log_user on notification_log(user_id, send_date desc);

alter table notification_log enable row level security;
drop policy if exists "user read own log" on notification_log;
create policy "user read own log" on notification_log
  for select using (auth.uid() = user_id);

create or replace function touch_notification_prefs() returns trigger
language plpgsql as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists trg_touch_notification_prefs on notification_prefs;
create trigger trg_touch_notification_prefs
  before update on notification_prefs
  for each row execute function touch_notification_prefs();

-- ============================================================
-- 2. ROW LEVEL SECURITY & REALTIME FOR CORE TABLES
-- ============================================================

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'profiles','user_settings','study_sessions','timer_sessions',
      'syllabus_subjects','syllabus_chapters','chapter_progress','backlog_items','goals',
      'question_logs','mock_tests','mock_analysis','revision_plans','revision_logs',
      'tasks','achievements','notifications','ai_insights_history','user_statistics',
      'mock_ai_comparison','ai_insights','focus_mode_settings'
    ])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "device access" on %I;', t);
    execute format('drop policy if exists "user access" on %I;', t);
    execute format('create policy "user access" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
  end loop;
end $$;

alter table themes enable row level security;
drop policy if exists "public read themes" on themes;
create policy "public read themes" on themes for select using (true);

alter table mascots enable row level security;
drop policy if exists "public read mascots" on mascots;
create policy "public read mascots" on mascots for select using (true);

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'profiles','user_settings','user_statistics','study_sessions','timer_sessions',
      'chapter_progress','backlog_items','goals','question_logs','mock_tests',
      'mock_analysis','revision_plans','tasks','streak_freezes','achievements',
      'notifications','mock_ai_comparison','ai_insights','focus_mode_settings',
      'focus_playlists','focus_playlist_tracks','focus_music_settings'
    ])
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I;', t);
    end if;
  end loop;
end $$;

-- ============================================================
-- 3. LEADERBOARD & CANONICAL 5-SIGNAL STREAK ENGINE (v3)
-- ============================================================

create or replace function lb_set_chapter_completed_at() returns trigger
language plpgsql as $$
declare
  was_done boolean := (TG_OP = 'UPDATE') and (OLD.status in ('Completed', 'Mastered'));
  is_done  boolean := NEW.status in ('Completed', 'Mastered');
begin
  if is_done and not was_done then
    NEW.completed_at := now();
  elsif not is_done then
    NEW.completed_at := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_chapter_completed_at on chapter_progress;
create trigger trg_chapter_completed_at
  before insert or update on chapter_progress
  for each row execute function lb_set_chapter_completed_at();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'study_sessions_minutes_range') then
    alter table study_sessions add constraint study_sessions_minutes_range
      check (minutes >= 0 and minutes <= 600) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'timer_sessions_actual_range') then
    alter table timer_sessions add constraint timer_sessions_actual_range
      check (actual_minutes is null or (actual_minutes >= 0 and actual_minutes <= 600)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'timer_sessions_planned_range') then
    alter table timer_sessions add constraint timer_sessions_planned_range
      check (planned_minutes is null or (planned_minutes >= 1 and planned_minutes <= 600)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'question_logs_count_range') then
    alter table question_logs add constraint question_logs_count_range
      check (count >= 0 and count <= 500) not valid;
  end if;
end $$;

create table if not exists leaderboard_public (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Study Buddy',
  mascot text not null default 'bunny',
  study_score numeric not null default 0,
  current_streak int not null default 0,
  active_days_30 int not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists idx_leaderboard_public_score on leaderboard_public(study_score desc, current_streak desc);

alter table leaderboard_public enable row level security;
drop policy if exists "leaderboard public read" on leaderboard_public;
create policy "leaderboard public read" on leaderboard_public
  for select using (auth.role() = 'authenticated');

create table if not exists leaderboard_score_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  old_score numeric not null,
  new_score numeric not null,
  delta numeric not null,
  computed_at timestamptz not null default now()
);
create index if not exists idx_leaderboard_score_log_user_time on leaderboard_score_log(user_id, computed_at desc);

alter table leaderboard_score_log enable row level security;
drop policy if exists "own score log read" on leaderboard_score_log;
create policy "own score log read" on leaderboard_score_log
  for select using (auth.uid() = user_id);

create or replace function lb_calc_streak(uid uuid) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (now() at time zone 'Asia/Kolkata')::date;
  streak_n int := 0;
  has_day boolean;
  today_logged boolean;
begin
  select
    exists (
      select 1 from study_sessions
      where user_id = uid and session_date = d and minutes >= 5
        and (platform is null or platform <> 'Focus Timer')
    )
    or exists (
      select 1 from timer_sessions
      where user_id = uid and completed = true and actual_minutes >= 10
        and (created_at at time zone 'Asia/Kolkata')::date = d
    )
    or exists (
      select 1 from question_logs
      where user_id = uid and log_date = d and count >= 1
    )
    or exists (
      select 1 from tasks
      where user_id = uid and due_date = d
      group by due_date having count(*) filter (where status <> 'Completed') = 0
    )
    or exists (
      select 1 from streak_freezes
      where user_id = uid and frozen_date = d
    )
  into today_logged;
  if not today_logged then
    d := d - 1;
  end if;
  loop
    select
      exists (
        select 1 from study_sessions
        where user_id = uid and session_date = d and minutes >= 5
          and (platform is null or platform <> 'Focus Timer')
      )
      or exists (
        select 1 from timer_sessions
        where user_id = uid and completed = true and actual_minutes >= 10
          and (created_at at time zone 'Asia/Kolkata')::date = d
      )
      or exists (
        select 1 from question_logs
        where user_id = uid and log_date = d and count >= 1
      )
      or exists (
        select 1 from tasks
        where user_id = uid and due_date = d
        group by due_date having count(*) filter (where status <> 'Completed') = 0
      )
      or exists (
        select 1 from streak_freezes
        where user_id = uid and frozen_date = d
      )
    into has_day;
    exit when not has_day or streak_n > 730;
    streak_n := streak_n + 1;
    d := d - 1;
  end loop;
  return streak_n;
end;
$$;
revoke execute on function lb_calc_streak(uuid) from public;

create or replace function lb_recompute(uid uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  window_start date := (now() at time zone 'Asia/Kolkata')::date - 29;
  active_days   int;
  sessions_n    int;
  timer_mins    numeric;
  manual_mins   numeric;
  questions_n   numeric;
  mocks_n       int;
  chapters_n    int;
  streak_n      int;
  score         numeric;
  prof          record;
  prior_score   numeric;
begin
  perform pg_advisory_xact_lock(hashtext(uid::text));

  select study_score into prior_score from leaderboard_public where user_id = uid;

  select count(distinct d) into active_days from (
    select session_date as d from study_sessions
      where user_id = uid and minutes >= 5 and session_date >= window_start
        and (platform is null or platform <> 'Focus Timer')
    union
    select (created_at at time zone 'Asia/Kolkata')::date as d from timer_sessions
      where user_id = uid and completed = true and actual_minutes >= 10
        and (created_at at time zone 'Asia/Kolkata')::date >= window_start
    union
    select log_date as d from question_logs
      where user_id = uid and count >= 1 and log_date >= window_start
    union
    select due_date as d from tasks
      where user_id = uid and due_date >= window_start
      group by due_date
      having count(*) filter (where status <> 'Completed') = 0
    union
    select frozen_date as d from streak_freezes
      where user_id = uid and frozen_date >= window_start
  ) t;

  select least(count(*), 240) into sessions_n
  from timer_sessions
  where user_id = uid and completed = true
    and actual_minutes >= 10 and actual_minutes <= 240
    and planned_minutes is not null
    and abs(actual_minutes - planned_minutes) <= greatest(3, planned_minutes * 0.15)
    and (created_at at time zone 'Asia/Kolkata')::date >= window_start;

  select coalesce(sum(least(daily, 780)), 0) into timer_mins from (
    select (created_at at time zone 'Asia/Kolkata')::date as d, sum(actual_minutes) as daily
    from timer_sessions
    where user_id = uid and completed = true and actual_minutes between 10 and 600
      and (created_at at time zone 'Asia/Kolkata')::date >= window_start
    group by 1
  ) t;

  select coalesce(sum(least(daily, 180)), 0) into manual_mins from (
    select session_date as d, sum(minutes) as daily
    from study_sessions
    where user_id = uid and minutes between 5 and 600 and session_date >= window_start
      and (platform is null or platform <> 'Focus Timer')
    group by 1
  ) t;

  select coalesce(sum(least(daily, 100)), 0) into questions_n from (
    select log_date as d, sum(count) as daily
    from question_logs
    where user_id = uid and count between 1 and 500 and log_date >= window_start
    group by 1
  ) t;

  select least(count(*), 30) into mocks_n
  from mock_tests where user_id = uid and mock_date >= window_start;

  select least(count(distinct (subject, chapter)), 30) into chapters_n
  from chapter_progress
  where user_id = uid and status in ('Completed', 'Mastered') and completed_at >= (now() - interval '30 days');

  streak_n := lb_calc_streak(uid);

  score := round(
      active_days * 12
    + sessions_n * 3
    + timer_mins * 0.5
    + manual_mins * 0.2
    + questions_n * 0.3
    + mocks_n * 8
    + chapters_n * 10
    + least(streak_n, 60) * 4
  );

  select name, mascot into prof from profiles where user_id = uid;
  if not found then
    return;
  end if;

  insert into leaderboard_public (user_id, display_name, mascot, study_score, current_streak, active_days_30, updated_at)
  values (
    uid,
    coalesce(nullif(trim(coalesce(prof.name, '')), ''), 'Study Buddy'),
    coalesce(nullif(prof.mascot, ''), 'bunny'),
    score, streak_n, active_days, now()
  )
  on conflict (user_id) do update set
    display_name   = excluded.display_name,
    mascot         = excluded.mascot,
    study_score    = excluded.study_score,
    current_streak = excluded.current_streak,
    active_days_30 = excluded.active_days_30,
    updated_at     = now();

  if prior_score is not null and round(prior_score, 2) is distinct from round(score, 2) then
    insert into leaderboard_score_log (user_id, old_score, new_score, delta)
    values (uid, prior_score, score, score - prior_score);
  end if;

  delete from leaderboard_score_log
  where user_id = uid
    and id not in (
      select id from leaderboard_score_log
      where user_id = uid
      order by computed_at desc
      limit 200
    );
end;
$$;
revoke execute on function lb_recompute(uuid) from public;

create or replace function lb_recompute_and_report()
returns table (old_score numeric, new_score numeric, had_prior_row boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prev numeric;
  cur numeric;
  existed boolean := false;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select study_score into prev from leaderboard_public where user_id = uid;
  existed := found;

  perform lb_recompute(uid);

  select study_score into cur from leaderboard_public where user_id = uid;

  return query select prev, coalesce(cur, 0), existed;
end;
$$;
grant execute on function lb_recompute_and_report() to authenticated;

create or replace function lb_recompute_for_user(target_uid uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform lb_recompute(target_uid);
end;
$$;
revoke execute on function lb_recompute_for_user(uuid) from public;
revoke execute on function lb_recompute_for_user(uuid) from authenticated;
grant execute on function lb_recompute_for_user(uuid) to service_role;

create or replace function lb_trg_recompute() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    perform lb_recompute(OLD.user_id);
    return OLD;
  else
    perform lb_recompute(NEW.user_id);
    return NEW;
  end if;
end;
$$;
revoke execute on function lb_trg_recompute() from public;

do $$
declare
  t text;
begin
  for t in select unnest(array['study_sessions', 'timer_sessions', 'question_logs', 'mock_tests', 'chapter_progress', 'tasks', 'streak_freezes'])
  loop
    execute format('drop trigger if exists trg_lb_recompute on %I;', t);
    execute format(
      'create trigger trg_lb_recompute after insert or update or delete on %I for each row execute function lb_trg_recompute();',
      t
    );
  end loop;
end $$;

create or replace function lb_trg_recompute_profile() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform lb_recompute(NEW.user_id);
  return NEW;
end;
$$;
revoke execute on function lb_trg_recompute_profile() from public;

drop trigger if exists trg_lb_recompute_profile on profiles;
create trigger trg_lb_recompute_profile after insert or update on profiles
  for each row execute function lb_trg_recompute_profile();

create or replace function lb_get_my_rank()
returns table (rank bigint, study_score numeric, current_streak int, total_users bigint)
language sql
security definer
set search_path = public
stable
as $$
  with ranked as (
    select
      user_id, study_score, current_streak,
      rank() over (order by study_score desc, current_streak desc, user_id) as rnk
    from leaderboard_public
  )
  select r.rnk, r.study_score, r.current_streak, (select count(*) from leaderboard_public)
  from ranked r
  where r.user_id = auth.uid();
$$;
grant execute on function lb_get_my_rank() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'leaderboard_public'
  ) then
    alter publication supabase_realtime add table leaderboard_public;
  end if;
end $$;

-- ============================================================
-- 4. ROLES, FOUNDER/MODERATOR BADGES & MASCOT LOCKS
-- ============================================================

create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'moderator', 'admin', 'founder')),
  created_at timestamptz default now()
);

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'user_roles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%in%';
  if cname is not null then
    execute format('alter table user_roles drop constraint %I', cname);
  end if;
  alter table user_roles
    add constraint user_roles_role_check check (role in ('user', 'moderator', 'admin', 'founder'));
end $$;

create or replace function is_moderator(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role in ('moderator', 'admin', 'founder'));
$$;
revoke all on function is_moderator(uuid) from public;
grant execute on function is_moderator(uuid) to authenticated;

create or replace function is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role in ('admin', 'founder'));
$$;
revoke all on function is_admin(uuid) from public;
grant execute on function is_admin(uuid) to authenticated;

create or replace function is_founder(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role = 'founder');
$$;
revoke all on function is_founder(uuid) from public;
grant execute on function is_founder(uuid) to authenticated;

create or replace function is_mod_protected(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles
    where user_id = target and role in ('admin', 'founder')
  );
$$;
revoke all on function is_mod_protected(uuid) from public;
grant execute on function is_mod_protected(uuid) to authenticated;

create or replace function get_founder_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(user_id), array[]::uuid[]) from user_roles where role = 'founder';
$$;
revoke all on function get_founder_ids() from public;
grant execute on function get_founder_ids() to authenticated;

create or replace function get_role_ids() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'founders', coalesce(
      (select jsonb_agg(user_id) from user_roles where role = 'founder'),
      '[]'::jsonb
    ),
    'moderators', coalesce(
      (select jsonb_agg(user_id) from user_roles where role = 'moderator'),
      '[]'::jsonb
    ),
    'protected', coalesce(
      (select jsonb_agg(user_id) from user_roles where role in ('admin', 'founder')),
      '[]'::jsonb
    )
  );
$$;
revoke all on function get_role_ids() from public;
grant execute on function get_role_ids() to authenticated;

alter table user_roles enable row level security;
drop policy if exists "user_roles read own or mod" on user_roles;
create policy "user_roles read own or mod" on user_roles
  for select using (auth.uid() = user_id or is_moderator(auth.uid()));

create or replace function founder_only_mascots() returns text[]
language sql immutable as $$
  select array['dragon', 'axolotl']::text[];
$$;

create or replace function mod_unlockable_mascots() returns text[]
language sql immutable as $$
  select array['lion']::text[];
$$;

create or replace function enforce_founder_mascot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.mascot is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.mascot is not distinct from new.mascot then
    return new;
  end if;

  if new.mascot = any (mod_unlockable_mascots()) then
    if is_founder(new.user_id) or is_moderator(new.user_id) then
      return new;
    end if;
    raise exception 'mascot "%" is reserved for StudyBun founders and moderators', new.mascot
      using errcode = 'check_violation';
  end if;

  if new.mascot = any (founder_only_mascots()) then
    if is_founder(new.user_id) then
      return new;
    end if;
    raise exception 'mascot "%" is reserved for StudyBun founders', new.mascot
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trg_enforce_founder_mascot on profiles;
create trigger trg_enforce_founder_mascot
  before insert or update of mascot on profiles
  for each row execute function enforce_founder_mascot();

-- ============================================================
-- 5. COMMUNITY, CHANNELS, CHAT, READ RECEIPTS, LOCKS & FEED v2
-- ============================================================

create table if not exists community_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table community_blocks enable row level security;
drop policy if exists "blocks manage own" on community_blocks;
create policy "blocks manage own" on community_blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

create or replace function is_blocked_by_viewer(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from community_blocks where blocker_id = auth.uid() and blocked_id = target
  );
$$;
revoke all on function is_blocked_by_viewer(uuid) from public;
grant execute on function is_blocked_by_viewer(uuid) to authenticated;

create or replace function get_community_profiles(uids uuid[])
returns table(user_id uuid, name text, mascot text)
language sql stable security definer set search_path = public as $$
  select user_id, name, mascot from profiles where user_id = any(uids);
$$;
revoke all on function get_community_profiles(uuid[]) from public;
grant execute on function get_community_profiles(uuid[]) to authenticated;

create or replace function is_channel_lock_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid = 'f50ed60c-21d4-4662-bce8-946d156f72c2'::uuid or is_founder(uid);
$$;
revoke all on function is_channel_lock_admin(uuid) from public;
grant execute on function is_channel_lock_admin(uuid) to authenticated;

create or replace function is_chat_ban_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(is_channel_lock_admin(uid), false);
$$;
revoke all on function is_chat_ban_admin(uuid) from public, anon;
grant execute on function is_chat_ban_admin(uuid) to authenticated;

create table if not exists community_channels (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text default '',
  subject text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  is_locked boolean not null default false,
  locked_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table community_channels
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references auth.users(id) on delete set null;

alter table community_channels enable row level security;
drop policy if exists "channels read active" on community_channels;
create policy "channels read active" on community_channels
  for select using (is_active or is_moderator(auth.uid()));

drop policy if exists "channels update lock admin only" on community_channels;
create policy "channels update lock admin only" on community_channels
  for update using (is_channel_lock_admin(auth.uid()))
  with check (is_channel_lock_admin(auth.uid()));

create or replace function set_channel_lock(p_channel_id uuid, p_locked boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_channel_lock_admin(auth.uid()) then
    raise exception 'not_authorized: channel lock is restricted';
  end if;
  update community_channels
    set is_locked = p_locked,
        locked_at = case when p_locked then now() else null end,
        locked_by = case when p_locked then auth.uid() else null end
    where id = p_channel_id;
  if not found then
    raise exception 'channel_not_found: %', p_channel_id;
  end if;
end;
$$;
revoke all on function set_channel_lock(uuid, boolean) from public;
grant execute on function set_channel_lock(uuid, boolean) to authenticated;

alter table community_channels replica identity full;

insert into community_channels (name, slug, description, subject, sort_order)
values
  ('General', 'general', 'Say hi, ask anything, cheer each other on.', null, 0),
  ('NEET UG', 'neet-ug', 'Everything NEET UG prep, strategy & updates.', null, 1),
  ('Biology (Botany & Zoology)', 'biology', 'NCERT Biology, Botany & Zoology doubts and high-yield discussions.', 'Biology', 2),
  ('Physics', 'physics', 'Physics doubts, tips, and grind updates.', 'Physics', 3),
  ('Chemistry', 'chemistry', 'Chemistry doubts, tips, and grind updates.', 'Chemistry', 4),
  ('Mathematics (PCMB)', 'mathematics', 'Maths doubts, tips, and grind updates for PCMB students.', 'Maths', 5)
on conflict (slug) do nothing;

-- ---------- COMMUNITY MESSAGES ----------
create table if not exists community_messages (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid not null references community_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  image_url text,
  reply_to_id uuid,
  reply_to_user_id uuid,
  reply_to_name text,
  reply_to_content text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 days'),
  updated_at timestamptz not null default now(),
  constraint community_messages_image_url_len check (image_url is null or char_length(image_url) <= 600),
  constraint community_messages_content_or_image check (
    (char_length(trim(content)) > 0 and char_length(content) <= 1000)
    or image_url is not null
  )
);

alter table community_messages
  add column if not exists image_url text,
  add column if not exists reply_to_id uuid,
  add column if not exists reply_to_user_id uuid,
  add column if not exists reply_to_name text,
  add column if not exists reply_to_content text;

create index if not exists idx_community_messages_channel on community_messages(channel_id, created_at desc);
create index if not exists idx_community_messages_expires on community_messages(expires_at);
create index if not exists idx_community_messages_user on community_messages(user_id, created_at desc);
create index if not exists idx_community_messages_reply_to on community_messages(reply_to_id);
create index if not exists idx_community_messages_user_channel on community_messages(user_id, channel_id, created_at desc);

alter table community_messages replica identity full;
alter table community_messages enable row level security;

drop policy if exists "messages read" on community_messages;
create policy "messages read" on community_messages
  for select using (
    auth.role() = 'authenticated'
    and not is_blocked_by_viewer(user_id)
  );

drop policy if exists "messages insert own" on community_messages;
create policy "messages insert own" on community_messages
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from community_channels c
      where c.id = channel_id and c.is_active and not c.is_locked
    )
  );

drop policy if exists "messages delete own or mod" on community_messages;
create policy "messages delete own or mod" on community_messages
  for delete using (
    auth.uid() = user_id
    or is_admin(auth.uid())
    or (is_moderator(auth.uid()) and not is_mod_protected(user_id))
  );

create or replace function community_messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  recent_count int;
  last_content text;
  last_at      timestamptz;
begin
  select count(*) into recent_count
  from community_messages
  where user_id = NEW.user_id
    and channel_id = NEW.channel_id
    and created_at > now() - interval '60 seconds';
  if recent_count >= 12 then
    raise exception 'rate_limited: too many messages, slow down a little';
  end if;

  if trim(NEW.content) <> '' then
    select content, created_at into last_content, last_at
    from community_messages
    where user_id = NEW.user_id
      and channel_id = NEW.channel_id
    order by created_at desc
    limit 1;

    if last_content is not null
       and last_content = NEW.content
       and last_at > now() - interval '20 seconds' then
      raise exception 'rate_limited: duplicate message';
    end if;
  end if;

  if NEW.reply_to_id is not null and not exists (
    select 1 from community_messages
    where id = NEW.reply_to_id and channel_id = NEW.channel_id
  ) then
    raise exception 'invalid_reply: reply target not found in this channel';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_community_messages_guard on community_messages;
create trigger trg_community_messages_guard
  before insert on community_messages
  for each row execute function community_messages_guard();

create or replace function scrub_reply_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update community_messages
     set reply_to_id = null,
         reply_to_content = null
   where reply_to_id = OLD.id;
  return OLD;
end;
$$;

drop trigger if exists trg_scrub_reply_snapshot on community_messages;
create trigger trg_scrub_reply_snapshot
  after delete on community_messages
  for each row execute function scrub_reply_snapshot();

-- ---------- COMMUNITY CHANNEL READ RECEIPTS ----------
create table if not exists community_channel_reads (
  channel_id uuid not null references community_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists idx_community_channel_reads_channel_read
  on community_channel_reads(channel_id, last_read_at);

alter table community_channel_reads enable row level security;

drop policy if exists "channel_reads read" on community_channel_reads;
create policy "channel_reads read" on community_channel_reads
  for select using (
    auth.role() = 'authenticated' and not is_blocked_by_viewer(user_id)
  );

drop policy if exists "channel_reads upsert own" on community_channel_reads;
create policy "channel_reads upsert own" on community_channel_reads
  for insert with check (auth.uid() = user_id);

drop policy if exists "channel_reads update own" on community_channel_reads;
create policy "channel_reads update own" on community_channel_reads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function get_message_readers(p_channel_id uuid, p_after timestamptz)
returns table(user_id uuid, name text, mascot text, last_read_at timestamptz)
language sql stable security definer set search_path = public as $$
  select cr.user_id, p.name, p.mascot, cr.last_read_at
  from community_channel_reads cr
  join profiles p on p.user_id = cr.user_id
  where cr.channel_id = p_channel_id
    and cr.last_read_at >= p_after
    and cr.user_id <> auth.uid()
    and not is_blocked_by_viewer(cr.user_id)
  order by cr.last_read_at desc
  limit 200;
$$;
revoke all on function get_message_readers(uuid, timestamptz) from public;
grant execute on function get_message_readers(uuid, timestamptz) to authenticated;

-- ---------- FOCUS LOCK (personal self-lock on Community Chat) ----------
create table if not exists community_focus_lock_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  note text
);
alter table community_focus_lock_users enable row level security;

drop policy if exists "focus_lock_users select own" on community_focus_lock_users;
create policy "focus_lock_users select own" on community_focus_lock_users
  for select using (auth.uid() = user_id);

create or replace function is_focus_lock_eligible(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from community_focus_lock_users where user_id = uid);
$$;
revoke all on function is_focus_lock_eligible(uuid) from public;
grant execute on function is_focus_lock_eligible(uuid) to authenticated;

create table if not exists community_focus_locks (
  user_id uuid primary key references community_focus_lock_users(user_id) on delete cascade,
  is_locked boolean not null default false,
  locked_at timestamptz
);
alter table community_focus_locks enable row level security;
alter table community_focus_locks replica identity full;

drop policy if exists "focus_locks select own" on community_focus_locks;
create policy "focus_locks select own" on community_focus_locks
  for select using (auth.uid() = user_id);

create or replace function set_my_focus_lock(p_locked boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not is_focus_lock_eligible(auth.uid()) then
    raise exception 'not_authorized: focus lock is not enabled for this account';
  end if;
  insert into community_focus_locks (user_id, is_locked, locked_at)
    values (auth.uid(), p_locked, case when p_locked then now() else null end)
  on conflict (user_id) do update
    set is_locked = excluded.is_locked,
        locked_at = excluded.locked_at;
  return p_locked;
end;
$$;
revoke all on function set_my_focus_lock(boolean) from public;
grant execute on function set_my_focus_lock(boolean) to authenticated;

create or replace function mark_channel_read(p_channel_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from community_focus_locks
    where user_id = auth.uid() and is_locked
  ) then
    return;
  end if;
  insert into community_channel_reads (channel_id, user_id, last_read_at)
    values (p_channel_id, auth.uid(), now())
  on conflict (channel_id, user_id) do update set last_read_at = excluded.last_read_at;
end;
$$;
revoke all on function mark_channel_read(uuid) from public;
grant execute on function mark_channel_read(uuid) to authenticated;

-- ---------- COMMUNITY CHAT BANS ----------
create table if not exists community_chat_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_banned boolean not null default true,
  banned_at timestamptz,
  banned_by uuid references auth.users(id) on delete set null
);
alter table community_chat_bans enable row level security;
alter table community_chat_bans replica identity full;

drop policy if exists "chat_bans select own or admin" on community_chat_bans;
create policy "chat_bans select own or admin" on community_chat_bans
  for select using (auth.uid() = user_id or is_chat_ban_admin(auth.uid()));

create or replace function set_chat_ban(p_user_id uuid, p_banned boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(is_chat_ban_admin(auth.uid()), false) then
    raise exception 'not_authorized: chat blocking is restricted';
  end if;
  if p_user_id is null then
    raise exception 'invalid_user: no user given';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_block_self: you cannot block yourself';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'user_not_found: %', p_user_id;
  end if;
  insert into community_chat_bans (user_id, is_banned, banned_at, banned_by)
    values (p_user_id, p_banned, case when p_banned then now() else null end,
            case when p_banned then auth.uid() else null end)
  on conflict (user_id) do update
    set is_banned = excluded.is_banned,
        banned_at = excluded.banned_at,
        banned_by = excluded.banned_by;
  if p_banned and to_regclass('public.community_channel_reads') is not null then
    execute 'delete from community_channel_reads where user_id = $1' using p_user_id;
  end if;
  return p_banned;
end;
$$;
revoke all on function set_chat_ban(uuid, boolean) from public, anon;
grant execute on function set_chat_ban(uuid, boolean) to authenticated;

create or replace function get_chat_ban_directory()
returns table(user_id uuid, name text, mascot text, is_banned boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(is_chat_ban_admin(auth.uid()), false) then
    raise exception 'not_authorized: chat blocking is restricted';
  end if;
  return query
    select p.user_id, p.name, p.mascot, coalesce(b.is_banned, false)
    from profiles p
    left join community_chat_bans b on b.user_id = p.user_id
    where p.user_id <> auth.uid()
      and (coalesce(p.community_opt_out, false) = false or coalesce(b.is_banned, false))
    order by p.name asc;
end;
$$;
revoke all on function get_chat_ban_directory() from public, anon;
grant execute on function get_chat_ban_directory() to authenticated;

create or replace function community_chat_ban_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from community_chat_bans
    where user_id = new.user_id and is_banned
  ) then
    raise exception 'chat_banned: you are blocked from community chat';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_community_messages_a_ban_check on community_messages;
create trigger trg_community_messages_a_ban_check
  before insert on community_messages
  for each row execute function community_chat_ban_check();

create or replace function community_chat_ban_reads_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from community_chat_bans
    where user_id = new.user_id and is_banned
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_channel_reads_a_ban_check on community_channel_reads;
create trigger trg_channel_reads_a_ban_check
  before insert or update on community_channel_reads
  for each row execute function community_chat_ban_reads_check();

-- ---------- ACCOUNTABILITY GOALS ----------
create table if not exists accountability_goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  subject text,
  chapter text,
  goal_type text not null default 'custom',
  goal_text text not null,
  target_value numeric,
  actual_value numeric,
  estimated_minutes numeric,
  status text not null default 'planned' check (status in ('planned', 'studying', 'completed', 'partial', 'missed')),
  result_note text,
  created_at timestamptz default now(),
  completed_at timestamptz,
  check (char_length(trim(goal_text)) > 0 and char_length(goal_text) <= 200)
);
create index if not exists idx_accountability_goals_user_date on accountability_goals(user_id, goal_date desc);
create index if not exists idx_accountability_goals_date on accountability_goals(goal_date);

alter table accountability_goals enable row level security;

drop policy if exists "goals read" on accountability_goals;
create policy "goals read" on accountability_goals
  for select using (auth.role() = 'authenticated' and not is_blocked_by_viewer(user_id));

drop policy if exists "goals insert own" on accountability_goals;
create policy "goals insert own" on accountability_goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "goals update own" on accountability_goals;
create policy "goals update own" on accountability_goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals delete own" on accountability_goals;
create policy "goals delete own" on accountability_goals
  for delete using (auth.uid() = user_id);

create or replace view community_today_checkins as
select count(distinct user_id) as checked_in_today
from accountability_goals
where goal_date = (now() at time zone 'Asia/Kolkata')::date;

grant select on community_today_checkins to authenticated;

-- ---------- COMMUNITY FEED POSTS (v2 with DOUBT & multi-image support) ----------
create table if not exists community_posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('CHECK_IN', 'PROGRESS', 'QUESTION', 'TIP', 'MILESTONE', 'DOUBT')),
  content text not null,
  subject text,
  chapter text,
  goal_id uuid references accountability_goals(id) on delete set null,
  image_url text,
  image_urls text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (char_length(trim(content)) > 0 and char_length(content) <= 2000),
  constraint community_posts_image_url_len check (image_url is null or char_length(image_url) <= 600),
  constraint community_posts_image_urls_len check (array_length(image_urls, 1) is null or array_length(image_urls, 1) <= 3)
);

alter table community_posts
  add column if not exists image_url text,
  add column if not exists image_urls text[] not null default '{}';

alter table community_posts drop constraint if exists community_posts_type_check;
alter table community_posts add constraint community_posts_type_check
  check (type in ('CHECK_IN', 'PROGRESS', 'QUESTION', 'TIP', 'MILESTONE', 'DOUBT'));

create index if not exists idx_community_posts_created on community_posts(created_at desc);
create index if not exists idx_community_posts_user on community_posts(user_id, created_at desc);

alter table community_posts enable row level security;

drop policy if exists "posts read" on community_posts;
create policy "posts read" on community_posts
  for select using (auth.role() = 'authenticated' and not is_blocked_by_viewer(user_id));

drop policy if exists "posts insert own" on community_posts;
create policy "posts insert own" on community_posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "posts delete own or mod" on community_posts;
create policy "posts delete own or mod" on community_posts
  for delete using (
    auth.uid() = user_id
    or is_admin(auth.uid())
    or (is_moderator(auth.uid()) and not is_mod_protected(user_id))
  );

create or replace function community_posts_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from community_posts
  where user_id = NEW.user_id and created_at > now() - interval '1 hour';
  if recent_count >= 6 then
    raise exception 'rate_limited: too many posts this hour';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_community_posts_guard on community_posts;
create trigger trg_community_posts_guard
  before insert on community_posts
  for each row execute function community_posts_guard();

-- ---------- COMMUNITY REPLIES ----------
create table if not exists community_replies (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  image_url text,
  created_at timestamptz default now(),
  check (char_length(trim(content)) > 0 and char_length(content) <= 1000),
  constraint community_replies_image_url_len check (image_url is null or char_length(image_url) <= 600)
);
alter table community_replies add column if not exists image_url text;
create index if not exists idx_community_replies_post on community_replies(post_id, created_at);

alter table community_replies enable row level security;

drop policy if exists "replies read" on community_replies;
create policy "replies read" on community_replies
  for select using (auth.role() = 'authenticated' and not is_blocked_by_viewer(user_id));

drop policy if exists "replies insert own" on community_replies;
create policy "replies insert own" on community_replies
  for insert with check (auth.uid() = user_id);

drop policy if exists "replies delete own or mod" on community_replies;
create policy "replies delete own or mod" on community_replies
  for delete using (
    auth.uid() = user_id
    or is_admin(auth.uid())
    or (is_moderator(auth.uid()) and not is_mod_protected(user_id))
  );

create or replace function community_replies_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from community_replies
  where user_id = NEW.user_id and created_at > now() - interval '1 hour';
  if recent_count >= 20 then
    raise exception 'rate_limited: too many replies this hour';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_community_replies_guard on community_replies;
create trigger trg_community_replies_guard
  before insert on community_replies
  for each row execute function community_replies_guard();

-- ---------- COMMUNITY REACTIONS ----------
create table if not exists community_reactions (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('support', 'helpful', 'lets_go')),
  created_at timestamptz default now(),
  unique (user_id, post_id, reaction_type)
);
create index if not exists idx_community_reactions_post on community_reactions(post_id);

alter table community_reactions enable row level security;

drop policy if exists "reactions read" on community_reactions;
create policy "reactions read" on community_reactions
  for select using (auth.role() = 'authenticated');

drop policy if exists "reactions insert own" on community_reactions;
create policy "reactions insert own" on community_reactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "reactions delete own" on community_reactions;
create policy "reactions delete own" on community_reactions
  for delete using (auth.uid() = user_id);

-- ---------- COMMUNITY REPORTS ----------
create table if not exists community_reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('message', 'post', 'reply', 'user')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'abuse', 'inappropriate', 'misinformation', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  check (details is null or char_length(details) <= 500)
);
create index if not exists idx_community_reports_status on community_reports(status, created_at desc);

alter table community_reports enable row level security;

drop policy if exists "reports insert own" on community_reports;
create policy "reports insert own" on community_reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists "reports read own or mod" on community_reports;
create policy "reports read own or mod" on community_reports
  for select using (auth.uid() = reporter_id or is_moderator(auth.uid()));

drop policy if exists "reports resolve mod only" on community_reports;
create policy "reports resolve mod only" on community_reports
  for update using (is_moderator(auth.uid())) with check (is_moderator(auth.uid()));

-- ============================================================
-- 6. PRIVATE CHAT (Founder/Admin Invite-Only Channels)
-- ============================================================

create table if not exists private_channels (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_preview text,
  last_message_user_id uuid
);
create index if not exists idx_private_channels_last_message on private_channels(last_message_at desc nulls last);

create table if not exists private_channel_members (
  channel_id uuid not null references private_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists idx_private_channel_members_user on private_channel_members(user_id);

create or replace function is_private_channel_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from private_channel_members where channel_id = cid and user_id = auth.uid()
  );
$$;
revoke all on function is_private_channel_member(uuid) from public;
grant execute on function is_private_channel_member(uuid) to authenticated;

alter table private_channels enable row level security;

drop policy if exists "private channels read member or founder" on private_channels;
create policy "private channels read member or founder" on private_channels
  for select using (is_private_channel_member(id) or is_admin(auth.uid()));

drop policy if exists "private channels insert founder only" on private_channels;
create policy "private channels insert founder only" on private_channels
  for insert with check (is_admin(auth.uid()) and created_by = auth.uid());

drop policy if exists "private channels update founder only" on private_channels;
create policy "private channels update founder only" on private_channels
  for update using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

drop policy if exists "private channels delete founder only" on private_channels;
create policy "private channels delete founder only" on private_channels
  for delete using (is_admin(auth.uid()));

alter table private_channel_members enable row level security;

drop policy if exists "private members read member or founder" on private_channel_members;
create policy "private members read member or founder" on private_channel_members
  for select using (is_private_channel_member(channel_id) or is_admin(auth.uid()));

drop policy if exists "private members insert founder only" on private_channel_members;
create policy "private members insert founder only" on private_channel_members
  for insert with check (is_admin(auth.uid()));

drop policy if exists "private members delete founder or self" on private_channel_members;
create policy "private members delete founder or self" on private_channel_members
  for delete using (is_admin(auth.uid()) or user_id = auth.uid());

create table if not exists private_messages (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid not null references private_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  image_url text,
  created_at timestamptz not null default now(),
  reply_to_id uuid,
  reply_to_user_id uuid,
  reply_to_name text,
  reply_to_content text,
  check (
    (char_length(trim(content)) > 0 and char_length(content) <= 1000)
    or image_url is not null
  ),
  check (image_url is null or char_length(image_url) <= 600)
);
create index if not exists idx_private_messages_channel on private_messages(channel_id, created_at desc);
create index if not exists idx_private_messages_user on private_messages(user_id, created_at desc);
create index if not exists idx_private_messages_reply_to on private_messages(reply_to_id);

alter table private_messages replica identity full;
alter table private_messages enable row level security;

drop policy if exists "private messages read members only" on private_messages;
create policy "private messages read members only" on private_messages
  for select using (is_private_channel_member(channel_id) or is_admin(auth.uid()));

drop policy if exists "private messages insert own if member" on private_messages;
create policy "private messages insert own if member" on private_messages
  for insert with check (
    auth.uid() = user_id
    and (is_private_channel_member(channel_id) or is_admin(auth.uid()))
  );

drop policy if exists "private messages delete own or founder" on private_messages;
create policy "private messages delete own or founder" on private_messages
  for delete using (
    auth.uid() = user_id
    or is_admin(auth.uid())
    or (
      is_moderator(auth.uid())
      and is_private_channel_member(channel_id)
      and not is_mod_protected(user_id)
    )
  );

create or replace function private_messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  recent_count int;
  last_content text;
  last_at      timestamptz;
begin
  select count(*) into recent_count
  from private_messages
  where user_id    = NEW.user_id
    and channel_id = NEW.channel_id
    and created_at > now() - interval '60 seconds';
  if recent_count >= 12 then
    raise exception 'rate_limited: too many messages, slow down a little';
  end if;

  if NOT (trim(NEW.content) = '' and NEW.image_url is not null) then
    select content, created_at into last_content, last_at
    from private_messages
    where user_id    = NEW.user_id
      and channel_id = NEW.channel_id
    order by created_at desc
    limit 1;

    if last_content is not null
       and last_content = NEW.content
       and last_at > now() - interval '20 seconds' then
      raise exception 'rate_limited: duplicate message';
    end if;
  end if;

  if NEW.reply_to_id is not null and not exists (
    select 1 from private_messages
    where id = NEW.reply_to_id and channel_id = NEW.channel_id
  ) then
    raise exception 'invalid_reply: reply target not found in this channel';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_private_messages_guard on private_messages;
create trigger trg_private_messages_guard
  before insert on private_messages
  for each row execute function private_messages_guard();

create or replace function scrub_private_reply_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update private_messages
     set reply_to_id = null,
         reply_to_content = null
   where reply_to_id = OLD.id;
  return OLD;
end;
$$;

drop trigger if exists trg_scrub_private_reply_snapshot on private_messages;
create trigger trg_scrub_private_reply_snapshot
  after delete on private_messages
  for each row execute function scrub_private_reply_snapshot();

create or replace function private_channels_touch_last_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update private_channels
     set last_message_at = NEW.created_at,
         last_message_preview = case
           when trim(NEW.content) <> '' then left(NEW.content, 120)
           else '📷 Photo'
         end,
         last_message_user_id = NEW.user_id,
         updated_at = now()
   where id = NEW.channel_id;
  return NEW;
end;
$$;

drop trigger if exists trg_private_channels_touch_last_message on private_messages;
create trigger trg_private_channels_touch_last_message
  after insert on private_messages
  for each row execute function private_channels_touch_last_message();

create or replace function private_channels_recompute_last_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  newest record;
begin
  select content, created_at, user_id into newest
  from private_messages
  where channel_id = OLD.channel_id
  order by created_at desc
  limit 1;

  update private_channels
     set last_message_at      = case when newest is null then null else newest.created_at end,
         last_message_preview  = case
           when newest is null              then null
           when trim(newest.content) <> '' then left(newest.content, 120)
           else '📷 Photo'
         end,
         last_message_user_id  = case when newest is null then null else newest.user_id end,
         updated_at            = now()
   where id = OLD.channel_id;
  return OLD;
end;
$$;

drop trigger if exists trg_private_channels_recompute_last_message on private_messages;
create trigger trg_private_channels_recompute_last_message
  after delete on private_messages
  for each row execute function private_channels_recompute_last_message();

create or replace function get_private_chat_directory() returns table(user_id uuid, name text, mascot text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'not_authorized: founders only';
  end if;
  return query
    select p.user_id, p.name, p.mascot
    from profiles p
    where coalesce(p.community_opt_out, false) = false
      and p.user_id <> auth.uid()
    order by p.name asc;
end;
$$;
revoke all on function get_private_chat_directory() from public;
grant execute on function get_private_chat_directory() to authenticated;

-- ============================================================
-- 7. STORAGE BUCKETS & POLICIES (Post / Chat / Private Images)
-- ============================================================

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values
      ('community-post-images', 'community-post-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
      ('community-chat-images', 'community-chat-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
      ('private-chat-images',   'private-chat-images',   true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
    on conflict (id) do update set
      public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists "community post images public read" on storage.objects;
    create policy "community post images public read" on storage.objects
      for select using (bucket_id = 'community-post-images');

    drop policy if exists "community post images insert own" on storage.objects;
    create policy "community post images insert own" on storage.objects
      for insert with check (
        bucket_id = 'community-post-images'
        and auth.uid()::text = (storage.foldername(name))[1]
      );

    drop policy if exists "community post images delete own" on storage.objects;
    create policy "community post images delete own" on storage.objects
      for delete using (
        bucket_id = 'community-post-images'
        and auth.uid()::text = (storage.foldername(name))[1]
      );

    drop policy if exists "community chat images public read" on storage.objects;
    create policy "community chat images public read" on storage.objects
      for select using (bucket_id = 'community-chat-images');

    drop policy if exists "community chat images insert own" on storage.objects;
    create policy "community chat images insert own" on storage.objects
      for insert with check (
        bucket_id = 'community-chat-images'
        and auth.uid()::text = (storage.foldername(name))[1]
      );

    drop policy if exists "community chat images delete own" on storage.objects;
    create policy "community chat images delete own" on storage.objects
      for delete using (
        bucket_id = 'community-chat-images'
        and auth.uid()::text = (storage.foldername(name))[1]
      );

    drop policy if exists "private chat images public read" on storage.objects;
    create policy "private chat images public read" on storage.objects
      for select using (bucket_id = 'private-chat-images');

    drop policy if exists "private chat images insert own if member" on storage.objects;
    create policy "private chat images insert own if member" on storage.objects
      for insert with check (
        bucket_id = 'private-chat-images'
        and auth.uid()::text = (storage.foldername(name))[2]
        and (
          is_private_channel_member(((storage.foldername(name))[1])::uuid)
          or is_admin(auth.uid())
        )
      );

    drop policy if exists "private chat images delete own" on storage.objects;
    drop policy if exists "private chat images delete own or founder" on storage.objects;
    create policy "private chat images delete own or founder" on storage.objects
      for delete using (
        bucket_id = 'private-chat-images'
        and (
          auth.uid()::text = (storage.foldername(name))[2]
          or is_admin(auth.uid())
          or (
            is_moderator(auth.uid())
            and not is_mod_protected(((storage.foldername(name))[2])::uuid)
          )
        )
      );
  end if;
end $$;

-- ---------- REALTIME FOR COMMUNITY & PRIVATE CHAT ----------
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'community_channels', 'community_messages', 'community_posts',
    'community_replies', 'community_reactions', 'accountability_goals',
    'community_focus_locks', 'community_chat_bans',
    'private_channels', 'private_channel_members', 'private_messages'
  ])
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I;', t);
    end if;
  end loop;
end $$;

-- ============================================================
-- 8. GROUP TIMER (v1 + v2: Rooms, Stints, Bans, Host Controls, Stats)
-- ============================================================

create table if not exists study_groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (char_length(trim(name)) between 2 and 40),
  is_public boolean not null default false,
  join_code text unique,
  created_by uuid references auth.users(id) on delete set null,
  description text,
  rules text,
  goal_hours int,
  focus_lock boolean not null default false,
  created_at timestamptz not null default now(),
  check (
    (is_public and join_code is null)
    or (not is_public and join_code is not null)
  ),
  constraint study_groups_description_len check (description is null or char_length(description) <= 200),
  constraint study_groups_rules_len check (rules is null or char_length(rules) <= 600),
  constraint study_groups_goal_range check (goal_hours is null or (goal_hours between 1 and 10000))
);

alter table study_groups
  add column if not exists description text,
  add column if not exists rules text,
  add column if not exists goal_hours int,
  add column if not exists focus_lock boolean not null default false;

create index if not exists idx_study_groups_public on study_groups(is_public) where is_public;
create index if not exists idx_study_groups_creator on study_groups(created_by);

create table if not exists study_group_members (
  group_id uuid not null references study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists idx_study_group_members_user on study_group_members(user_id);

create table if not exists study_group_stints (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);
create unique index if not exists uq_study_group_open_stint
  on study_group_stints(group_id, user_id) where left_at is null;
create index if not exists idx_study_group_stints_user on study_group_stints(user_id, joined_at);
alter table study_group_stints enable row level security;

create table if not exists study_group_bans (
  group_id uuid not null references study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  banned_at timestamptz not null default now(),
  banned_by uuid references auth.users(id) on delete set null,
  primary key (group_id, user_id)
);
alter table study_group_bans enable row level security;

create or replace function is_study_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from study_group_members where group_id = gid and user_id = auth.uid()
  );
$$;
revoke all on function is_study_group_member(uuid) from public;
grant execute on function is_study_group_member(uuid) to authenticated;

create or replace function is_study_group_host(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    is_moderator(auth.uid())
    or exists (
      select 1 from study_groups g
      where g.id = gid and g.created_by = auth.uid() and is_study_group_member(g.id)
    )
  );
$$;
revoke all on function is_study_group_host(uuid) from public;
grant execute on function is_study_group_host(uuid) to authenticated;

alter table study_groups enable row level security;
alter table study_group_members enable row level security;

drop policy if exists "study groups read public or member" on study_groups;
create policy "study groups read public or member" on study_groups
  for select using (is_public or is_study_group_member(id));

drop policy if exists "study groups delete creator or mod" on study_groups;
create policy "study groups delete creator or mod" on study_groups
  for delete using (created_by = auth.uid() or is_moderator(auth.uid()));

drop policy if exists "study group members read" on study_group_members;
create policy "study group members read" on study_group_members
  for select using (user_id = auth.uid() or is_study_group_member(group_id));

create or replace function gt_make_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := decode(md5(gen_random_uuid()::text), 'hex');
  code text := '';
  i int;
begin
  for i in 0..5 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;
revoke all on function gt_make_code() from public;

create or replace function gt_group_cap(is_pub boolean) returns int
language sql immutable as $$ select case when is_pub then 60 else 30 end; $$;
revoke all on function gt_group_cap(boolean) from public;

create or replace function gt_create_group(p_name text, p_is_public boolean default false)
returns study_groups
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  clean text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  made_count int;
  attempt int := 0;
  new_code text;
  row_out study_groups;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if char_length(clean) < 2 or char_length(clean) > 40 then
    raise exception 'Group name must be 2–40 characters.';
  end if;
  if p_is_public and not is_moderator(uid) then
    raise exception 'Only founders and moderators can create public groups.';
  end if;
  select count(*) into made_count from study_groups where created_by = uid;
  if made_count >= 5 and not is_moderator(uid) then
    raise exception 'You can create up to 5 groups. Delete one first.';
  end if;
  loop
    attempt := attempt + 1;
    new_code := case when p_is_public then null else gt_make_code() end;
    begin
      insert into study_groups (name, is_public, join_code, created_by)
      values (clean, coalesce(p_is_public, false), new_code, uid)
      returning * into row_out;
      exit;
    exception when unique_violation then
      if attempt >= 8 then raise exception 'Could not generate a join code, try again.'; end if;
    end;
  end loop;
  insert into study_group_members (group_id, user_id) values (row_out.id, uid) on conflict do nothing;
  insert into study_group_stints (group_id, user_id) values (row_out.id, uid) on conflict do nothing;
  return row_out;
end;
$$;
revoke all on function gt_create_group(text, boolean) from public;
grant execute on function gt_create_group(text, boolean) to authenticated;

create or replace function gt_join_public(p_group_id uuid)
returns study_groups
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g study_groups;
  n int;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  select * into g from study_groups where id = p_group_id and is_public;
  if not found then raise exception 'That group does not exist any more.'; end if;
  if exists (select 1 from study_group_bans where group_id = g.id and user_id = uid) then
    raise exception 'You can''t join this group.';
  end if;
  if not exists (select 1 from study_group_members where group_id = g.id and user_id = uid) then
    select count(*) into n from study_group_members where group_id = g.id;
    if n >= gt_group_cap(true) then raise exception 'This group is full.'; end if;
    insert into study_group_members (group_id, user_id) values (g.id, uid) on conflict do nothing;
  end if;
  insert into study_group_stints (group_id, user_id) values (g.id, uid) on conflict do nothing;
  select * into g from study_groups where id = p_group_id;
  return g;
end;
$$;
revoke all on function gt_join_public(uuid) from public;
grant execute on function gt_join_public(uuid) to authenticated;

create or replace function gt_join_by_code(p_code text)
returns study_groups
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  g study_groups;
  n int;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if char_length(clean) <> 6 then raise exception 'Codes are 6 characters long.'; end if;
  select * into g from study_groups where join_code = clean and not is_public;
  if not found then raise exception 'No group found with that code.'; end if;
  if exists (select 1 from study_group_bans where group_id = g.id and user_id = uid) then
    raise exception 'No group found with that code.';
  end if;
  if not exists (select 1 from study_group_members where group_id = g.id and user_id = uid) then
    select count(*) into n from study_group_members where group_id = g.id;
    if n >= gt_group_cap(false) then raise exception 'This group is full.'; end if;
    insert into study_group_members (group_id, user_id) values (g.id, uid) on conflict do nothing;
  end if;
  insert into study_group_stints (group_id, user_id) values (g.id, uid) on conflict do nothing;
  return g;
end;
$$;
revoke all on function gt_join_by_code(text) from public;
grant execute on function gt_join_by_code(text) to authenticated;

create or replace function gt_leave_group(p_group_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  left_over int;
  heir uuid;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  delete from study_group_members where group_id = p_group_id and user_id = uid;
  update study_group_stints set left_at = now()
    where group_id = p_group_id and user_id = uid and left_at is null;
  select count(*) into left_over from study_group_members where group_id = p_group_id;
  if left_over = 0 then
    delete from study_groups where id = p_group_id and created_by is not null;
  else
    select user_id into heir from study_group_members where group_id = p_group_id order by joined_at asc, user_id limit 1;
    update study_groups set created_by = heir where id = p_group_id and created_by = uid;
  end if;
end;
$$;
revoke all on function gt_leave_group(uuid) from public;
grant execute on function gt_leave_group(uuid) to authenticated;

create or replace function gt_delete_group(p_group_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  gone int;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  delete from study_groups
  where id = p_group_id and (created_by = uid or is_moderator(uid));
  get diagnostics gone = row_count;
  return gone > 0;
end;
$$;
revoke all on function gt_delete_group(uuid) from public;
grant execute on function gt_delete_group(uuid) to authenticated;

create or replace function gt_server_time() returns bigint
language sql stable as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint; $$;
revoke all on function gt_server_time() from public;
grant execute on function gt_server_time() to authenticated;

create or replace function gt_list_public_groups()
returns table(id uuid, name text, member_count bigint, is_member boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.name,
         (select count(*) from study_group_members m where m.group_id = g.id) as member_count,
         exists (select 1 from study_group_members m where m.group_id = g.id and m.user_id = auth.uid()) as is_member,
         g.created_at
  from study_groups g
  where g.is_public
  order by member_count desc, g.name asc;
$$;
revoke all on function gt_list_public_groups() from public;
grant execute on function gt_list_public_groups() to authenticated;

create or replace function gt_my_groups()
returns table(id uuid, name text, is_public boolean, join_code text, created_by uuid, member_count bigint, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.is_public, g.join_code, g.created_by,
         (select count(*) from study_group_members m2 where m2.group_id = g.id) as member_count,
         g.created_at
  from study_groups g
  join study_group_members m on m.group_id = g.id and m.user_id = auth.uid()
  order by m.joined_at desc;
$$;
revoke all on function gt_my_groups() from public;
grant execute on function gt_my_groups() to authenticated;

create or replace function gt_update_group(
  p_group_id uuid, p_name text, p_description text, p_rules text, p_goal_hours int
) returns study_groups
language plpgsql security definer set search_path = public as $$
declare
  clean_name text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  clean_desc text := nullif(trim(coalesce(p_description, '')), '');
  clean_rules text := nullif(trim(coalesce(p_rules, '')), '');
  row_out study_groups;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if not is_study_group_host(p_group_id) then raise exception 'Only the host can change this.'; end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 40 then
    raise exception 'Group name must be 2–40 characters.';
  end if;
  if clean_desc is not null and char_length(clean_desc) > 200 then
    raise exception 'Description can be up to 200 characters.';
  end if;
  if clean_rules is not null and char_length(clean_rules) > 600 then
    raise exception 'Rules can be up to 600 characters.';
  end if;
  if p_goal_hours is not null and (p_goal_hours < 1 or p_goal_hours > 10000) then
    raise exception 'Weekly goal must be between 1 and 10000 hours.';
  end if;
  update study_groups
     set name = clean_name, description = clean_desc, rules = clean_rules, goal_hours = p_goal_hours
   where id = p_group_id
  returning * into row_out;
  if not found then raise exception 'That group does not exist any more.'; end if;
  return row_out;
end;
$$;
revoke all on function gt_update_group(uuid, text, text, text, int) from public;
grant execute on function gt_update_group(uuid, text, text, text, int) to authenticated;

create or replace function gt_set_focus_lock(p_group_id uuid, p_locked boolean)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if not is_study_group_host(p_group_id) then raise exception 'Only the host can change this.'; end if;
  update study_groups set focus_lock = coalesce(p_locked, false) where id = p_group_id;
  if not found then raise exception 'That group does not exist any more.'; end if;
  return coalesce(p_locked, false);
end;
$$;
revoke all on function gt_set_focus_lock(uuid, boolean) from public;
grant execute on function gt_set_focus_lock(uuid, boolean) to authenticated;

create or replace function gt_regenerate_code(p_group_id uuid)
returns study_groups
language plpgsql security definer set search_path = public as $$
declare
  g study_groups;
  attempt int := 0;
  row_out study_groups;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if not is_study_group_host(p_group_id) then raise exception 'Only the host can change this.'; end if;
  select * into g from study_groups where id = p_group_id;
  if not found then raise exception 'That group does not exist any more.'; end if;
  if g.is_public then raise exception 'Public groups have no join code.'; end if;
  loop
    attempt := attempt + 1;
    begin
      update study_groups set join_code = gt_make_code() where id = p_group_id returning * into row_out;
      exit;
    exception when unique_violation then
      if attempt >= 8 then raise exception 'Could not generate a join code, try again.'; end if;
    end;
  end loop;
  return row_out;
end;
$$;
revoke all on function gt_regenerate_code(uuid) from public;
grant execute on function gt_regenerate_code(uuid) to authenticated;

create or replace function gt_kick_member(p_group_id uuid, p_user_id uuid, p_ban boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g study_groups;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if not is_study_group_host(p_group_id) then raise exception 'Only the host can remove members.'; end if;
  select * into g from study_groups where id = p_group_id;
  if not found then raise exception 'That group does not exist any more.'; end if;
  if p_user_id = uid then raise exception 'Use Leave group to leave yourself.'; end if;
  if p_user_id = g.created_by or is_moderator(p_user_id) then
    raise exception 'You can''t remove the host.';
  end if;
  if not exists (select 1 from study_group_members where group_id = p_group_id and user_id = p_user_id) then
    raise exception 'That person is not in this group.';
  end if;
  delete from study_group_members where group_id = p_group_id and user_id = p_user_id;
  update study_group_stints set left_at = now()
    where group_id = p_group_id and user_id = p_user_id and left_at is null;
  if coalesce(p_ban, false) then
    insert into study_group_bans (group_id, user_id, banned_by) values (p_group_id, p_user_id, uid)
    on conflict (group_id, user_id) do nothing;
  end if;
end;
$$;
revoke all on function gt_kick_member(uuid, uuid, boolean) from public;
grant execute on function gt_kick_member(uuid, uuid, boolean) to authenticated;

create or replace function gt_unban_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if not is_study_group_host(p_group_id) then raise exception 'Only the host can change this.'; end if;
  delete from study_group_bans where group_id = p_group_id and user_id = p_user_id;
end;
$$;
revoke all on function gt_unban_member(uuid, uuid) from public;
grant execute on function gt_unban_member(uuid, uuid) to authenticated;

create or replace function gt_group_bans(p_group_id uuid)
returns table(user_id uuid, banned_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_study_group_host(p_group_id) then raise exception 'Only the host can see this.'; end if;
  return query select b.user_id, b.banned_at from study_group_bans b where b.group_id = p_group_id order by b.banned_at desc;
end;
$$;
revoke all on function gt_group_bans(uuid) from public;
grant execute on function gt_group_bans(uuid) to authenticated;

create or replace function gt_group_roster(p_group_id uuid)
returns table(user_id uuid, joined_at timestamptz, is_host boolean, last_studied_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if not (is_study_group_member(p_group_id) or is_study_group_host(p_group_id)) then
    raise exception 'You are not a member of this group.';
  end if;
  return query
    select m.user_id, m.joined_at,
           (m.user_id = g.created_by or is_moderator(m.user_id)) as is_host,
           (select max(ts.created_at) from timer_sessions ts
             where ts.user_id = m.user_id and ts.completed is true
               and ts.actual_minutes > 0 and ts.actual_minutes <= 600) as last_studied_at
    from study_group_members m
    join study_groups g on g.id = m.group_id
    where m.group_id = p_group_id
    order by m.joined_at asc, m.user_id;
end;
$$;
revoke all on function gt_group_roster(uuid) from public;
grant execute on function gt_group_roster(uuid) to authenticated;

create or replace function gt_group_stats(p_group_id uuid, p_range text default 'week')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Kolkata')::date;
  wk_start date := (now() at time zone 'Asia/Kolkata')::date
                   - (extract(isodow from (now() at time zone 'Asia/Kolkata')::date)::int - 1);
  d_from date;
  d_to date;
  g study_groups;
  result jsonb;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  select * into g from study_groups where id = p_group_id;
  if not found then raise exception 'That group does not exist any more.'; end if;
  if not is_study_group_member(p_group_id) then raise exception 'Join this group to see its stats.'; end if;

  if p_range = 'today' then d_from := today; d_to := today;
  elsif p_range = 'week' then d_from := wk_start; d_to := wk_start + 6;
  elsif p_range = 'last_week' then d_from := wk_start - 7; d_to := wk_start - 1;
  elsif p_range = 'all' then d_from := null; d_to := null;
  else raise exception 'Unknown range.';
  end if;

  with pd as (
    select s.user_id, s.d, least(sum(s.m), 780) as m, count(*) as n
    from (
      select ts.user_id,
             (ts.created_at at time zone 'Asia/Kolkata')::date as d,
             ts.actual_minutes::numeric as m
      from study_group_stints st
      join timer_sessions ts
        on ts.user_id = st.user_id
       and ts.created_at >= st.joined_at
       and (st.left_at is null or ts.created_at < st.left_at)
      where st.group_id = p_group_id
        and ts.completed is true
        and ts.actual_minutes > 0 and ts.actual_minutes <= 600
    ) s
    group by s.user_id, s.d
  ),
  win as (
    select * from pd where (d_from is null or d >= d_from) and (d_to is null or d <= d_to)
  ),
  tot as (
    select coalesce(sum(m), 0) as minutes, coalesce(sum(n), 0) as sessions,
           count(distinct user_id) filter (where m > 0) as active
    from win
  ),
  brd as (
    select coalesce(jsonb_agg(jsonb_build_object(
             'user_id', b.user_id, 'minutes', round(b.minutes, 4),
             'sessions', b.sessions, 'rank', b.rnk
           ) order by b.minutes desc, b.sessions desc, b.joined_at asc, b.user_id), '[]'::jsonb) as j
    from (
      select mm.user_id, mm.joined_at,
             coalesce(pu.minutes, 0) as minutes, coalesce(pu.sessions, 0) as sessions,
             rank() over (order by coalesce(pu.minutes, 0) desc) as rnk
      from study_group_members mm
      left join (
        select user_id, sum(m) as minutes, sum(n) as sessions from win group by user_id
      ) pu on pu.user_id = mm.user_id
      where mm.group_id = p_group_id
    ) b
  ),
  dly as (
    select coalesce(jsonb_agg(jsonb_build_object('date', x.d, 'minutes', round(x.m, 4)) order by x.d), '[]'::jsonb) as j
    from (select d, sum(m) as m from win group by d) x
  ),
  anc as (
    select case when exists (select 1 from pd where d = today and m >= 10) then today else today - 1 end as a
  ),
  stk as (
    select count(*) as c from (
      select z.d, row_number() over (order by z.d desc) as rn
      from (select distinct d from pd where m >= 10 and d <= (select a from anc)) z
    ) y
    where (select a from anc) - y.d = y.rn - 1
  )
  select jsonb_build_object(
    'rule_version', 'v1',
    'range', p_range,
    'from', d_from, 'to', d_to,
    'total_minutes', round((select minutes from tot), 4),
    'total_sessions', (select sessions from tot),
    'active_members', (select active from tot),
    'members_count', (select count(*) from study_group_members where group_id = p_group_id),
    'goal_hours', g.goal_hours,
    'streak_days', (select c from stk),
    'board', (select j from brd),
    'daily', (select j from dly)
  ) into result;

  return result;
end;
$$;
revoke all on function gt_group_stats(uuid, text) from public;
grant execute on function gt_group_stats(uuid, text) to authenticated;

-- Seed starter public study rooms (NEET UG + Biology + Physics + Chemistry + Maths)
insert into study_groups (name, is_public, created_by)
select v.name, true, null
from (values
  ('Open Study Hall'),
  ('NEET UG Grind Room'),
  ('Biology Focus (Botany & Zoology)'),
  ('Physics Focus'),
  ('Chemistry Focus'),
  ('Maths Focus')
) as v(name)
where not exists (select 1 from study_groups g where g.is_public and g.name = v.name);

-- ============================================================
-- 9. BACKFILL EXISTING USERS (Safe no-op on fresh install)
-- ============================================================
do $$
declare r record;
begin
  for r in select user_id from profiles loop
    perform lb_recompute(r.user_id);
  end loop;
end $$;
