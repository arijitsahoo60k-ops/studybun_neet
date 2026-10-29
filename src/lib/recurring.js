import { dateStrToUTCms, weekdayShortIST, formatISTCalendarDate } from "./dateIST";

/*
 * Recurring planner tasks — pure helpers + the delete logic.
 *
 * Data model (no schema change, see the "Recurring planner tasks" effect in
 * App.jsx for the spawn side):
 *   - TEMPLATE: a tasks row with `recurring` = "Daily" | "Weekly:<Sun..Sat>".
 *     It is also the first occurrence (its own due_date). Its `description`
 *     doubles as a skip list ("__recurring_skip:2026-01-05,...").
 *   - CHILD: an ordinary row spawned for "today", `recurring` = null,
 *     `description` = "__recurring_from:<template_id>".
 */

export const RECURRING_FROM_PREFIX = "__recurring_from:";
const RECURRING_SKIP_PREFIX = "__recurring_skip:";

export function parseRecurringSkipDates(description) {
  if (!description || !description.startsWith(RECURRING_SKIP_PREFIX)) return [];
  return description.slice(RECURRING_SKIP_PREFIX.length).split(",").filter(Boolean);
}
export function encodeRecurringSkipDates(dates) {
  return dates.length ? RECURRING_SKIP_PREFIX + dates.join(",") : null;
}

// Template id a spawned child points at, or null for any other row.
export function recurringParentId(row) {
  const d = row && row.description;
  if (typeof d !== "string" || !d.startsWith(RECURRING_FROM_PREFIX)) return null;
  return d.slice(RECURRING_FROM_PREFIX.length) || null;
}

export function addDaysToDateStr(dateStr, n) {
  return new Date(dateStrToUTCms(dateStr) + n * 86400000).toISOString().slice(0, 10);
}

// First occurrence of `pattern` strictly AFTER `fromDateStr`. Weekly walks to
// the pattern's own weekday — the template's due_date is NOT guaranteed to be
// that weekday (the Add form lets you pick due date and "On" independently),
// so a blind +7 would land on the wrong day.
export function nextRecurringDate(pattern, fromDateStr) {
  if (pattern === "Daily") return addDaysToDateStr(fromDateStr, 1);
  const day = String(pattern || "").split(":")[1];
  for (let i = 1; i <= 7; i++) {
    const d = addDaysToDateStr(fromDateStr, i);
    if (!day || weekdayShortIST(d) === day) return d;
  }
  return addDaysToDateStr(fromDateStr, 7);
}

// The live template a row belongs to: the row itself if it is a template, its
// parent if it is a child whose parent still repeats, otherwise null. A parent
// that was deleted or "Stop"-ped (recurring = null) no longer counts, so its
// leftover children behave like plain tasks instead of pointing at nothing.
export function findActiveTemplate(tasks, row) {
  if (!row) return null;
  const parentId = recurringParentId(row);
  if (!parentId) return row.recurring ? row : null;
  return tasks.find((t) => t.id === parentId && t.recurring && !recurringParentId(t)) || null;
}

// Does this row stand for a single open occurrence that "just this one" can
// skip? Children always do. A template only while its own occurrence is still
// Pending and hasn't slipped into the past — a Completed or stale template has
// nothing left to skip, the only meaningful action on it is ending the series.
export function canSkipOccurrence(row, today) {
  if (recurringParentId(row)) return true;
  return !!row.recurring && row.status === "Pending" && !!row.due_date && row.due_date >= today;
}

const stripIdentity = (r) => {
  const { id: _id, user_id: _userId, created_at: _createdAt, ...rest } = r;
  return rest;
};

/*
 * Builds deleteTask / deleteRecurringSeries around the caller's current
 * `tasks` snapshot, the tasks table hook (`tasksQ`: update/remove/removeMany/
 * insert) and showToast(msg, undoFn, undoLabel). `today` is a function so a
 * tab left open past midnight still uses the right day.
 */
export function createRecurringDeleters({ tasks, tasksQ, showToast, today }) {
  const retryToast = (msg, fn) => showToast(msg, fn, "Retry");

  // Ends a whole repeating series.
  //  - Pending/stale template: the row is deleted (it is the pattern).
  //  - Completed template: the row is a finished day of history, and streaks
  //    bucket tasks by due_date, so deleting it could un-count that day. The
  //    pattern is ended by clearing `recurring` instead and the row stays.
  //  - Still-Pending spawned children are deleted in the same bulk call.
  //  - Completed children are history and are never touched.
  const deleteRecurringSeries = async (templateId) => {
    const template = tasks.find((t) => t.id === templateId && t.recurring && !recurringParentId(t));
    if (!template) { showToast("That repeating task is already gone."); return false; }

    const children = tasks.filter((t) => t.status === "Pending" && recurringParentId(t) === templateId);
    const keepRow = template.status === "Completed";
    const idsToRemove = [...(keepRow ? [] : [template.id]), ...children.map((c) => c.id)];

    // Every step is idempotent (deleting a missing id is a no-op, clearing
    // `recurring` twice is a no-op), so Retry can safely re-run the whole thing.
    const results = await Promise.all([
      keepRow ? tasksQ.update(template.id, { recurring: null, description: null }).then(Boolean) : true,
      idsToRemove.length ? tasksQ.removeMany(idsToRemove) : true,
    ]);
    if (results.some((ok) => !ok)) {
      retryToast("Couldn't stop that repeating task — check your connection.", () => deleteRecurringSeries(templateId));
      return false;
    }

    showToast(`Stopped repeating "${template.title}"`, async () => {
      let restoredId = template.id;
      if (keepRow) {
        const back = await tasksQ.update(template.id, { recurring: template.recurring, description: template.description ?? null });
        if (!back) { showToast("Couldn't restore that repeating task."); return; }
      } else {
        // A re-inserted row gets a NEW id, so children must be re-pointed at
        // it — otherwise they'd reference a template that doesn't exist and
        // the materializer would spawn a duplicate for today.
        const restored = await tasksQ.insert(stripIdentity(template));
        if (!restored) { showToast("Couldn't restore that repeating task."); return; }
        restoredId = restored.id;
      }
      await Promise.all(children.map((c) =>
        tasksQ.insert({ ...stripIdentity(c), description: `${RECURRING_FROM_PREFIX}${restoredId}` })
      ));
    });
    return true;
  };

  // scope "occurrence" (default) = just this one; "series" = the whole pattern.
  // Plain one-off tasks ignore scope and are simply deleted.
  const deleteTask = async (id, scope = "occurrence") => {
    const row = tasks.find((t) => t.id === id);
    if (!row) return;
    const now = today();
    const template = findActiveTemplate(tasks, row);

    if (template && scope === "series") { await deleteRecurringSeries(template.id); return; }

    // The template row itself, "just this one": move it to the next occurrence
    // (an UPDATE, not a backdated hidden row — streaks bucket by due_date, so a
    // stray past Pending row would un-complete an already-completed day).
    if (template && template.id === row.id) {
      if (!canSkipOccurrence(row, now)) { await deleteRecurringSeries(row.id); return; }
      const nextDue = nextRecurringDate(row.recurring, row.due_date);
      const updated = await tasksQ.update(id, { due_date: nextDue });
      if (!updated) {
        retryToast("Couldn't skip that task — check your connection.", () => deleteTask(id, scope));
        return;
      }
      const nextLabel = formatISTCalendarDate(nextDue, { weekday: "short", month: "short", day: "numeric" });
      showToast(`Skipped — repeats again ${nextLabel}`, () => tasksQ.update(id, { due_date: row.due_date }));
      return;
    }

    // A spawned child of a live template (or any other row). Only a child due
    // today/later needs a skip entry: the materializer only ever spawns for
    // "today", so an old completed child can be removed without touching the
    // template (and without a template-update failure blocking the delete).
    let skipsBefore = null;
    if (template && row.due_date >= now) {
      const skips = parseRecurringSkipDates(template.description);
      if (!skips.includes(row.due_date)) {
        const updated = await tasksQ.update(template.id, { description: encodeRecurringSkipDates([...skips, row.due_date]) });
        if (!updated) {
          retryToast("Couldn't delete that task — check your connection.", () => deleteTask(id, scope));
          return;
        }
        skipsBefore = skips;
      }
    }

    const removed = await tasksQ.remove(id);
    if (!removed) {
      retryToast("Couldn't delete that task — check your connection.", () => deleteTask(id, scope));
      return;
    }
    showToast("Task deleted", async () => {
      await tasksQ.insert(stripIdentity(row));
      // Un-skip so this occurrence can be deleted again later.
      if (template && skipsBefore) {
        await tasksQ.update(template.id, { description: encodeRecurringSkipDates(skipsBefore) });
      }
    });
  };

  return { deleteTask, deleteRecurringSeries };
}
