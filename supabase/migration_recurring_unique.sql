-- ============================================================
-- Migration: at most ONE spawned copy per repeating task per day
-- ============================================================
-- Safe to run on an existing StudyBun database and safe to re-run
-- (IF NOT EXISTS; the cleanup is a no-op once there are no duplicates).
--
-- THE GAP THIS CLOSES:
-- Repeating tasks are spawned by the CLIENT (the "Recurring planner tasks"
-- effect in src/App.jsx): on first load of a new day it checks "is there a
-- copy for today?" and inserts one if not. That check-then-insert is not
-- atomic across devices. Open StudyBun on a phone and a laptop at nearly the
-- same moment on a new day and both see "no copy yet" and both insert, so
-- the planner shows the same task twice.
--
-- HOW A SPAWNED COPY IS IDENTIFIED (no schema change — see App.jsx):
--   description = '__recurring_from:<template_id>'   and   due_date = the day
-- So "one copy per template per day" is exactly uniqueness of
-- (user_id, description, due_date) among rows whose description starts with
-- that marker. Everything else (plain tasks, templates, which carry
-- `recurring` and a NULL / '__recurring_skip:' description) is untouched, and
-- rows with a NULL due_date are never constrained (NULLs are distinct).
--
-- WITH THE INDEX IN PLACE the second device's insert is rejected by Postgres;
-- the app just logs it and the winner's row arrives via realtime.
--
-- ORDER MATTERS: existing duplicates must go first or CREATE UNIQUE INDEX
-- fails. Per (user, template, day) group the row KEPT is, in order:
--   1. a Completed one (never throw away a finished task / streak day),
--   2. else the oldest by created_at, then id.
--
-- OPTIONAL — preview what step 1 will delete (read-only), run this first:
--   select user_id, description, due_date, count(*) as copies,
--          array_agg(id || ':' || coalesce(status,'?') order by created_at) as rows
--   from tasks
--   where left(description, 17) = '__recurring_from:' and due_date is not null
--   group by user_id, description, due_date
--   having count(*) > 1;
-- ============================================================

begin;

-- Step 1: drop duplicate copies, keeping one per (user, template, day).
delete from tasks t
using (
  select id,
         row_number() over (
           partition by user_id, description, due_date
           order by (coalesce(status, '') = 'Completed') desc, created_at asc, id asc
         ) as rn
  from tasks
  where left(description, 17) = '__recurring_from:'
    and due_date is not null
) d
where t.id = d.id
  and d.rn > 1;

-- Step 2: enforce it going forward (partial index: only spawned copies).
create unique index if not exists idx_tasks_recurring_copy_unique
  on tasks (user_id, description, due_date)
  where left(description, 17) = '__recurring_from:';

commit;
