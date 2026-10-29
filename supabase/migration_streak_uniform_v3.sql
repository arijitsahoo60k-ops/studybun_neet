-- ============================================================
-- Migration: Uniform streak — canonical definition, all bugs fixed (v3)
-- ============================================================
-- v3 = v2, unchanged. I (Claude) initially "fixed" a fourth bug here —
-- restoring null-tolerance to sessions_n's planned_minutes check, on the
-- theory that Stopwatch sessions were being wrongly denied the +3
-- session-count bonus. That was WRONG and has been reverted. There's a
-- migration_stopwatch_anticheat.sql already in this repo, dated after
-- whichever migration first made that check null-tolerant, that explains
-- exactly why: a null planned_minutes (Stopwatch has no target duration)
-- let a user farm the flat +3 bonus with trivial back-to-back Stopwatch
-- sessions, up to +24/day, with no "did they actually finish a real
-- session" check possible. `planned_minutes is not null` is the
-- deliberate, documented fix for that — not a regression. Stopwatch
-- still earns everything else (the +0.5/min trusted credit and
-- streak/active-day credit); it only loses the flat completion bonus,
-- on purpose. v3 keeps v2's `planned_minutes is not null` as-is.
-- ============================================================
-- Run this once in your Supabase SQL editor. Every function is
-- create-or-replace; ends with a full user backfill so all streaks
-- are corrected the moment this lands, not on next write.
--
-- ================================================================
-- BUGS FIXED
-- ================================================================
--
-- BUG A — leaderboard streak > dashboard streak (e.g. 21 vs 20)
-- Root: lb_calc_streak queries ALL study_sessions rows, including
-- rows where platform = 'Focus Timer'. The client (App.jsx) filters
-- those out: manualSessions = sessions.filter(s.platform !== 'Focus Timer').
-- Focus Timer writes to study_sessions with minutes = startedMinutes
-- (the planned duration, NOT the actual elapsed time). So a 3-second
-- timer run on a 25-min pomodoro still writes minutes=25 to
-- study_sessions — the server counts it as a study day (minutes >= 5),
-- the client correctly doesn't (timer_sessions actual_minutes < 10,
-- study_sessions excluded as Focus Timer platform row). This caused
-- leaderboard streak > dashboard streak by however many such days exist.
-- FIX: add (platform IS NULL OR platform <> 'Focus Timer') to the
-- study_sessions arm of lb_calc_streak and lb_recompute.
--
-- BUG B — dashboard streak >> leaderboard streak (e.g. 16 vs 4, 13 vs 4)
-- Root: migration_focus_timer_daily_cap.sql was the LAST migration to
-- redefine lb_recompute(). It raised the timer-minutes cap from 300→780
-- but copied only the 2-signal active_days query (study_sessions +
-- timer_sessions), silently dropping the signals added by earlier
-- migrations: question_logs (migration_streak_questions), tasks
-- (migration_streak_tasks), and streak_freezes (migration_streak_freeze).
-- lb_calc_streak was NOT touched by daily_cap so it still has all 5
-- signals — meaning leaderboard_public.current_streak IS correctly
-- recomputed whenever a trigger fires. But the active_days_30 column
-- (used for the +12 per active day bonus) only counts 2 signals.
-- For users whose streak is primarily question-log or task-driven, the
-- mismatch between their displayed dashboard streak (client-side, all 5
-- signals) and leaderboard row that was last written by an older
-- lb_recompute (before the tasks/questions signals existed in lb_calc_streak)
-- could be wide. A fresh lb_recompute with the canonical lb_calc_streak
-- below closes this immediately.
-- FIX: restore all 5 signals to lb_recompute's active_days query.
--
-- BUG C — structural (platform filter missing from lb_recompute active_days)
-- The same Focus-Timer platform filter from Bug A was missing in
-- lb_recompute's active_days query. A day that only has a platform=Focus
-- Timer study_sessions row (and no qualifying timer_sessions row) would
-- count as an "active day" on the server but not on the client, inflating
-- the leaderboard's active_days_30 column unnecessarily.
-- FIX: apply the same platform filter to active_days.
--
-- ================================================================
-- THE ONE CANONICAL "GENUINE STUDY DAY" RULE (5 signals)
-- ================================================================
-- A day D qualifies if at least ONE of these is true:
--   1. study_sessions: a manually-logged session with minutes >= 5
--      (platform IS NULL OR platform <> 'Focus Timer')
--   2. timer_sessions: a completed focus-timer session with actual_minutes >= 10
--   3. question_logs: at least one question logged (count >= 1)
--   4. tasks: every task planned for day D is Completed (non-empty day only)
--   5. streak_freezes: a freeze token was spent on day D
-- This rule is now identical in lb_calc_streak, lb_recompute (active_days),
-- and App.jsx (streakDays). Any future change must be applied to all three.
-- ================================================================

-- ============================================================
-- 1. lb_calc_streak — canonical, 5 signals, platform filter
-- ============================================================
create or replace function lb_calc_streak(uid uuid) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  d        date := (now() at time zone 'Asia/Kolkata')::date;
  streak_n int  := 0;
  has_day  boolean;
  today_logged boolean;
begin
  -- If today not yet logged (day not over), start counting from yesterday
  -- so the streak only resets after a genuine 2-day gap.
  select
    exists (
      -- signal 1: manually-logged study session ≥ 5 min
      -- EXCLUDE platform = 'Focus Timer': those rows have minutes = planned duration,
      -- not actual elapsed time; the real signal for timer work is timer_sessions below.
      select 1 from study_sessions
      where user_id = uid
        and session_date = d
        and minutes >= 5
        and (platform is null or platform <> 'Focus Timer')
    )
    or exists (
      -- signal 2: completed focus-timer session ≥ 10 min (actual elapsed)
      select 1 from timer_sessions
      where user_id = uid
        and completed = true
        and actual_minutes >= 10
        and (created_at at time zone 'Asia/Kolkata')::date = d
    )
    or exists (
      -- signal 3: at least one question logged
      select 1 from question_logs
      where user_id = uid and log_date = d and count >= 1
    )
    or exists (
      -- signal 4: every task planned for day D completed (non-empty day only)
      select 1 from tasks
      where user_id = uid and due_date = d
      group by due_date
      having count(*) filter (where status <> 'Completed') = 0
    )
    or exists (
      -- signal 5: freeze token spent on this date
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
        where user_id = uid
          and session_date = d
          and minutes >= 5
          and (platform is null or platform <> 'Focus Timer')
      )
      or exists (
        select 1 from timer_sessions
        where user_id = uid
          and completed = true
          and actual_minutes >= 10
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

-- ============================================================
-- 2. lb_recompute — canonical, all signals, platform filter,
--    advisory lock, 780-min timer cap, audit trail
-- ============================================================
create or replace function lb_recompute(uid uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  window_start  date    := (now() at time zone 'Asia/Kolkata')::date - 29;
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
  -- Serialize per-user to prevent lost-update races.
  perform pg_advisory_xact_lock(hashtext(uid::text));

  select study_score into prior_score from leaderboard_public where user_id = uid;

  -- ── Genuine study days in the 30-day window ────────────────────────────
  -- Must be identical to lb_calc_streak above and App.jsx streakDays.
  -- All 5 signals, with the platform filter on study_sessions.
  select count(distinct d) into active_days from (
    -- signal 1: manually-logged study session ≥ 5 min (exclude Focus Timer rows)
    select session_date as d from study_sessions
      where user_id = uid
        and minutes >= 5
        and session_date >= window_start
        and (platform is null or platform <> 'Focus Timer')
    union
    -- signal 2: completed focus-timer session ≥ 10 min
    select (created_at at time zone 'Asia/Kolkata')::date as d from timer_sessions
      where user_id = uid
        and completed = true
        and actual_minutes >= 10
        and (created_at at time zone 'Asia/Kolkata')::date >= window_start
    union
    -- signal 3: at least one question logged
    select log_date as d from question_logs
      where user_id = uid and count >= 1 and log_date >= window_start
    union
    -- signal 4: every task planned for that day completed (non-empty day)
    select due_date as d from tasks
      where user_id = uid and due_date >= window_start
      group by due_date
      having count(*) filter (where status <> 'Completed') = 0
    union
    -- signal 5: freeze token spent on that date
    select frozen_date as d from streak_freezes
      where user_id = uid and frozen_date >= window_start
  ) t;

  -- ── Valid completed focus sessions (count bonus, capped 8/day = 240/window) ──
  -- planned_minutes must be present and closely matched (no Stopwatch sessions).
  select least(count(*), 240) into sessions_n
  from timer_sessions
  where user_id = uid
    and completed = true
    and actual_minutes >= 10 and actual_minutes <= 240
    and planned_minutes is not null
    and abs(actual_minutes - planned_minutes) <= greatest(3, planned_minutes * 0.15)
    and (created_at at time zone 'Asia/Kolkata')::date >= window_start;

  -- ── Timer-verified minutes, capped 780 min/day (13 h) ─────────────────
  select coalesce(sum(least(daily, 780)), 0) into timer_mins from (
    select (created_at at time zone 'Asia/Kolkata')::date as d, sum(actual_minutes) as daily
    from timer_sessions
    where user_id = uid
      and completed = true
      and actual_minutes between 10 and 600
      and (created_at at time zone 'Asia/Kolkata')::date >= window_start
    group by 1
  ) t;

  -- ── Self-reported minutes, capped 180 min/day ─────────────────────────
  -- Exclude platform='Focus Timer' rows — their 'minutes' = planned duration,
  -- not elapsed; the actual time is already in timer_mins above.
  select coalesce(sum(least(daily, 180)), 0) into manual_mins from (
    select session_date as d, sum(minutes) as daily
    from study_sessions
    where user_id = uid
      and minutes between 5 and 600
      and session_date >= window_start
      and (platform is null or platform <> 'Focus Timer')
    group by 1
  ) t;

  -- ── Questions logged, capped 100/day ──────────────────────────────────
  select coalesce(sum(least(daily, 100)), 0) into questions_n from (
    select log_date as d, sum(count) as daily
    from question_logs
    where user_id = uid and count between 1 and 500 and log_date >= window_start
    group by 1
  ) t;

  -- ── Mock tests, capped 1/day over the window ──────────────────────────
  select least(count(*), 30) into mocks_n
  from mock_tests where user_id = uid and mock_date >= window_start;

  -- ── Chapters newly completed/mastered (first-time only) ───────────────
  select least(count(distinct (subject, chapter)), 30) into chapters_n
  from chapter_progress
  where user_id = uid
    and status in ('Completed', 'Mastered')
    and completed_at >= (now() - interval '30 days');

  -- ── Current streak ────────────────────────────────────────────────────
  streak_n := lb_calc_streak(uid);

  -- ── Score formula ─────────────────────────────────────────────────────
  score := round(
      active_days  * 12
    + sessions_n   * 3
    + timer_mins   * 0.5
    + manual_mins  * 0.2
    + questions_n  * 0.3
    + mocks_n      * 8
    + chapters_n   * 10
    + least(streak_n, 60) * 4
  );

  select name, mascot into prof from profiles where user_id = uid;
  if not found then return; end if;

  insert into leaderboard_public (
    user_id, display_name, mascot, study_score, current_streak, active_days_30, updated_at
  ) values (
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

  -- Audit trail.
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

-- ============================================================
-- 3. Ensure all triggers are wired (idempotent)
-- ============================================================
do $$
declare t text;
begin
  for t in select unnest(array[
    'study_sessions','timer_sessions','question_logs','mock_tests','chapter_progress',
    'tasks','streak_freezes'
  ]) loop
    execute format('drop trigger if exists trg_lb_recompute on %I;', t);
    execute format(
      'create trigger trg_lb_recompute after insert or update or delete on %I for each row execute function lb_trg_recompute();',
      t
    );
  end loop;
end $$;

-- ============================================================
-- 4. Backfill: recompute every user immediately
-- ============================================================
do $$
declare r record;
begin
  for r in select user_id from profiles loop
    perform lb_recompute(r.user_id);
  end loop;
end $$;
