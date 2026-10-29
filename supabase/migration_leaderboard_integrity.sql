-- ============================================================
-- Migration: Leaderboard/Points integrity fix
-- ============================================================
-- Safe to run on an existing StudyBun database — everything here
-- is idempotent (create-or-replace / create-if-not-exists), and
-- ends by re-running lb_recompute() for every existing user so
-- any score already wrong because of the bug below is corrected
-- immediately, not just on that user's next study-log write.
--
-- THE BUG ("points don't get added / points decrease on their own"):
-- lb_recompute(uid) works by throwing away whatever is in
-- leaderboard_public and recalculating the user's score from
-- scratch by reading study_sessions/timer_sessions/question_logs/
-- mock_tests/chapter_progress, then writing the result back. It is
-- fired by a trigger on every insert/update/delete to those tables.
--
-- That's correct for a single write at a time, but it was never
-- serialized — so two writes for the *same user* landing close
-- together (a phone + a laptop both open, two tabs, a flaky
-- connection causing a retry, or just two inserts firing within
-- the same second) can race like this:
--
--   1. Session A inserts a row.      (transaction A starts)
--   2. Session B inserts a row.      (transaction B starts)
--   3. B's trigger reads the DB: it sees B's own row (same
--      transaction), but A hasn't committed yet, so it does NOT
--      see A's row. B computes a score from "B only" and writes it.
--   4. A commits.
--   5. B commits — overwriting leaderboard_public with the score it
--      computed in step 3, which never included A's contribution.
--
-- Net effect: A's points are silently dropped ("didn't get added"),
-- or — if the timing runs the other way — a later, unrelated write
-- overwrites a fresher/higher value with a stale recompute that
-- makes the score visibly drop before the next write corrects it
-- again ("decreases on its own"). This is a classic
-- recompute-and-overwrite lost-update race, not a scoring-formula
-- bug — the formula itself has been correct since
-- migration_stopwatch_anticheat.sql.
--
-- THE FIX:
--   1. lb_recompute(uid) now takes a per-user Postgres advisory
--      lock as its very first statement. Two invocations for the
--      same uid can no longer run concurrently — the second one
--      blocks until the first commits, and by the time it runs its
--      own reads it sees everything the first one just committed.
--      Different users are completely unaffected (the lock key is
--      derived from the uid), so this adds no contention app-wide.
--   2. leaderboard_score_log — a small audit trail. Every time a
--      recompute actually changes the score, we record the before/
--      after here. This is what lets the app detect "your score
--      just got corrected" instead of that correction happening
--      invisibly.
--   3. lb_recompute_and_report() — a callable-by-the-user RPC that
--      forces a fresh recompute for the signed-in user and hands
--      back the old/new score so the client can self-heal: it's
--      called on app open and whenever the tab/app regains focus,
--      and if it finds the score jumped up with no matching action
--      the user just took, that's exactly a "missed points, now
--      added" event — see useLeaderboardReconciliation.js.
--   4. lb_recompute_for_user(uid) — service-role-only, recomputes
--      ONE user. Called once per user, in a loop, from
--      api/cron/leaderboard-reconcile.js — never batched into a
--      single SQL loop/transaction, since that would hold every
--      user's advisory lock for the whole batch's duration (see the
--      comment on the function itself). This daily cron means even a
--      user who doesn't reopen the app for a while still gets a
--      correct, current score (and lets the honest 30-day-window
--      decay happen on schedule instead of only at their next write).
--
-- Nothing about the scoring formula, caps, or anti-cheat rules
-- changes in this migration — only how safely lb_recompute is
-- allowed to run concurrently, plus the audit trail and the two
-- new RPCs.
-- ============================================================

-- ---------- 1. lb_recompute: add the per-user serialization lock ----------
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
  -- Serialize all recomputes for this one user. hashtext() folds the uuid
  -- into a 32-bit key; pg_advisory_xact_lock auto-releases at commit/
  -- rollback, so there's no separate unlock call and no way to leak a
  -- held lock. This is the entire fix for the lost-update race described
  -- above — everything below is unchanged scoring logic.
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
  -- planned_minutes must be present AND matched — a null plan (Stopwatch)
  -- can never itself satisfy this (see migration_stopwatch_anticheat.sql).
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

  -- Audit trail: only log when the score actually moved, and only once we
  -- have a prior value to compare against (prior_score is null the very
  -- first time a user is ever scored — that's not a "change", it's a
  -- starting point, so it's deliberately not logged).
  if prior_score is not null and round(prior_score, 2) is distinct from round(score, 2) then
    insert into leaderboard_score_log (user_id, old_score, new_score, delta)
    values (uid, prior_score, score, score - prior_score);
  end if;

  -- Light housekeeping: keep each user's log trimmed to their most recent
  -- 200 entries so this table can never grow unbounded. Cheap — indexed on
  -- (user_id, computed_at) and only runs when this uid's score just changed.
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

-- ---------- 2. audit log ----------
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
-- Read-only for the owner. There is deliberately no insert/update/delete
-- policy for the authenticated role — the only writer is lb_recompute()
-- above, which runs as SECURITY DEFINER.
create policy "own score log read" on leaderboard_score_log
  for select using (auth.uid() = user_id);

-- ---------- 3. client-callable self-heal RPC ----------
-- Forces a fresh, fully-serialized recompute for the signed-in user right
-- now (rather than waiting for their next study-log write to trigger one)
-- and reports the before/after so the client can tell a genuine correction
-- apart from a normal "no change" call. had_prior_row = false means this is
-- the user's very first score ever — the client should never show a
-- "missed points found" toast for that case.
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

-- ---------- 4. service-role-only single-user reconciliation (daily cron) ----------
-- Deliberately ONE user per call, not a loop-over-everyone-in-one-function.
-- pg_advisory_xact_lock is transaction-scoped: if a single SQL function
-- looped over all 186 users and called lb_recompute() for each, every one
-- of those per-user locks would stay held until the WHOLE loop finished
-- (one function call = one transaction), not released after each user. A
-- real study-session insert from an active user during that window would
-- then sit blocked waiting for the batch job to finish before their own
-- save could get its lock — the exact kind of hang this migration exists
-- to prevent, just relocated. Calling this once per user instead (each
-- call its own network round trip = its own transaction) means each
-- user's lock is acquired and released immediately, so a concurrent real
-- save for that same user waits at most as long as one person's own
-- recompute, never the length of the whole batch. See
-- api/cron/leaderboard-reconcile.js for the loop that calls this.
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

-- ---------- 5. correct every existing user's score right now ----------
-- Whatever drift the race above has already caused (however briefly it was
-- live) is fixed immediately for all 186 users, not just on their next
-- write. This also seeds leaderboard_score_log with each user's current
-- state as a clean prior_score baseline (their score won't have changed
-- from itself, so no log rows are created here — by design, this is a
-- silent correction, not something to surface as "missed points found").
do $$
declare r record;
begin
  for r in select user_id from profiles loop
    perform lb_recompute(r.user_id);
  end loop;
end $$;
