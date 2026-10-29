-- ============================================================
-- Migration: Streak/active-day rule now includes "full day plan cleared"
-- ============================================================
-- Safe to run on an existing StudyBun database — both functions below
-- are create-or-replace, so re-running this is harmless.
--
-- Why: previously a streak day only fired from logged study time (a
-- study_sessions row, a completed timer_sessions row, or a question_logs
-- row — see migration_streak_questions.sql). Someone who planned a full
-- day in the Daily Planner and genuinely finished every task on it got
-- nothing for it if they didn't also log minutes separately. This
-- migration adds a fourth qualifying signal, matching the client
-- (src/App.jsx: taskDayCompletion / streakDays): a day counts if the user
-- had at least one task due that day (tasks.due_date) and every task due
-- that day has status = 'Completed'. An empty day never vacuously counts.
-- Keep this in sync with src/App.jsx if the rule ever changes again.
-- ============================================================

create or replace function lb_calc_streak(uid uuid) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  -- StudyBun's "day" is IST (Asia/Kolkata), not whatever timezone this
  -- Postgres session defaults to (Supabase defaults to UTC).
  d date := (now() at time zone 'Asia/Kolkata')::date;
  streak_n int := 0;
  has_day boolean;
  today_logged boolean;
begin
  -- If today has no qualifying day yet, don't let that alone zero the
  -- streak out (the day isn't over). Start counting from yesterday
  -- instead, so the streak only truly resets once a full day has gone
  -- by with nothing logged — a genuine 2-day gap (today + yesterday
  -- both empty).
  select
    exists (
      select 1 from study_sessions
      where user_id = uid and session_date = d and minutes >= 5
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
      group by due_date
      having count(*) filter (where status <> 'Completed') = 0
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
        group by due_date
        having count(*) filter (where status <> 'Completed') = 0
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

-- Only the "distinct genuine study days" part of lb_recompute() changes —
-- everything else (scoring weights, caps, streak call) is untouched.
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
  -- distinct genuine study days in the window — now also true on a day
  -- where every planned task got completed, matching the client and the
  -- streak above.
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
  ) t;

  -- valid completed focus sessions, capped at 8/day equivalent (240 over the window)
  select least(count(*), 240) into sessions_n
  from timer_sessions
  where user_id = uid and completed = true
    and actual_minutes >= 10 and actual_minutes <= 240
    and (planned_minutes is null or abs(actual_minutes - planned_minutes) <= greatest(3, planned_minutes * 0.15))
    and (created_at at time zone 'Asia/Kolkata')::date >= window_start;

  -- trusted (timer-verified) minutes, capped 300/day then summed
  select coalesce(sum(least(daily, 300)), 0) into timer_mins from (
    select (created_at at time zone 'Asia/Kolkata')::date as d, sum(actual_minutes) as daily
    from timer_sessions
    where user_id = uid and completed = true and actual_minutes between 10 and 600
      and (created_at at time zone 'Asia/Kolkata')::date >= window_start
    group by 1
  ) t;

  -- self-reported minutes, capped 180/day then summed (lower weight applied later)
  select coalesce(sum(least(daily, 180)), 0) into manual_mins from (
    select session_date as d, sum(minutes) as daily
    from study_sessions
    where user_id = uid and minutes between 5 and 600 and session_date >= window_start
    group by 1
  ) t;

  -- questions solved, capped 100/day then summed
  select coalesce(sum(least(daily, 100)), 0) into questions_n from (
    select log_date as d, sum(count) as daily
    from question_logs
    where user_id = uid and count between 1 and 500 and log_date >= window_start
    group by 1
  ) t;

  -- mock tests, capped at 1/day equivalent
  select least(count(*), 30) into mocks_n
  from mock_tests where user_id = uid and mock_date >= window_start;

  -- chapters newly completed/mastered in the window (first-time only, via completed_at)
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
    return; -- no profile yet (shouldn't happen, but never write a row with no owner context)
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

-- tasks weren't in the trigger list before (nothing about a task edit used
-- to change your leaderboard row) — add it so completing/reopening/deleting
-- a task recomputes the streak + score live, same as every other table.
drop trigger if exists trg_lb_recompute on tasks;
create trigger trg_lb_recompute after insert or update or delete on tasks
  for each row execute function lb_trg_recompute();

-- Backfill: recompute every existing user's row now that the rule
-- includes fully-completed task days, so nobody's leaderboard streak
-- looks stale the moment this migration runs.
do $$
declare r record;
begin
  for r in select user_id from profiles loop
    perform lb_recompute(r.user_id);
  end loop;
end $$;
