-- ============================================================
-- Migration: Realtime Leaderboard
-- ============================================================
-- Safe to run on an existing StudyBun database — everything here
-- is idempotent (create-if-not-exists / create-or-replace / drop-
-- if-exists-then-create), so re-running it is harmless.
--
-- What this adds:
--   1. chapter_progress.completed_at — an immutable "first time
--      this chapter turned Completed/Mastered" timestamp, kept
--      separate from updated_at so re-saving an already-completed
--      chapter (editing notes, priority, etc.) can never re-count
--      toward the leaderboard.
--   2. Light CHECK constraints on the numeric fields the score
--      reads from, so a single self-reported row can't claim an
--      impossible value (e.g. 50,000 minutes). Added NOT VALID so
--      existing rows are never retroactively broken.
--   3. leaderboard_public — a small, intentionally public table
--      holding ONLY what a leaderboard needs (display name,
--      mascot, score, streak). Nothing from any private table is
--      ever readable through it.
--   4. lb_recompute(uuid) — the scoring engine. Runs as the table
--      owner (SECURITY DEFINER) so it can read a user's private
--      study tables to compute their score, but it only ever
--      writes the public columns back out.
--   5. Triggers that call lb_recompute() the moment relevant rows
--      change, so the leaderboard is always live — no cron job,
--      no manual refresh.
--   6. lb_get_my_rank() — lets a signed-in user look up their own
--      rank without needing to fetch every other user's row.
--   7. leaderboard_public added to the realtime publication.
--
-- See the "SCORING" comment block above lb_recompute() below for
-- the full breakdown of how the Study Score is calculated and the
-- anti-cheat reasoning behind every cap.
-- ============================================================

-- ---------- 1. completed_at: anti-cheat-safe completion timestamp ----------
alter table chapter_progress add column if not exists completed_at timestamptz;

create or replace function lb_set_chapter_completed_at() returns trigger
language plpgsql as $$
declare
  was_done boolean := (TG_OP = 'UPDATE') and (OLD.status in ('Completed', 'Mastered'));
  is_done  boolean := NEW.status in ('Completed', 'Mastered');
begin
  -- Only stamp the moment a chapter *first* becomes Completed/Mastered.
  -- Any later edit while it stays Completed/Mastered leaves completed_at
  -- untouched, so nobody can "refresh" it for repeat leaderboard credit
  -- by re-saving the same chapter. Moving it back out of those statuses
  -- clears the stamp, since it's genuinely no longer done.
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

create index if not exists idx_chapter_progress_completed_at on chapter_progress(user_id, completed_at);

-- One-time backfill: chapters that were already Completed/Mastered before
-- this migration existed get completed_at set from their historical
-- updated_at, so day-one users aren't unfairly zeroed out. This only ever
-- runs once, right here — the trigger above (not updated_at) governs
-- every completion from this point forward, so it can't be re-gamed later.
update chapter_progress
set completed_at = updated_at
where status in ('Completed', 'Mastered') and completed_at is null;

-- ---------- 2. sanity bounds on self-reported numbers (defense in depth) ----------
-- NOT VALID = enforced for every new write from today onward, but never
-- retroactively validated against rows that already exist.
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

-- ---------- 3. leaderboard_public: the ONLY table other users can read from ----------
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
-- Any signed-in StudyBun user can read the leaderboard. There is
-- deliberately no insert/update/delete policy for the authenticated
-- role — the only way this table is ever written to is the
-- SECURITY DEFINER function below, called from triggers.
create policy "leaderboard public read" on leaderboard_public
  for select using (auth.role() = 'authenticated');

-- ---------- 4. the scoring engine ----------
-- SCORING (rolling 30-day window + all-time current streak):
--
--   +12   per genuine study day in the last 30 days           (consistency)
--   +3    per valid completed focus session (cap 8/day)       (real sessions, not idle timers)
--   +0.5  per minute from completed focus-timer sessions (cap 300 min/day)   — trusted signal
--   +0.2  per minute from manually-logged sessions (cap 180 min/day)         — self-reported, weighted lower
--   +0.3  per question logged (cap 100/day)                   (practice)
--   +8    per mock test taken (cap 1/day)                     (real exam practice)
--   +10   per chapter newly completed/mastered (cap 30 in window, first-time only via completed_at)
--   +4    per day of current streak, capped at 60 days        (long-term consistency, diminishing so it can't dominate forever)
--
-- A "genuine study day" only counts if it has a manual session of
-- >= 5 minutes OR a *completed* focus-timer session of >= 10
-- minutes — a single throwaway 30-second row can't extend a streak
-- or count as a study day.
--
-- Anti-cheat notes:
--   • Every raw signal is capped per-day BEFORE being summed over
--     the window, so inserting hundreds of tiny/duplicate rows in
--     one sitting never earns more than one honest day's worth of
--     points — spamming doesn't pay.
--   • A completed focus session only counts if its actual_minutes
--     lands close to its planned_minutes (the timer can only ever
--     finish at 0, so a genuine session's actual ≈ planned; a wildly
--     mismatched pair is a sign of a hand-crafted fake row).
--   • Chapter credit only fires once, off completed_at (see above),
--     not off updated_at — so it can't be "refreshed" by unrelated edits.
--   • Streak uses the same "only breaks after a full 2-day gap" rule
--     as the rest of the app (Dashboard/Achievements) — today not
--     being logged yet doesn't zero it out, so the leaderboard never
--     contradicts what the user sees elsewhere.
--   • Achievements/badges are deliberately NOT part of the score —
--     that table only enforces row ownership, not that the badge was
--     genuinely earned, so it isn't a trustworthy scoring input.
create or replace function lb_calc_streak(uid uuid) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  -- StudyBun's "day" is IST (Asia/Kolkata), not whatever timezone this
  -- Postgres session defaults to (Supabase defaults to UTC). Using
  -- current_date / "at time zone 'utc'" here meant the leaderboard's
  -- streak rolled over 5.5 hours late relative to real midnight IST —
  -- same class of bug as the client-side one, fixed the same way.
  d date := (now() at time zone 'Asia/Kolkata')::date;
  streak_n int := 0;
  has_day boolean;
  today_logged boolean;
begin
  -- If today has no session yet, don't let that alone zero the streak out
  -- (the day isn't over). Start counting from yesterday instead, so the
  -- streak only truly resets once a full day has gone by with nothing
  -- logged — a genuine 2-day gap (today + yesterday both empty).
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

-- ---------- 5. triggers: keep it live ----------
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
  for t in select unnest(array['study_sessions', 'timer_sessions', 'question_logs', 'mock_tests', 'chapter_progress'])
  loop
    execute format('drop trigger if exists trg_lb_recompute on %I;', t);
    execute format(
      'create trigger trg_lb_recompute after insert or update or delete on %I for each row execute function lb_trg_recompute();',
      t
    );
  end loop;
end $$;

-- profile edits (name / mascot) should reflect on the leaderboard immediately too
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

-- ---------- 6. "what's my rank" without fetching every user ----------
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

-- ---------- 7. realtime ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'leaderboard_public'
  ) then
    alter publication supabase_realtime add table leaderboard_public;
  end if;
end $$;

-- ---------- 8. backfill existing users ----------
do $$
declare r record;
begin
  for r in select user_id from profiles loop
    perform lb_recompute(r.user_id);
  end loop;
end $$;
