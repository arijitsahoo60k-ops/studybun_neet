-- ============================================================
-- Migration: Streak freeze tokens
-- ============================================================
-- Adds a Duolingo-style streak freeze: everyone starts with 1 token, and
-- earns one more for every 7 genuine study days logged (capped at 2 held
-- at once). If a single day gets missed, the app auto-spends a token to
-- silently cover that date so the streak keeps running instead of
-- resetting to 0 — protecting a streak someone's already built tends to
-- matter more for retention than any one-off celebration, since loss
-- aversion is a stronger driver than reward.
--
-- Safe to run on an existing database. Functions are create-or-replace;
-- "add column if not exists" / "create table if not exists" are idempotent.
--
-- Client counterpart: src/App.jsx (streakFreezesQ, the auto-apply effect,
-- and the token-grant effect). Keep the "genuine study day" definition
-- inside sb_recompute_streak_freeze_grants() below in sync with
-- taskDayCompletion/streakDays in App.jsx if that rule ever changes again.
-- ============================================================

alter table profiles add column if not exists streak_freeze_tokens int not null default 1;
-- Bookkeeping only — how many 7-day chunks of real study days have already
-- been converted into a token, so re-running the grant check never
-- double-grants for the same milestone.
alter table profiles add column if not exists streak_freeze_granted_days int not null default 0;

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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'streak_freezes'
  ) then
    alter publication supabase_realtime add table streak_freezes;
  end if;
end $$;

-- ---------- earn tokens ----------
-- Call this whenever the client's totalStudyDays changes (see App.jsx).
-- Counts real (non-frozen) genuine study days, lifetime, and grants a
-- token for every new complete week of them, capped at 2 held at once.
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
    select session_date as d from study_sessions where user_id = uid and minutes >= 5
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

  tokens_owed := real_days / 7; -- integer division: floor(real_days / 7)
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

-- ---------- spend a token ----------
-- Called by the client the moment it notices a single missed day would
-- otherwise break an active streak (see App.jsx). Idempotent per date —
-- inserting the same frozen_date twice just no-ops and returns false
-- instead of charging a second token.
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
    return false; -- already frozen this date on an earlier attempt
  end if;

  update profiles set streak_freeze_tokens = streak_freeze_tokens - 1 where user_id = uid;
  return true;
end;
$$;
revoke execute on function sb_apply_streak_freeze(date) from public;
grant execute on function sb_apply_streak_freeze(date) to authenticated;

-- ---------- fold frozen days into the server-side streak too ----------
-- Same shape as migration_streak_tasks.sql, now with a fifth signal.
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
    exists (select 1 from study_sessions where user_id = uid and session_date = d and minutes >= 5)
    or exists (
      select 1 from timer_sessions
      where user_id = uid and completed = true and actual_minutes >= 10
        and (created_at at time zone 'Asia/Kolkata')::date = d
    )
    or exists (select 1 from question_logs where user_id = uid and log_date = d and count >= 1)
    or exists (
      select 1 from tasks where user_id = uid and due_date = d
      group by due_date having count(*) filter (where status <> 'Completed') = 0
    )
    or exists (select 1 from streak_freezes where user_id = uid and frozen_date = d)
  into today_logged;
  if not today_logged then
    d := d - 1;
  end if;
  loop
    select
      exists (select 1 from study_sessions where user_id = uid and session_date = d and minutes >= 5)
      or exists (
        select 1 from timer_sessions
        where user_id = uid and completed = true and actual_minutes >= 10
          and (created_at at time zone 'Asia/Kolkata')::date = d
      )
      or exists (select 1 from question_logs where user_id = uid and log_date = d and count >= 1)
      or exists (
        select 1 from tasks where user_id = uid and due_date = d
        group by due_date having count(*) filter (where status <> 'Completed') = 0
      )
      or exists (select 1 from streak_freezes where user_id = uid and frozen_date = d)
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
begin
  select count(distinct d) into active_days from (
    select session_date as d from study_sessions
      where user_id = uid and minutes >= 5 and session_date >= window_start
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
    and (planned_minutes is null or abs(actual_minutes - planned_minutes) <= greatest(3, planned_minutes * 0.15))
    and (created_at at time zone 'Asia/Kolkata')::date >= window_start;

  select coalesce(sum(least(daily, 300)), 0) into timer_mins from (
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
end;
$$;
revoke execute on function lb_recompute(uuid) from public;

-- streak_freezes wasn't in the trigger list before — add it so applying a
-- freeze recomputes the leaderboard row immediately.
drop trigger if exists trg_lb_recompute on streak_freezes;
create trigger trg_lb_recompute after insert or update or delete on streak_freezes
  for each row execute function lb_trg_recompute();

-- Backfill: work out how many token-grants each existing user has already
-- "earned" by their lifetime real study days, so the first client-side
-- call to sb_recompute_streak_freeze_grants() doesn't hand out a pile of
-- extra tokens for history that predates this migration. Every user still
-- starts with 1 spendable token (the column default above); this only
-- fixes the bookkeeping counter so future grants are correctly incremental.
do $$
declare
  r record;
  real_days int;
begin
  for r in select user_id from profiles loop
    select count(distinct d) into real_days from (
      select session_date as d from study_sessions where user_id = r.user_id and minutes >= 5
      union
      select (created_at at time zone 'Asia/Kolkata')::date as d from timer_sessions
        where user_id = r.user_id and completed = true and actual_minutes >= 10
      union
      select log_date as d from question_logs where user_id = r.user_id and count >= 1
      union
      select due_date as d from tasks where user_id = r.user_id
        group by due_date having count(*) filter (where status <> 'Completed') = 0
    ) t;
    update profiles set streak_freeze_granted_days = real_days / 7 where user_id = r.user_id;
  end loop;
end $$;

do $$
declare r record;
begin
  for r in select user_id from profiles loop
    perform lb_recompute(r.user_id);
  end loop;
end $$;
