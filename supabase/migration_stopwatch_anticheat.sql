-- ============================================================
-- Migration: Stopwatch anti-cheat tightening
-- ============================================================
-- Safe to run on an existing StudyBun database — this only
-- replaces lb_recompute() (create-or-replace, same as the
-- original migration_leaderboard.sql) and then re-runs it for
-- every existing user to correct any score already inflated by
-- the gap below. Nothing else changes.
--
-- THE GAP:
-- The Focus Timer's new Stopwatch mode has no target duration,
-- so the app logs it with planned_minutes = null. The scoring
-- function's flat "+3 per completed session" bonus (sessions_n
-- below) used `planned_minutes is null` as an automatic pass —
-- meant defensively, but Stopwatch is the first mode that
-- actually triggers it. That let a user farm the +3 bonus with
-- back-to-back 10-minute Stopwatch sessions (up to the 8/day
-- cap = +24/day), far more easily than genuinely finishing a
-- real session in any countdown mode, where actual_minutes has
-- to land close to planned_minutes to qualify.
--
-- THE FIX:
-- The flat completion bonus now requires a real plan to have
-- been matched — planned_minutes must be present AND close to
-- actual_minutes. A Stopwatch session no longer earns the flat
-- bonus, full stop. It still earns everything else it always
-- did: the trusted per-minute credit (+0.5/min, capped 300
-- min/day via timer_mins), and streak/active-day credit (which
-- only ever required actual_minutes >= 10, unchanged). Nothing
-- about Stopwatch's minutes being untrustworthy — it's still a
-- real, timer-verified session — this only removes the "this
-- was a genuine full session, not just idle time" bonus for a
-- mode that has no way to verify what "full" even means.
-- ============================================================

create or replace function lb_recompute(uid uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- IST day boundary, same as lb_calc_streak above.
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
  -- distinct genuine study days in the window
  select count(distinct d) into active_days from (
    select session_date as d from study_sessions
      where user_id = uid and minutes >= 5 and session_date >= window_start
    union
    select (created_at at time zone 'Asia/Kolkata')::date as d from timer_sessions
      where user_id = uid and completed = true and actual_minutes >= 10
        and (created_at at time zone 'Asia/Kolkata')::date >= window_start
  ) t;

  -- valid completed focus sessions, capped at 8/day equivalent (240 over the window).
  -- planned_minutes must be present AND matched (not merely "not contradicted") —
  -- a null plan (e.g. Stopwatch) can never itself satisfy this, since there's
  -- nothing to have matched. See migration note above.
  select least(count(*), 240) into sessions_n
  from timer_sessions
  where user_id = uid and completed = true
    and actual_minutes >= 10 and actual_minutes <= 240
    and planned_minutes is not null
    and abs(actual_minutes - planned_minutes) <= greatest(3, planned_minutes * 0.15)
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

-- Re-run for every existing user so any score already inflated by the gap
-- above (however briefly this was live) is corrected immediately, not just
-- for the next natural trigger fire. Harmless no-op for anyone unaffected.
do $$
declare r record;
begin
  for r in select user_id from profiles loop
    perform lb_recompute(r.user_id);
  end loop;
end $$;
