-- ============================================================
-- Migration: Raise focus-timer daily minutes cap (5h -> 13h)
-- ============================================================
-- Safe to run on an existing StudyBun database — idempotent
-- (create-or-replace), and ends by re-running lb_recompute() for
-- every existing user so anyone under-credited by the old cap is
-- fixed immediately, not just on their next study-log write.
--
-- THE PROBLEM:
-- lb_recompute(uid) turns timer-verified focus-timer minutes into
-- points at +0.5/min, but only after capping each day's minutes at
-- 300 (5 hours) before summing across the 30-day window:
--     select coalesce(sum(least(daily, 300)), 0) into timer_mins ...
-- JEE aspirants routinely study 10-13+ hours a day. Every genuine
-- minute past the 5-hour mark on a given day was silently thrown
-- away — not stored wrong, just never scored.
--
-- THE FIX:
-- Raise the per-day cap from 300 to 780 minutes (13 hours), which
-- comfortably covers realistic serious-prep days. Nothing else about
-- the scoring formula, weighting, or other anti-cheat caps changes:
--   - manual_mins (self-reported "log a session" entries) keeps its
--     separate 180 min/day cap — untouched, different signal/table.
--   - sessions_n (the "+3 per valid completed session" bonus,
--     capped at 240/window ~= 8 sessions/day) is unchanged. A student
--     doing many short pomodoros could still hit that ceiling before
--     hitting the new 780-min cap; that's a distinct anti-cheat rule
--     around session *count*, not minutes, and is left alone here on
--     purpose to keep this change scoped to the one thing asked for.
--   - Single-session ceilings (timer_sessions_actual_range / DB CHECK
--     at 600 min, MAX_LOGGABLE_MINUTES in useFocusTimer.js) are
--     unaffected — 780 is a same-day SUM across sessions, not a
--     single-session limit.
--
-- CREDITING BACK LOST POINTS:
-- lb_recompute always recalculates a user's score from scratch by
-- re-reading their raw timer_sessions rows (which were never
-- truncated — only the *scoring* step capped them). So simply
-- re-running lb_recompute(uid) with the new 780 cap in place
-- automatically recovers every previously-discarded minute, for
-- every user, in one shot — no separate "reimbursement" bookkeeping
-- needed. That's exactly what section 2 below does.
--
-- THE ONE LIMIT ON "CREDITING BACK":
-- The score is a rolling 30-day window (window_start := today - 29),
-- not a lifetime total. This backfill can only recover minutes from
-- the last 30 days, because that's the entire span the score ever
-- looks at — days further back were already outside the window
-- before this change and stay that way. Nothing can retroactively
-- restore points from further back since the window itself never
-- kept them.
-- ============================================================

-- ---------- 1. lb_recompute: raise the daily timer-minutes cap ----------
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
  -- unchanged by this migration — see note above.
  select least(count(*), 240) into sessions_n
  from timer_sessions
  where user_id = uid and completed = true
    and actual_minutes >= 10 and actual_minutes <= 240
    and planned_minutes is not null
    and abs(actual_minutes - planned_minutes) <= greatest(3, planned_minutes * 0.15)
    and (created_at at time zone 'Asia/Kolkata')::date >= window_start;

  -- trusted (timer-verified) minutes, capped 780/day (13h) then summed.
  -- was capped at 300/day (5h) — that's the fix this migration makes.
  select coalesce(sum(least(daily, 780)), 0) into timer_mins from (
    select (created_at at time zone 'Asia/Kolkata')::date as d, sum(actual_minutes) as daily
    from timer_sessions
    where user_id = uid and completed = true and actual_minutes between 10 and 600
      and (created_at at time zone 'Asia/Kolkata')::date >= window_start
    group by 1
  ) t;

  -- self-reported minutes, capped 180/day then summed (lower weight applied later) — unchanged
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

-- ---------- 2. credit every existing user right now ----------
-- Recompute every user's score under the new 780-min cap immediately.
-- Anyone whose score rises because of this recovers exactly the points
-- they were unfairly denied (within the last 30 days — see note above).
-- This DOES insert rows into leaderboard_score_log for anyone whose
-- score moves (unlike the very first leaderboard_integrity migration,
-- which seeded a clean baseline) — that's intentional here: a genuine
-- upward jump from this fix is exactly the kind of event
-- useLeaderboardReconciliation.js / lb_recompute_and_report() already
-- know how to surface as a "missed points found" toast, so users
-- studying long days actually see their score correct itself.
do $$
declare r record;
begin
  for r in select user_id from profiles loop
    perform lb_recompute(r.user_id);
  end loop;
end $$;
