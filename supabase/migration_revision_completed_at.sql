-- ---------- REVISION PLANS: completed_at tracking ----------
-- revision_plans.status flips to 'Completed' in App.jsx's completeRevision(),
-- but the table never recorded *when* that happened. The Daily Recap page
-- needs "revisions completed today" and had no exact signal to use --
-- due_date is when a revision was SCHEDULED, not when it was actually done,
-- so a revision completed a day late (or early) was being miscounted.
--
-- This adds a real timestamp, set the same way backlog_items.completed_at
-- and goals.completed_at already work (see App.jsx setBacklogStatus /
-- completeGoal): stamped at the moment completeRevision() runs, cleared back
-- to null if the completion is ever undone via the toast's Undo button.
alter table if exists revision_plans add column if not exists completed_at timestamptz;

-- One-time backfill for rows already marked Completed before this migration
-- existed -- there's no way to recover the real completion time for those,
-- so this uses due_date at noon UTC as the best available estimate rather
-- than leaving all pre-migration history absent from the recap page.
-- Everything completed after this migration runs gets an exact timestamp
-- from completeRevision() instead of this fallback.
update revision_plans
  set completed_at = (due_date::timestamp + interval '12 hours')
  where status = 'Completed' and completed_at is null;
