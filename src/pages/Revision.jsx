import React, { useState, useMemo } from "react";
import {
  FolderClock, RotateCcw, Clock3, CheckCircle2, CalendarPlus, Trash2,
  Sparkles, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, CalendarDays,
  Repeat, Flame, ListFilter, Layers,
} from "lucide-react";
import { Card, SectionTitle, Btn, EmptyState } from "../components/ui";
import Mascot from "../components/Mascot";
import { SYLLABUS } from "../data/syllabus";
import { generateRevisionSuggestions } from "../services/gemini";
import { todayIST, daysAgoIST, toISTDateStr, formatISTCalendarDate } from "../lib/dateIST";

const todayISO = todayIST;

/** The classic spaced-repetition ladder NEET aspirants use: revise a chapter
    again 1, 3, 7, 16 and 30 days after first touching it. Offered as one-tap
    date chips and as an optional "plan the whole cycle" shortcut. */
const SPACED_INTERVALS = [
  { label: "+1d", days: 1 },
  { label: "+3d", days: 3 },
  { label: "+7d", days: 7 },
  { label: "+16d", days: 16 },
  { label: "+30d", days: 30 },
];
const addDaysISO = (days) => toISTDateStr(Date.now() + days * 86400000);

const dayLabel = (d) => {
  const today = todayISO();
  const y = daysAgoIST(1);
  if (d === today) return "today";
  if (d === y) return "yesterday";
  return formatISTCalendarDate(d, { month: "short", day: "numeric" });
};

/** Which "shelf" a revision belongs on for the due-date chip. */
const dueKind = (r) => {
  if (r.status === "Completed") return "done";
  if (r.due_date < todayISO()) return "overdue";
  if (r.due_date === todayISO()) return "today";
  return "upcoming";
};
const DUE_CHIP = {
  overdue: { emoji: "⏰", label: (r) => `overdue · ${dayLabel(r.due_date)}` },
  today: { emoji: "☀️", label: () => "due today" },
  upcoming: { emoji: "🍃", label: (r) => `due ${dayLabel(r.due_date)}` },
  done: { emoji: "🌸", label: () => "done" },
};

function AIRevisionRecommendations(p) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const hasHistory = p.revisions.length > 0;

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      // Send ONLY revision history — nothing else — so suggestions are based
      // exclusively on this user's revision pattern.
      const slim = p.revisions.map((r) => ({
        subject: r.subject,
        chapter: r.chapter,
        revision_number: r.revision_number,
        due_date: r.due_date,
        status: r.status,
      }));
      const output = await generateRevisionSuggestions(slim);
      setResult(output);
    } catch (e) {
      setError(e.message || "Something went wrong generating suggestions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <SectionTitle icon={Sparkles}>AI revision suggestions</SectionTitle>

      {!hasHistory && !result ? (
        <div className="sb-empty">
          <p className="sb-empty-text">No revision history yet.</p>
          <p className="sb-empty-sub">Plan and complete a few revisions first — suggestions are based only on your revision history.</p>
        </div>
      ) : (
        <>
          <Btn onClick={generate} disabled={loading || !hasHistory}>
            {loading ? <><RefreshCw size={16} className="sb-spin" /> Analyzing your revisions...</> : <><Sparkles size={16} /> {result ? "Regenerate" : "Suggest chapters to revise"}</>}
          </Btn>
          <div className="sb-muted" style={{ marginTop: 8, fontSize: 12 }}>
            Looks only at your revision history — nothing else — and only runs when you click.
          </div>

          {error && (
            <div style={{ marginTop: 12 }}>
              <SectionTitle icon={AlertTriangle}>Couldn't generate suggestions</SectionTitle>
              <p className="sb-muted">{error}</p>
            </div>
          )}

          {result && (
            <div style={{ marginTop: 14 }}>
              {result.summary && <p style={{ marginBottom: 12 }}>{result.summary}</p>}
              {(result.suggested_chapters || []).map((c, i) => (
                <div key={i} className="sb-revision-row">
                  <div><b>{c.chapter}</b><div className="sb-muted">{c.subject}{c.reason ? ` · ${c.reason}` : ""}</div></div>
                  <div className="sb-revision-actions">
                    <Btn
                      variant="soft"
                      onClick={() => p.addRevision({ subject: c.subject, chapter: c.chapter, due_date: todayISO(), revision_number: 1 })}
                    >
                      <CalendarPlus size={16} /> Plan it
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/** Next 7 days at a glance — a dot lights up on any day with a pending revision due. */
function WeekStrip({ revisions }) {
  const days = Array.from({ length: 7 }, (_, i) => toISTDateStr(Date.now() + i * 86400000));
  const countFor = (d) => revisions.filter((r) => r.status === "Pending" && r.due_date === d).length;

  return (
    <Card>
      <SectionTitle icon={CalendarDays}>This week</SectionTitle>
      <div className="sb-week-strip">
        {days.map((d, i) => {
          const c = countFor(d);
          return (
            <div key={i} className={`sb-week-day ${i === 0 ? "is-today" : ""}`}>
              <span>{formatISTCalendarDate(d, { weekday: "short" }).slice(0, 2)}</span>
              <span className={`sb-week-dot ${c > 0 ? "has-revision" : ""}`} title={c > 0 ? `${c} due` : "nothing due"} />
              <span>{c > 0 ? c : ""}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Compact at-a-glance counters for the sidebar — overdue / today / upcoming
    / completed — so the study-load is visible without scrolling the shelves. */
function RevisionStats({ overdue, today, upcoming, completed }) {
  const rows = [
    { label: "Overdue", value: overdue, warn: overdue > 0 },
    { label: "Due today", value: today },
    { label: "Upcoming", value: upcoming },
    { label: "Completed", value: completed },
  ];
  return (
    <Card className="sb-plan-stats">
      <SectionTitle icon={Flame}>At a glance</SectionTitle>
      {rows.map((r) => (
        <div key={r.label} className={`sb-plan-stat-row ${r.warn ? "warn" : ""}`}>
          <span>{r.label}</span>
          <b>{r.value}</b>
        </div>
      ))}
    </Card>
  );
}

/** Subject chips to narrow the shelves down to one subject at a time —
    handy once a student has 30+ revisions queued across three subjects. */
function SubjectFilterBar({ subjects, active, onChange }) {
  if (subjects.length <= 1) return null;
  return (
    <Card style={{ padding: "12px 16px" }}>
      <div className="sb-chip-row">
        <button
          type="button"
          className={`sb-chip small ${active === "All" ? "active" : ""}`}
          onClick={() => onChange("All")}
        >
          <ListFilter size={12} style={{ marginRight: 3, verticalAlign: -2 }} />
          All
        </button>
        {subjects.map((s) => (
          <button
            key={s}
            type="button"
            className={`sb-chip small ${active === s ? "active" : ""}`}
            style={active === s ? { background: SYLLABUS[s]?.color || "var(--accent)", color: "#fff", borderColor: SYLLABUS[s]?.color } : undefined}
            onClick={() => onChange(s)}
          >
            {s}
          </button>
        ))}
      </div>
    </Card>
  );
}

function RevisionCard({ r, onComplete, onDelete, showComplete, dashed }) {
  const kind = dueKind(r);
  const chip = DUE_CHIP[kind];
  const subjectColor = SYLLABUS[r.subject]?.color || "var(--accent2)";

  return (
    <div className={`sb-revision-card ${dashed ? "dashed" : ""}`}>
      <span className="sb-subject-flag" style={{ background: subjectColor }} />
      <div><b>{r.chapter}</b><div className="sb-muted">{r.subject} · Revision {r.revision_number}</div></div>
      <div className="sb-revision-actions" style={{ justifyContent: "space-between" }}>
        <span className={`sb-due-chip ${kind}`}>{chip.emoji} {chip.label(r)}</span>
        <div style={{ display: "flex", gap: 6 }}>
          {showComplete && <Btn variant="soft" onClick={onComplete}><CheckCircle2 size={16} /> Done</Btn>}
          <button className="sb-icon-btn danger" title="Delete this revision" onClick={onDelete}><Trash2 size={16} /></button>
        </div>
      </div>
    </div>
  );
}

export default function RevisionPage(p) {
  const subjects = [...new Set(p.allChapters.map((c) => c.subject))];
  const [subject, setSubject] = useState(subjects[0] || "");
  const chaptersForSubject = p.allChapters.filter((c) => c.subject === subject);
  const [chapter, setChapter] = useState(chaptersForSubject[0]?.name || "");
  const [dueDate, setDueDate] = useState(todayISO());
  const [revisionNumber, setRevisionNumber] = useState(1);
  const [fullCycle, setFullCycle] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [filterSubject, setFilterSubject] = useState("All");

  const handleSubjectChange = (s) => {
    setSubject(s);
    const first = p.allChapters.find((c) => c.subject === s);
    setChapter(first?.name || "");
  };

  const handlePlan = () => {
    if (!subject || !chapter || !dueDate) return;
    if (fullCycle) {
      // Lay down the whole 1-3-7-16-30 day spaced-repetition ladder in one go,
      // anchored to the chosen due date instead of always starting from today.
      const base = new Date(`${dueDate}T00:00:00`).getTime();
      SPACED_INTERVALS.forEach((step, i) => {
        const due = toISTDateStr(base + step.days * 86400000);
        p.addRevision({ subject, chapter, due_date: due, revision_number: i + 1 });
      });
    } else {
      p.addRevision({ subject, chapter, due_date: dueDate, revision_number: +revisionNumber || 1 });
    }
    setDueDate(todayISO());
    setRevisionNumber(1);
  };

  const completedRevisions = p.revisions.filter((r) => r.status === "Completed");
  const pawTrail = "🐾".repeat(Math.min(completedRevisions.length, 12)) + (completedRevisions.length > 12 ? ` +${completedRevisions.length - 12}` : "");

  const revisionSubjects = useMemo(
    () => [...new Set(p.revisions.map((r) => r.subject))].sort(),
    [p.revisions]
  );
  const bySubject = (list) => (filterSubject === "All" ? list : list.filter((r) => r.subject === filterSubject));

  const overdue = bySubject(p.overdueRevisions);
  const dueToday = bySubject(p.dueRevisions);
  const upcoming = bySubject(p.upcomingRevisions);
  const completedFiltered = bySubject(completedRevisions);

  const Shelf = ({ title, emoji, items, icon: Icon, showComplete, dashed, emptyMood, emptyText, emptySub, mascotMood }) => (
    <Card>
      <SectionTitle
        icon={Icon}
        right={mascotMood && items.length > 0 ? <Mascot species={p.mascot} mood={mascotMood} size={30} /> : null}
      >
        {emoji} {title} <span className="sb-muted">({items.length})</span>
      </SectionTitle>
      {items.length === 0 ? (
        <EmptyState mascot={p.mascot} mood={emptyMood} text={emptyText} sub={emptySub} />
      ) : (
        <div className="sb-chapter-grid">
          {items.map((r) => (
            <RevisionCard
              key={r.id}
              r={r}
              dashed={dashed}
              showComplete={showComplete}
              onComplete={() => p.completeRevision(r.id)}
              onDelete={() => p.deleteRevision(r.id)}
            />
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <div className="sb-revplan-layout">
      {/* Sidebar: planning + at-a-glance stats stay in view while the shelves scroll */}
      <div className="sb-revplan-side">
        <Card>
          <SectionTitle icon={CalendarPlus}>Plan a revision</SectionTitle>
          <div className="sb-form-grid dense">
            <div>
              <label>Subject</label>
              <select className="sb-input small" value={subject} onChange={(e) => handleSubjectChange(e.target.value)}>
                {subjects.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label>Chapter</label>
              <select className="sb-input small" value={chapter} onChange={(e) => setChapter(e.target.value)}>
                {chaptersForSubject.map((c) => <option key={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label>{fullCycle ? "Cycle starts" : "Due date"}</label>
              <input type="date" className="sb-input small" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            {!fullCycle && (
              <div>
                <label>Revision #</label>
                <input type="number" min="1" className="sb-input small" value={revisionNumber} onChange={(e) => setRevisionNumber(e.target.value)} />
              </div>
            )}
          </div>

          {!fullCycle && (
            <div className="sb-chip-row" style={{ marginBottom: 10 }}>
              {SPACED_INTERVALS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="sb-chip small"
                  onClick={() => setDueDate(addDaysISO(s.days))}
                  title={`Due date = today + ${s.days} day${s.days > 1 ? "s" : ""}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <label className="sb-revplan-cycle-toggle">
            <input type="checkbox" checked={fullCycle} onChange={(e) => setFullCycle(e.target.checked)} />
            <span><Repeat size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Plan the full 1-3-7-16-30 day cycle</span>
          </label>

          <Btn onClick={handlePlan} style={{ marginTop: 10 }}>
            {fullCycle ? <><Layers size={16} /> Add 5 revisions</> : <><CalendarPlus size={16} /> Add to plan</>}
          </Btn>
        </Card>

        <RevisionStats
          overdue={p.overdueRevisions.length}
          today={p.dueRevisions.length}
          upcoming={p.upcomingRevisions.length}
          completed={completedRevisions.length}
        />

        <WeekStrip revisions={p.revisions} />
      </div>

      {/* Main column: AI suggestions + the overdue / today / upcoming / completed shelves */}
      <div className="sb-revplan-main">
        <AIRevisionRecommendations {...p} />

        <SubjectFilterBar subjects={revisionSubjects} active={filterSubject} onChange={setFilterSubject} />

        <Shelf
          title="Overdue" emoji="🍂" icon={FolderClock} items={overdue} showComplete
          mascotMood="reminder"
          emptyMood="happy" emptyText="Nothing overdue — you're on top of it! 🎉" emptySub="Keep it that way, bun."
        />
        <Shelf
          title="Due Today" emoji="☀️" icon={RotateCcw} items={dueToday} showComplete
          emptyMood="idle" emptyText="Nothing due today." emptySub="Enjoy the calm ☁️"
        />
        <Shelf
          title="Upcoming" emoji="🌱" icon={Clock3} items={upcoming} dashed
          emptyMood="idle" emptyText="Nothing scheduled yet." emptySub="Plan one above to get ahead 🌱"
        />

        <Card>
          <SectionTitle icon={CheckCircle2}>
            🌸 Completed <span className="sb-muted">({completedFiltered.length})</span>
          </SectionTitle>
          {completedFiltered.length > 0 && (
            <button className="sb-collapse-toggle" onClick={() => setShowCompleted((v) => !v)}>
              {showCompleted ? <><ChevronUp size={14} /> Hide completed</> : <><ChevronDown size={14} /> Show completed</>}
            </button>
          )}
          {completedFiltered.length === 0 ? (
            <EmptyState mascot={p.mascot} mood="idle" text="No revisions completed yet." sub="First one's the best feeling 🌸" />
          ) : showCompleted ? (
            <>
              <div className="sb-paw-trail" style={{ margin: "10px 0" }}>{pawTrail}</div>
              <div className="sb-chapter-grid">
                {completedFiltered.map((r) => (
                  <RevisionCard key={r.id} r={r} showComplete={false} onDelete={() => p.deleteRevision(r.id)} />
                ))}
              </div>
            </>
          ) : (
            <div className="sb-paw-trail" style={{ marginTop: 10 }}>{pawTrail}</div>
          )}
        </Card>
      </div>
    </div>
  );
}
