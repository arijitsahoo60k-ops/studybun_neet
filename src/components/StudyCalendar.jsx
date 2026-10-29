import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, BookOpen, HelpCircle, ClipboardCheck, ListChecks, RotateCcw } from "lucide-react";
import { SYLLABUS } from "../data/syllabus";
import { todayIST, tsToISTDateStr, formatISTCalendarDate } from "../lib/dateIST";

const pad = (n) => String(n).padStart(2, "0");
const toKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayKey = todayIST;
const cursorFromKey = (key) => { const [y, m] = key.split("-").map(Number); return { y, m: m - 1 }; };
const subjectColor = (subj) => SYLLABUS[subj]?.color || "var(--accent2)";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/* Cute per-category dot legend — kept small & fixed so the grid stays calm. */
const CATS = [
  { key: "study", label: "Study", emoji: "📖", color: "var(--accent)" },
  { key: "questions", label: "Questions", emoji: "✏️", color: "var(--p2)" },
  { key: "mock", label: "Mock test", emoji: "📝", color: "var(--p1)" },
  { key: "tasks", label: "Tasks", emoji: "🎀", color: "var(--p3)" },
];

export default function StudyCalendar({ sessions = [], timerSessions = [], questions = [], mocks = [], tasks = [], revisions = [] }) {
  const [cursor, setCursor] = useState(() => cursorFromKey(todayKey()));
  const [selected, setSelected] = useState(todayKey());

  // ---- bucket every dated record by "YYYY-MM-DD" once, cheap even for a big history ----
  const byDate = useMemo(() => {
    const map = {};
    const bucket = (key) => (map[key] = map[key] || {
      sessions: [], timerMinutes: 0, questions: [], questionCount: 0, mocks: [], tasks: [], revisions: [],
    });
    sessions.forEach((s) => { if (s.session_date) bucket(s.session_date).sessions.push(s); });
    timerSessions.forEach((s) => { if (s.created_at) bucket(tsToISTDateStr(s.created_at)).timerMinutes += Number(s.actual_minutes || 0); });
    questions.forEach((q) => { if (q.log_date) { const b = bucket(q.log_date); b.questions.push(q); b.questionCount += Number(q.count || 0); } });
    mocks.forEach((m) => { if (m.mock_date) bucket(m.mock_date).mocks.push(m); });
    tasks.forEach((t) => { if (t.due_date) bucket(t.due_date).tasks.push(t); });
    revisions.forEach((r) => { if (r.due_date) bucket(r.due_date).revisions.push(r); });
    return map;
  }, [sessions, timerSessions, questions, mocks, tasks, revisions]);

  const { y, m } = cursor;
  const monthLabel = new Date(y, m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = todayKey();

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const changeMonth = (delta) => {
    let nm = m + delta, ny = y;
    if (nm < 0) { nm = 11; ny -= 1; }
    if (nm > 11) { nm = 0; ny += 1; }
    setCursor({ y: ny, m: nm });
  };

  const goToday = () => { setCursor(cursorFromKey(todayKey())); setSelected(todayKey()); };

  const day = byDate[selected];
  const studyMinutes = (day?.sessions.reduce((a, s) => a + Number(s.minutes || 0), 0) || 0) + (day?.timerMinutes || 0);
  const selLabel = selected ? formatISTCalendarDate(selected, { weekday: "long", month: "long", day: "numeric" }) : "";
  const hasAnything = day && (day.sessions.length || day.timerMinutes || day.questionCount || day.mocks.length || day.tasks.length || day.revisions.length);

  return (
    <div className="sb-cal">
      <div className="sb-cal-left">
      <div className="sb-cal-head">
        <button type="button" className="sb-cal-nav" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
        <div className="sb-cal-title">🗓️ {monthLabel}</div>
        <button type="button" className="sb-cal-nav" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={16} /></button>
        {selected !== today && <button type="button" className="sb-cal-today" onClick={goToday}>Today</button>}
      </div>

      <div className="sb-cal-weekdays">
        {WEEKDAYS.map((w) => <div key={w} className="sb-cal-wd">{w}</div>)}
      </div>

      <div className="sb-cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} className="sb-cal-cell empty" />;
          const key = toKey(y, m, d);
          const info = byDate[key];
          const isToday = key === today;
          const isSel = key === selected;
          const dots = info ? [
            (info.sessions.length || info.timerMinutes) && CATS[0],
            info.questionCount > 0 && CATS[1],
            info.mocks.length > 0 && CATS[2],
            info.tasks.length > 0 && CATS[3],
          ].filter(Boolean) : [];
          return (
            <button
              type="button"
              key={key}
              className={`sb-cal-cell${isToday ? " is-today" : ""}${isSel ? " is-selected" : ""}${dots.length ? " has-data" : ""}`}
              onClick={() => setSelected(key)}
            >
              <span className="sb-cal-daynum">{d}</span>
              {dots.length > 0 && (
                <span className="sb-cal-dots">
                  {dots.slice(0, 4).map((c) => <span key={c.key} className="sb-cal-dot" style={{ background: c.color }} />)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="sb-cal-legend">
        {CATS.map((c) => (
          <span key={c.key} className="sb-cal-legend-item"><span className="sb-cal-dot" style={{ background: c.color }} /> {c.label}</span>
        ))}
      </div>
      </div>

      {selected && (
        <div className="sb-cal-detail" key={selected}>
          <div className="sb-cal-detail-head">
            <span className="sb-cal-detail-date">{key_is_today(selected, today) ? "Today · " : ""}{selLabel}</span>
            {studyMinutes > 0 && <span className="sb-chip small">⏱️ {(studyMinutes / 60).toFixed(1)}h studied</span>}
          </div>

          {!hasAnything && (
            <div className="sb-cal-empty">🌙 nothing tucked in on this day yet~</div>
          )}

          {day?.sessions.length > 0 && (
            <div className="sb-cal-section">
              <div className="sb-cal-section-title"><BookOpen size={13} /> Study sessions</div>
              <div className="sb-cal-items">
                {day.sessions.map((s) => (
                  <div className="sb-cal-item" key={s.id}>
                    <span className="sb-cal-item-flag" style={{ background: subjectColor(s.subject) }} />
                    <span className="sb-cal-item-main">{s.session_type}{s.chapter ? ` · ${s.chapter}` : ""}</span>
                    <span className="sb-cal-item-sub">{s.minutes}m</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {day?.questionCount > 0 && (
            <div className="sb-cal-section">
              <div className="sb-cal-section-title"><HelpCircle size={13} /> Questions solved</div>
              <div className="sb-cal-items">
                {day.questions.map((q) => (
                  <div className="sb-cal-item" key={q.id}>
                    <span className="sb-cal-item-flag" style={{ background: subjectColor(q.subject) }} />
                    <span className="sb-cal-item-main">{q.subject}{q.question_type ? ` · ${q.question_type}` : ""}</span>
                    <span className="sb-cal-item-sub">{q.count} qs</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {day?.mocks.length > 0 && (
            <div className="sb-cal-section">
              <div className="sb-cal-section-title"><ClipboardCheck size={13} /> Mock tests</div>
              <div className="sb-cal-items">
                {day.mocks.map((mk) => (
                  <div className="sb-cal-item" key={mk.id}>
                    <span className="sb-cal-item-flag" style={{ background: "var(--p1)" }} />
                    <span className="sb-cal-item-main">{mk.exam_name}</span>
                    <span className="sb-cal-item-sub">{mk.total_marks != null ? `${mk.total_marks} marks` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {day?.tasks.length > 0 && (
            <div className="sb-cal-section">
              <div className="sb-cal-section-title"><ListChecks size={13} /> Tasks due</div>
              <div className="sb-cal-items">
                {day.tasks.map((t) => (
                  <div className="sb-cal-item" key={t.id}>
                    <span className={`sb-cal-item-flag ${t.status === "Completed" ? "done" : ""}`} style={{ background: t.status === "Completed" ? "var(--p3)" : "var(--outline)" }} />
                    <span className="sb-cal-item-main">{t.title}</span>
                    <span className="sb-cal-item-sub">{t.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {day?.revisions.length > 0 && (
            <div className="sb-cal-section">
              <div className="sb-cal-section-title"><RotateCcw size={13} /> Revisions due</div>
              <div className="sb-cal-items">
                {day.revisions.map((r) => (
                  <div className="sb-cal-item" key={r.id}>
                    <span className="sb-cal-item-flag" style={{ background: subjectColor(r.subject) }} />
                    <span className="sb-cal-item-main">{r.subject} · {r.chapter}</span>
                    <span className="sb-cal-item-sub">{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function key_is_today(key, today) { return key === today; }
