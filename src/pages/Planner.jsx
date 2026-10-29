import React, { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  CheckSquare, CheckCircle2, X, Plus, Pencil, Check,
  ChevronDown, AlertTriangle, CalendarClock, CalendarDays, Repeat, XCircle,
  Trash2, CalendarX,
} from "lucide-react";
import { Card, SectionTitle, Btn, EmptyState } from "../components/ui";
import { SYLLABUS, getActiveSubjects } from "../data/syllabus";
import { todayIST, formatISTCalendarDate, daysBetweenDateStrs, weekdayShortIST } from "../lib/dateIST";
import { useModalScrollLock } from "../hooks/useModalScrollLock";
import { recurringParentId, canSkipOccurrence } from "../lib/recurring";

const SUBJECT_OPTIONS = [...Object.keys(SYLLABUS), "Personal"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High"];
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Single source of truth for "how does this recurring pattern read as a
// sentence" — used by both the recurring badge's tooltip on a task row and
// the always-visible Repeating tasks card, so the wording can't drift
// between the two.
function describeRecurring(pattern) {
  if (!pattern) return "";
  if (pattern === "Daily") return "Repeats daily";
  const day = pattern.split(":")[1];
  return day ? `Repeats weekly on ${day}` : "Repeats weekly";
}

function dateGroupLabel(dateStr, today) {
  const diff = daysBetweenDateStrs(dateStr, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff <= 6) return formatISTCalendarDate(dateStr, { weekday: "long" });
  return formatISTCalendarDate(dateStr, { month: "short", day: "numeric" });
}

// Buckets pending tasks by due_date: every overdue date is merged into one
// "Overdue" group (sorted oldest first inside it) so a backlog of missed
// days reads as one alarming pile instead of five separate near-empty
// sections; everything from today onward gets its own dated group so the
// planner scans like a week, not a wall of rows.
function groupTasksByDate(tasks, today) {
  const byDate = new Map();
  tasks.forEach((t) => {
    const key = t.due_date || "no-date";
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(t);
  });
  const sortWithin = (list) => [...list].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1));

  const overdueKeys = [...byDate.keys()].filter((k) => k !== "no-date" && k < today).sort();
  const futureKeys = [...byDate.keys()].filter((k) => k !== "no-date" && k >= today).sort();

  const groups = [];
  if (overdueKeys.length) {
    const merged = overdueKeys.flatMap((k) => byDate.get(k));
    groups.push({ key: "overdue", label: "Overdue", count: merged.length, tasks: sortWithin(merged), tone: "overdue" });
  }
  futureKeys.forEach((k) => {
    const list = sortWithin(byDate.get(k));
    groups.push({ key: k, label: dateGroupLabel(k, today), count: list.length, tasks: list, tone: k === today ? "today" : "" });
  });
  if (byDate.has("no-date")) {
    const list = sortWithin(byDate.get("no-date"));
    groups.push({ key: "no-date", label: "No date", count: list.length, tasks: list, tone: "" });
  }
  return groups;
}

function EditTaskRow({ task, onSave, onCancel, subjectOptions = SUBJECT_OPTIONS }) {
  const [title, setTitle] = useState(task.title);
  const [subject, setSubject] = useState(task.subject);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date || "");
  const options = subject && !subjectOptions.includes(subject) ? [...subjectOptions, subject] : subjectOptions;

  const save = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), subject, priority, due_date: dueDate || null, category: subject === "Personal" ? "Personal" : "Study" });
  };

  return (
    <div className="sb-task-row sb-task-row-editing">
      <div className="sb-task-edit-grid">
        <input className="sb-input" value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onCancel(); }} autoFocus />
        <select className="sb-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
          {options.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="sb-input" value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIORITY_OPTIONS.map((x) => <option key={x}>{x}</option>)}
        </select>
        <input type="date" className="sb-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <div className="sb-task-edit-actions">
        <button className="sb-icon-btn" title="Save" onClick={save}><Check size={16} /></button>
        <button className="sb-icon-btn" title="Cancel" onClick={onCancel}><X size={16} /></button>
      </div>
    </div>
  );
}

function TaskRow({ t, editing, onEdit, onCancelEdit, onSave, onToggle, onDelete, onRequestDelete, onStopRepeat, activeTemplateIds, showDate, today, subjectOptions }) {
  if (editing) return <EditTaskRow task={t} onSave={onSave} onCancel={onCancelEdit} subjectOptions={subjectOptions} />;

  const overdue = t.status === "Pending" && t.due_date && t.due_date < today;
  const done = t.status === "Completed";
  const isRecurringTemplate = !!t.recurring;
  // A spawned child only counts as "repeating" while its template still
  // repeats — after the template is deleted or Stop-ped, leftovers are plain
  // tasks (no badge, no series choice pointing at nothing).
  const parentId = recurringParentId(t);
  const isRecurringChild = !!parentId && activeTemplateIds.has(parentId);
  // Anything that belongs to a live repeating pattern asks before deleting.
  // Exception: an OLD finished child (past day, already Completed) is plain
  // history — there is no today-vs-series question to ask about it.
  const offerDeleteChoice = isRecurringTemplate || (isRecurringChild && (t.status === "Pending" || (t.due_date || "") >= today));

  return (
    <div className={`sb-task-row sb-plan-row ${done ? "done" : ""} ${overdue ? "overdue" : ""}`}>
      <button className={`sb-checkbox ${done ? "checked" : ""}`} onClick={() => onToggle(t)}>
        {done && (<>
          <CheckCircle2 size={14} />
          <span className="sb-spark s1">✦</span><span className="sb-spark s2">✧</span>
          <span className="sb-spark s3">✦</span><span className="sb-spark s4">✧</span>
        </>)}
      </button>
      <div className="sb-task-info">
        <b>
          {t.title}
          {isRecurringTemplate && (
            <span className="sb-tag sb-recurring-badge" title={describeRecurring(t.recurring)}>
              <Repeat size={11} /> repeating
            </span>
          )}
          {isRecurringChild && (
            <span className="sb-tag sb-recurring-badge sb-recurring-badge-muted" title="Spawned from a repeating task">
              <Repeat size={11} />
            </span>
          )}
        </b>
        <div className="sb-muted sb-plan-meta">
          <span className={`sb-tag priority-${(t.priority || "medium").toLowerCase()}`}>{t.priority}</span>
          <span className="sb-tag">{t.subject}</span>
          {showDate && t.due_date && <span className="sb-tag">{overdue ? "was due " : "due "}{formatISTCalendarDate(t.due_date, { month: "short", day: "numeric" })}</span>}
        </div>
      </div>
      {isRecurringTemplate && (
        <button className="sb-icon-btn sb-stop-repeat-btn" title="Stop repeating" onClick={() => onStopRepeat(t.id)}>
          <XCircle size={13} /> <span>Stop</span>
        </button>
      )}
      <button className="sb-icon-btn" title="Edit task" onClick={() => onEdit(t.id)}><Pencil size={15} /></button>
      <button
        className="sb-icon-btn"
        title="Delete task"
        onClick={() => (offerDeleteChoice ? onRequestDelete(t) : onDelete(t.id))}
      >
        <X size={16} />
      </button>
    </div>
  );
}

// Asks whether a recurring task's delete should just skip today's
// occurrence or stop the whole series for good — the choice the app used
// to make silently (and, for templates whose own day had already passed,
// couldn't offer at all — see the Repeating tasks card below). Reuses the
// .sb-pt-overlay/.sb-pt-dialog chrome shared with Periodic Table / Focus
// Timer / Private Chat's confirm dialogs (see
// components/community/private/ConfirmDialog.jsx) rather than inventing a
// new modal shell, and the same scroll-lock hook those dialogs use so
// dragging the backdrop on mobile can't scroll the page underneath it.
//
// `task` doubles as the open/closed flag (null = closed) so the parent can
// stay a single piece of state instead of a separate boolean.
function RecurringDeleteDialog({ task, today, showTodayOption = true, onToday, onSeries, onCancel }) {
  const dialogRef = useRef(null);
  // onCancel is usually an inline arrow (new identity every render); keep the
  // latest in a ref so the effect below doesn't tear down / re-focus the
  // dialog on every parent re-render (e.g. each realtime task update).
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  useModalScrollLock(dialogRef, !!task);

  useEffect(() => {
    if (!task) return undefined;
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") cancelRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [task]);

  if (!task) return null;

  const portalTarget =
    (typeof document !== "undefined" && document.querySelector(".sb-app")) ||
    (typeof document !== "undefined" ? document.body : null);
  if (!portalTarget) return null;

  // A finished (Completed) template is history: "series" keeps the row and
  // only stops the repetition; every other case really deletes.
  const keepsRow = task.status === "Completed";

  return createPortal(
    <div className="sb-pt-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div
        className="sb-pt-dialog sb-plan-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Delete repeating task"
        ref={dialogRef}
        tabIndex={-1}
      >
        <button className="sb-pt-dialog-close" title="Close" aria-label="Close" onClick={onCancel}>
          <X size={15} />
        </button>
        <h3 className="sb-plan-delete-title"><Repeat size={15} /> {task.title}</h3>
        <p className="sb-plan-delete-body">
          {showTodayOption
            ? "This is a repeating task. Delete just this one, or stop the whole series?"
            : keepsRow
              ? "This stops the task repeating for good. The finished task itself stays in your history, so your streak isn't affected."
              : "This deletes the task and stops it repeating for good. Days already marked done keep their history."}
        </p>
        <div className="sb-plan-delete-options">
          {showTodayOption && (
            <button type="button" className="sb-plan-delete-option" onClick={onToday}>
              <CalendarX size={18} className="sb-plan-delete-option-icon" />
              <span className="sb-plan-delete-option-text">
                <b>{task.due_date === today ? "Just today" : "Just this one"}</b>
                <span>Skips it, keeps repeating</span>
              </span>
            </button>
          )}
          <button type="button" className="sb-plan-delete-option danger" onClick={onSeries}>
            <Trash2 size={18} className="sb-plan-delete-option-icon" />
            <span className="sb-plan-delete-option-text">
              <b>{showTodayOption ? "Entire series" : keepsRow ? "Stop repeating" : "Delete forever"}</b>
              <span>{keepsRow ? "Keeps this finished task" : "Removes it and all pending copies"}</span>
            </span>
          </button>
        </div>
        <Btn variant="ghost" onClick={onCancel} style={{ marginTop: 12, width: "100%", justifyContent: "center" }}>Cancel</Btn>
      </div>
    </div>,
    portalTarget
  );
}

// Always-visible list of every active repeating task, regardless of
// whether its own row is currently shown in the dated Pending groups
// below. A template's own due_date never moves on its own once its first
// occurrence has passed — see materializeRecurringTasks in App.jsx — so a
// Daily/Weekly task the user never explicitly deleted-for-today or
// completed on day one used to become a row with no visible "Stop
// repeating" button anywhere, spawning a fresh child every day forever
// with no way to make it stop short of editing the database directly.
// This card is the one place that's guaranteed to always have it, so
// "how do I delete this repeating task for good" always has an answer.
function RepeatingTasksCard({ templates, onRequestStop }) {
  if (!templates.length) return null;
  return (
    <Card>
      <SectionTitle icon={Repeat}>Repeating tasks</SectionTitle>
      {templates.map((t) => (
        <div className="sb-plan-repeating-row" key={t.id}>
          <div className="sb-plan-repeating-info">
            <b>{t.title}</b>
            <span><Repeat size={10} /> {describeRecurring(t.recurring)}</span>
          </div>
          <button className="sb-icon-btn danger" title="Stop repeating forever" onClick={() => onRequestStop(t)}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </Card>
  );
}

function GroupSection({ group, open, onToggleOpen, editingId, ...rowProps }) {
  const Icon = group.tone === "overdue" ? AlertTriangle : group.tone === "today" ? CalendarClock : CalendarDays;
  return (
    <div className={`sb-plan-group ${group.tone} ${open ? "open" : ""}`}>
      <button type="button" className="sb-plan-group-head" onClick={onToggleOpen}>
        <span className="sb-plan-group-title"><Icon size={15} /> {group.label} <span className="sb-plan-group-count">{group.count}</span></span>
        <ChevronDown size={16} className="sb-plan-chevron" />
      </button>
      {open && (
        <div className="sb-plan-group-body">
          {group.tasks.map((t) => (
            <TaskRow key={t.id} t={t} editing={editingId === t.id} showDate={group.key === "overdue" || group.key === "no-date"} {...rowProps} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlannerPage(p) {
  const today = todayIST();
  const [title, setTitle] = useState("");
  const activeSubjects = getActiveSubjects(p.profile);
  const [subject, setSubject] = useState(() => activeSubjects[0] || "Biology");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState(today);
  const [repeat, setRepeat] = useState("None");
  const [repeatDay, setRepeatDay] = useState(weekdayShortIST(today));
  const [editingId, setEditingId] = useState(null);
  const [openGroups, setOpenGroups] = useState(() => new Set(["overdue", today]));
  const [completedOpen, setCompletedOpen] = useState(false);
  // Task pending a "just today or the whole series?" choice (from the X
  // button on a task row) and a template pending a "stop repeating
  // forever?" confirmation (from the Repeating tasks card) — see
  // RecurringDeleteDialog above. Each is null when its dialog is closed.
  const [deleteChoiceTask, setDeleteChoiceTask] = useState(null);
  const [stopSeriesTarget, setStopSeriesTarget] = useState(null);

  // Recurring templates never move their own due_date (see materializeRecurringTasks
  // in App.jsx — that's what keeps spawned-child completion history independent).
  // Once a template's own day has passed, it's just a pattern-holder for the
  // generation logic, not a real overdue item, so it's dropped from the
  // grouped Pending/Overdue view. Its spawned children still show normally.
  const pending = p.tasks.filter((t) =>
    t.status === "Pending" && !(t.recurring && t.due_date && t.due_date < today)
  );
  const done = p.tasks.filter((t) => t.status === "Completed");

  const todaysTasks = p.tasks.filter((t) => t.due_date === today);
  const todaysPending = todaysTasks.filter((t) => t.status === "Pending").length;
  const showStreakNudge = !p.streakActiveToday && todaysTasks.length > 0 && todaysPending > 0;

  const groups = useMemo(() => groupTasksByDate(pending, today), [pending, today]);
  const overdueCount = groups.find((g) => g.key === "overdue")?.count || 0;

  // Every active repeating pattern, independent of what's currently
  // visible in `pending`/`done` above — see RepeatingTasksCard's comment
  // for why this can't just reuse the grouped view.
  const repeatingTemplates = useMemo(() => p.tasks.filter((t) => !!t.recurring && !recurringParentId(t)), [p.tasks]);
  const activeTemplateIds = useMemo(() => new Set(repeatingTemplates.map((t) => t.id)), [repeatingTemplates]);

  const toggleGroup = (key) => setOpenGroups((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const saveEdit = (id, patch) => { p.updateTask(id, patch); setEditingId(null); };

  const submitAdd = () => {
    if (!title.trim()) return;
    const recurring = repeat === "Daily" ? "Daily" : repeat === "Weekly" ? `Weekly:${repeatDay}` : null;
    p.addTask({
      title: title.trim(), subject, priority, due_date: dueDate || today,
      category: subject === "Personal" ? "Personal" : "Study",
      ...(recurring ? { recurring } : {}),
    });
    setTitle("");
    setRepeat("None");
  };

  const rowProps = {
    onEdit: setEditingId, onCancelEdit: () => setEditingId(null),
    onSave: (patch) => saveEdit(editingId, patch),
    onToggle: p.toggleTask, onDelete: p.deleteTask,
    onRequestDelete: setDeleteChoiceTask,
    onStopRepeat: (id) => p.updateTask(id, { recurring: null }),
    activeTemplateIds,
    today,
  };

  const confirmDeleteToday = () => {
    if (deleteChoiceTask) p.deleteTask(deleteChoiceTask.id, "occurrence");
    setDeleteChoiceTask(null);
  };
  const confirmDeleteSeries = () => {
    if (deleteChoiceTask) p.deleteTask(deleteChoiceTask.id, "series");
    setDeleteChoiceTask(null);
  };
  const confirmStopSeries = () => {
    if (stopSeriesTarget) p.deleteRecurringSeries(stopSeriesTarget.id);
    setStopSeriesTarget(null);
  };

  return (
    <div className="sb-page">
      <div className="sb-plan-layout">
        <div className="sb-plan-side">
          <Card>
            <SectionTitle icon={CheckSquare}>Add task</SectionTitle>
            <div className="sb-form-grid dense">
              <div style={{ gridColumn: "span 2" }}>
                <label>Title</label>
                <input className="sb-input" value={title} onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); }} placeholder="e.g. Finish Genetics NCERT & 45 PYQs" />
              </div>
              <div>
                <label>Subject</label>
                <select className="sb-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                  {activeSubjects.map((s) => <option key={s}>{s}</option>)}<option>Personal</option>
                </select>
              </div>
              <div>
                <label>Priority</label>
                <select className="sb-input" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {PRIORITY_OPTIONS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label>Due date</label>
                <input type="date" className="sb-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <label>Repeat</label>
                <select className="sb-input" value={repeat} onChange={(e) => {
                  const val = e.target.value;
                  if (val === "Weekly") setRepeatDay(weekdayShortIST(dueDate || today));
                  setRepeat(val);
                }}>
                  <option>None</option>
                  <option>Daily</option>
                  <option>Weekly</option>
                </select>
              </div>
              {repeat === "Weekly" && (
                <div>
                  <label>On</label>
                  <select className="sb-input" value={repeatDay} onChange={(e) => setRepeatDay(e.target.value)}>
                    {WEEKDAYS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
              )}
            </div>
            <Btn onClick={submitAdd}><Plus size={16} /> Add task</Btn>
          </Card>

          <Card className="sb-plan-stats">
            <SectionTitle icon={CalendarDays}>This week</SectionTitle>
            <div className="sb-plan-stat-row"><span>Pending</span><b>{pending.length}</b></div>
            <div className="sb-plan-stat-row"><span>Due today</span><b>{todaysTasks.length}</b></div>
            <div className={`sb-plan-stat-row ${overdueCount ? "warn" : ""}`}><span>Overdue</span><b>{overdueCount}</b></div>
            <div className="sb-plan-stat-row"><span>Completed</span><b>{done.length}</b></div>
            {showStreakNudge && (
              <div className="sb-muted sb-plan-nudge">
                🔥 {todaysPending} task{todaysPending === 1 ? "" : "s"} left today — clear them all and today's streak locks in.
              </div>
            )}
          </Card>

          <RepeatingTasksCard templates={repeatingTemplates} onRequestStop={setStopSeriesTarget} />
        </div>

        <div className="sb-plan-main">
          <Card>
            <SectionTitle icon={CheckSquare}>Pending ({pending.length})</SectionTitle>
            {groups.length === 0 ? (
              <EmptyState mascot={p.mascot} mood="happy" text="All clear for today." />
            ) : (
              groups.map((g) => (
                <GroupSection key={g.key} group={g} open={openGroups.has(g.key)} onToggleOpen={() => toggleGroup(g.key)} editingId={editingId} {...rowProps} />
              ))
            )}
          </Card>

          {done.length > 0 && (
            <Card>
              <button type="button" className="sb-plan-group-head sb-plan-completed-head" onClick={() => setCompletedOpen((v) => !v)}>
                <span className="sb-plan-group-title"><CheckCircle2 size={15} /> Completed <span className="sb-plan-group-count">{done.length}</span></span>
                <ChevronDown size={16} className={`sb-plan-chevron ${completedOpen ? "open" : ""}`} />
              </button>
              {completedOpen && done.map((t) => (
                <TaskRow key={t.id} t={t} editing={editingId === t.id} showDate today={today} {...rowProps} />
              ))}
            </Card>
          )}
        </div>
      </div>

      <RecurringDeleteDialog
        task={deleteChoiceTask}
        today={today}
        showTodayOption={!!deleteChoiceTask && canSkipOccurrence(deleteChoiceTask, today)}
        onToday={confirmDeleteToday}
        onSeries={confirmDeleteSeries}
        onCancel={() => setDeleteChoiceTask(null)}
      />
      <RecurringDeleteDialog
        task={stopSeriesTarget}
        today={today}
        showTodayOption={false}
        onSeries={confirmStopSeries}
        onCancel={() => setStopSeriesTarget(null)}
      />
    </div>
  );
}
