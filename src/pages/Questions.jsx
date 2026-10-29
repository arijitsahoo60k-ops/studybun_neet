import React, { useMemo, useState } from "react";
import { HelpCircle, BarChart3, Sparkles, AlertTriangle, Plus, Trash2, ChevronDown, ChevronUp, ClipboardList, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, SectionTitle, Btn, EmptyState, ProgressBar, ProgressRing } from "../components/ui";
import { SYLLABUS, getActiveSubjects } from "../data/syllabus";
import { todayIST, daysAgoIST, formatISTCalendarDate } from "../lib/dateIST";

const todayStr = todayIST;
const dayLabel = (d) => {
  const today = todayStr();
  const y = daysAgoIST(1);
  if (d === today) return "Today";
  if (d === y) return "Yesterday";
  return formatISTCalendarDate(d, { month: "short", day: "numeric" });
};

const QUICK_COUNTS = [10, 20, 25, 30, 45, 50, 90, 100];
const SUBJECT_SHORT = { Biology: "B", Physics: "P", Chemistry: "C", Mathematics: "M" };
const SubjectMiniSplit = ({ split, activeSubjects }) => (
  <div className="sb-pulse-mini-split">
    {(activeSubjects || ["Biology", "Physics", "Chemistry"]).map((s) => (
      <span key={s}>
        <b style={{ color: SYLLABUS[s]?.deepColor || SYLLABUS[s]?.color }}>{SUBJECT_SHORT[s] || s[0]}</b>
        {split[s] || 0}
      </span>
    ))}
  </div>
);
const SOURCES = ["NCERT", "PYQ", "DPP", "Module", "Mock", "Book", "Coaching Sheet", "Custom"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const MISTAKE_TAGS = ["Silly Mistake", "Concept Gap", "Calculation Error", "Time Pressure", "Guessed Wrong", "Custom"];
const DAYS_PER_PAGE = 7;
const MIN_ATTEMPTS_FOR_SIGNAL = 5;
const WEAK_THRESHOLD_PCT = 60;

export default function QuestionsPage(p) {
  const activeSubjects = useMemo(() => getActiveSubjects(p.profile), [p.profile]);
  const [subject, setSubject] = useState(() => activeSubjects[0] || "Biology");
  const safeSubject = SYLLABUS[subject] ? subject : (activeSubjects[0] || "Biology");
  const [chapter, setChapter] = useState(() => Object.values(SYLLABUS[safeSubject].groups).flat()[0]);
  const [difficulty, setDifficulty] = useState("Medium");
  const [source, setSource] = useState("NCERT");
  const subjectGroups = Object.entries(SYLLABUS[safeSubject].groups);

  const onSubject = (s) => { setSubject(s); setChapter(Object.values(SYLLABUS[s].groups).flat()[0]); };

  const [correct, setCorrect] = useState("");
  const [incorrect, setIncorrect] = useState("");
  const [skipped, setSkipped] = useState("");
  const [timeTaken, setTimeTaken] = useState("");
  const [mistakeTag, setMistakeTag] = useState("");
  const [mistakeTagCustom, setMistakeTagCustom] = useState("");
  const [loggingAcc, setLoggingAcc] = useState(false);
  const accTotal = (Number(correct) || 0) + (Number(incorrect) || 0) + (Number(skipped) || 0);

  const [addedChapters, setAddedChapters] = useState(new Set());
  const [timelineSubjectFilter, setTimelineSubjectFilter] = useState("All");
  const [visibleDays, setVisibleDays] = useState(DAYS_PER_PAGE);

  const questions = p.questions;

  const logQuick = (n) => p.addQuestions({ subject: safeSubject, chapter, difficulty, question_type: source, count: n });

  const logAccuracy = async () => {
    if (accTotal <= 0 || loggingAcc) return;
    setLoggingAcc(true);
    try {
      await p.addQuestions({
        subject: safeSubject, chapter, difficulty, question_type: source, count: accTotal,
        correct: correct === "" ? 0 : Number(correct),
        incorrect: incorrect === "" ? 0 : Number(incorrect),
        skipped: skipped === "" ? 0 : Number(skipped),
        time_taken_minutes: timeTaken === "" ? null : Number(timeTaken),
        mistake_tag: Number(incorrect) > 0 && mistakeTag ? mistakeTag : null,
        mistake_tag_custom: Number(incorrect) > 0 && mistakeTag === "Custom" ? mistakeTagCustom.trim() || null : null,
      });
      setCorrect(""); setIncorrect(""); setSkipped(""); setTimeTaken(""); setMistakeTag(""); setMistakeTagCustom("");
    } finally {
      setLoggingAcc(false);
    }
  };

  const weekAgo = daysAgoIST(6);
  const activeDays = new Set(questions.map((q) => q.log_date)).size;
  const thisWeekCount = questions.filter((q) => q.log_date >= weekAgo).reduce((a, q) => a + Number(q.count || 0), 0);

  const bySubject = useMemo(() => {
    const m = {};
    questions.forEach((q) => { m[q.subject] = (m[q.subject] || 0) + Number(q.count || 0); });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [questions]);

  const accuracyBySubject = useMemo(() => {
    const m = {};
    questions.forEach((q) => {
      const c = Number(q.correct) || 0, ic = Number(q.incorrect) || 0, t = Number(q.time_taken_minutes) || 0;
      const attempted = c + ic;
      if (attempted <= 0) return;
      const row = (m[q.subject] = m[q.subject] || { correct: 0, attempted: 0, time: 0 });
      row.correct += c; row.attempted += attempted; row.time += t;
    });
    return Object.entries(m)
      .map(([subj, row]) => ({
        subject: subj,
        pct: Math.round((row.correct / row.attempted) * 100),
        attempted: row.attempted,
        avgTime: row.time > 0 ? row.time / row.attempted : null,
      }))
      .sort((a, b) => a.pct - b.pct);
  }, [questions]);

  const weakChapters = useMemo(() => {
    const m = {};
    questions.forEach((q) => {
      if (!q.chapter) return;
      const c = Number(q.correct) || 0, ic = Number(q.incorrect) || 0;
      const attempted = c + ic;
      if (attempted <= 0) return;
      const key = `${q.subject}::${q.chapter}`;
      const row = (m[key] = m[key] || { subject: q.subject, chapter: q.chapter, correct: 0, attempted: 0 });
      row.correct += c; row.attempted += attempted;
    });
    return Object.values(m)
      .map((r) => ({ ...r, pct: Math.round((r.correct / r.attempted) * 100) }))
      .filter((r) => r.attempted >= MIN_ATTEMPTS_FOR_SIGNAL && r.pct < WEAK_THRESHOLD_PCT)
      .sort((a, b) => a.pct - b.pct);
  }, [questions]);
  const weakSpotlight = weakChapters.slice(0, 4);

  const addWeakToBacklog = (w) => {
    const backlogSubject = w.subject === "Mathematics" ? "Maths" : ["Biology", "Physics", "Chemistry"].includes(w.subject) ? w.subject : "Other";
    p.addBacklogItem({
      title: `Revise ${w.chapter}`,
      subject: backlogSubject,
      category: "Revision",
      reason: "Difficult Topic",
      notes: `${w.pct}% accuracy over ${w.attempted} questions logged.`,
    });
    setAddedChapters((prev) => new Set(prev).add(`${w.subject}::${w.chapter}`));
  };

  const overall = useMemo(() => {
    let c = 0, attempted = 0;
    questions.forEach((q) => { const cc = Number(q.correct) || 0, ic = Number(q.incorrect) || 0; c += cc; attempted += cc + ic; });
    return attempted > 0 ? { pct: Math.round((c / attempted) * 100), attempted } : null;
  }, [questions]);

  const splitBySubject = (rows) => {
    const m = { Biology: 0, Physics: 0, Chemistry: 0, Mathematics: 0 };
    rows.forEach((q) => { if (m[q.subject] !== undefined) m[q.subject] += Number(q.count || 0); });
    return m;
  };
  const todaySplit = useMemo(() => splitBySubject(questions.filter((q) => q.log_date === todayStr())), [questions]);
  const weekSplit = useMemo(() => splitBySubject(questions.filter((q) => q.log_date >= weekAgo)), [questions, weekAgo]);
  const lifetimeSplit = useMemo(() => splitBySubject(questions), [questions]);

  const subjectsLogged = useMemo(() => Object.keys(SYLLABUS).filter((s) => questions.some((q) => q.subject === s)), [questions]);
  const timelineRows = useMemo(
    () => (timelineSubjectFilter === "All" ? questions : questions.filter((q) => q.subject === timelineSubjectFilter)),
    [questions, timelineSubjectFilter]
  );
  const grouped = useMemo(() => {
    const m = {};
    timelineRows.forEach((q) => { (m[q.log_date] = m[q.log_date] || []).push(q); });
    return Object.entries(m).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [timelineRows]);
  const groupsShown = grouped.slice(0, visibleDays);
  const hasMoreDays = grouped.length > visibleDays;
  const isFullyExpanded = visibleDays > DAYS_PER_PAGE && !hasMoreDays;

  return (
    <div className="sb-page">
      <div className="sb-practice-layout">
        <div className="sb-practice-left">
          <Card className="sb-card-tinted">
            <SectionTitle icon={Sparkles}>Today's pulse</SectionTitle>

            <div className="sb-pulse-target">
              <div className="sb-pulse-target-head">
                <span className="sb-pulse-target-label"><Target size={12} /> Daily target</span>
                <span className="sb-pulse-target-num">{p.todayQuestions || 0}<span className="sb-muted"> / {p.dailyQuestionTarget || 50}</span></span>
              </div>
              <ProgressBar pct={p.questionTargetPct || 0} color={p.questionTargetMet ? "#3E9E5C" : undefined} paw={false} />
              {p.questionTargetMet && <div className="sb-pulse-target-hit">🎯 Target hit for today — nice work!</div>}
            </div>

            <div className="sb-backlog-pulse">
              {overall && (
                <div className="sb-backlog-ring-wrap">
                  <ProgressRing pct={overall.pct} size={80} stroke={9} color={overall.pct < 60 ? "#C0435A" : undefined} paw={false} />
                  <div className="sb-backlog-ring-label">Accuracy</div>
                </div>
              )}
              <div className="sb-backlog-pulse-nums">
                <div className="sb-pulse-stat">
                  <div className="sb-pulse-stat-top">
                    <span className="sb-backlog-stat-label">Today</span>
                    <span className="sb-backlog-stat-num">{p.todayQuestions}</span>
                  </div>
                  <SubjectMiniSplit split={todaySplit} activeSubjects={activeSubjects} />
                </div>
                <div className="sb-pulse-stat">
                  <div className="sb-pulse-stat-top">
                    <span className="sb-backlog-stat-label">This week</span>
                    <span className="sb-backlog-stat-num">{thisWeekCount}</span>
                  </div>
                  <SubjectMiniSplit split={weekSplit} activeSubjects={activeSubjects} />
                </div>
                <div className="sb-pulse-stat">
                  <div className="sb-pulse-stat-top">
                    <span className="sb-backlog-stat-label">Lifetime</span>
                    <span className="sb-backlog-stat-num">{p.totalQuestions}</span>
                  </div>
                  <SubjectMiniSplit split={lifetimeSplit} activeSubjects={activeSubjects} />
                </div>
              </div>
            </div>

            {!overall && (
              <div className="sb-hero-meta" style={{ marginTop: 12 }}>Log a few answers with correct/incorrect to see your accuracy here.</div>
            )}
            {activeDays > 0 && (
              <div className="sb-hero-meta" style={{ marginTop: overall ? 12 : 0 }}>~{Math.round(p.totalQuestions / activeDays)} questions per active day.</div>
            )}
          </Card>

          <Card washi style={{ borderLeft: `5px solid ${SYLLABUS[safeSubject]?.color}` }}>
            <SectionTitle icon={HelpCircle}>Log practice</SectionTitle>
            <div className="sb-form-grid">
              <div>
                <label>Subject</label>
                <select className="sb-input" value={safeSubject} onChange={(e) => onSubject(e.target.value)}>
                  {activeSubjects.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label>Chapter {safeSubject === "Biology" ? "(Botany / Zoology)" : ""}</label>
                <select className="sb-input" value={chapter} onChange={(e) => setChapter(e.target.value)}>
                  {subjectGroups.map(([grp, chs]) => (
                    <optgroup key={grp} label={safeSubject === "Biology" ? `${grp === "Botany" ? "🌱 Section A: Botany" : "🧬 Section B: Zoology"}` : grp}>
                      {chs.map((c) => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label>Source</label>
                <select className="sb-input" value={source} onChange={(e) => setSource(e.target.value)}>
                  {SOURCES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label>Difficulty</label>
                <select className="sb-input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="sb-quick-actions">
              {QUICK_COUNTS.map((n) => <Btn key={n} variant="soft" onClick={() => logQuick(n)}>+{n}</Btn>)}
            </div>

            <div className="sb-chapter-detail" style={{ marginTop: 16 }}>
              <div className="sb-hero-meta" style={{ marginBottom: 10 }}>Log with accuracy — track what you got right, so weak spots show up below.</div>
              <div className="sb-form-grid dense">
                <div><label>Correct</label><input type="number" min="0" className="sb-input" value={correct} onChange={(e) => setCorrect(e.target.value)} placeholder="0" /></div>
                <div><label>Incorrect</label><input type="number" min="0" className="sb-input" value={incorrect} onChange={(e) => setIncorrect(e.target.value)} placeholder="0" /></div>
                <div><label>Skipped</label><input type="number" min="0" className="sb-input" value={skipped} onChange={(e) => setSkipped(e.target.value)} placeholder="0" /></div>
                <div><label>Time (min)</label><input type="number" min="0" className="sb-input" value={timeTaken} onChange={(e) => setTimeTaken(e.target.value)} placeholder="optional" /></div>
              </div>
              {Number(incorrect) > 0 && (
                <div style={{ marginTop: 4, marginBottom: 10 }}>
                  <label>Why'd it go wrong? (optional)</label>
                  <div className="sb-mistake-tags">
                    {MISTAKE_TAGS.map((t) => (
                      <button key={t} type="button" className={`sb-chip small ${mistakeTag === t ? "active" : ""}`} onClick={() => setMistakeTag(mistakeTag === t ? "" : t)}>{t}</button>
                    ))}
                  </div>
                  {mistakeTag === "Custom" && (
                    <input className="sb-input" style={{ marginTop: 8 }} value={mistakeTagCustom} onChange={(e) => setMistakeTagCustom(e.target.value)} placeholder="What happened?" />
                  )}
                </div>
              )}
              <Btn onClick={logAccuracy} disabled={accTotal <= 0 || loggingAcc}>
                <Plus size={16} /> {loggingAcc ? "Logging…" : `Log ${accTotal || ""} with accuracy`}
              </Btn>
            </div>
          </Card>
        </div>

        <div className="sb-practice-right">
          {weakSpotlight.length > 0 && (
            <Card className="sb-overdue-card">
              <SectionTitle icon={AlertTriangle}>Needs revision</SectionTitle>
              <p className="sb-muted small" style={{ marginBottom: 10 }}>
                Chapters where accuracy is under {WEAK_THRESHOLD_PCT}% over {MIN_ATTEMPTS_FOR_SIGNAL}+ questions — worth another pass before these show up in a mock.
              </p>
              {weakSpotlight.map((w) => {
                const key = `${w.subject}::${w.chapter}`;
                const added = addedChapters.has(key);
                return (
                  <div key={key} className="sb-overdue-row">
                    <span className="sb-overdue-days">{w.pct}%</span>
                    <div className="sb-overdue-info"><b>{w.chapter}</b><div className="sb-muted">{w.subject} · {w.attempted} attempted</div></div>
                    <Btn variant={added ? "ghost" : "soft"} onClick={() => !added && addWeakToBacklog(w)}>{added ? "Added ✓" : "+ Backlog"}</Btn>
                  </div>
                );
              })}
              {weakChapters.length > weakSpotlight.length && <div className="sb-overdue-more">+{weakChapters.length - weakSpotlight.length} more weak chapters</div>}
            </Card>
          )}

          {accuracyBySubject.length > 0 && (
            <Card>
              <SectionTitle icon={Target}>Accuracy by subject</SectionTitle>
              {accuracyBySubject.map((s) => (
                <div key={s.subject} className="sb-acc-row">
                  <span className="sb-acc-row-label">{s.subject}</span>
                  <span className="sb-acc-row-bar"><ProgressBar pct={s.pct} color={SYLLABUS[s.subject]?.color} paw={false} /></span>
                  <span className="sb-acc-row-pct">{s.pct}%<span className="sb-acc-row-n"> ({s.attempted}{s.avgTime ? ` · ${s.avgTime.toFixed(1)}m/q` : ""})</span></span>
                </div>
              ))}
            </Card>
          )}

          <Card>
            <SectionTitle icon={BarChart3}>Subject distribution</SectionTitle>
            {bySubject.length ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={bySubject}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--soft)" />
                  <XAxis dataKey="name" stroke="var(--muted)" fontSize={12} />
                  <YAxis stroke="var(--muted)" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none" }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="var(--accent)" />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState mascot={p.mascot} mood="idle" text="No questions logged yet." sub="Log your first batch on the left." />}
          </Card>

          <Card>
            <SectionTitle icon={ClipboardList}>Recent practice log</SectionTitle>

            {subjectsLogged.length > 1 && (
              <div className="sb-chip-row sb-track-filterrow">
                <button className={`sb-chip small ${timelineSubjectFilter === "All" ? "active" : ""}`} onClick={() => { setTimelineSubjectFilter("All"); setVisibleDays(DAYS_PER_PAGE); }}>All</button>
                {subjectsLogged.map((s) => (
                  <button key={s} className={`sb-chip small ${timelineSubjectFilter === s ? "active" : ""}`} onClick={() => { setTimelineSubjectFilter(s); setVisibleDays(DAYS_PER_PAGE); }}>{s}</button>
                ))}
              </div>
            )}

            {grouped.length === 0 ? (
              <EmptyState mascot={p.mascot} mood="idle" text="Nothing logged yet." sub="Your practice history will show up here." />
            ) : (
              <>
                {groupsShown.map(([date, list]) => {
                  const dayTotal = list.reduce((a, q) => a + Number(q.count || 0), 0);
                  return (
                    <div key={date} className="sb-timeline-group">
                      <div className="sb-timeline-day">
                        <span>{dayLabel(date)}</span>
                        <span className="sb-timeline-day-total">{dayTotal} question{dayTotal === 1 ? "" : "s"}</span>
                      </div>
                      {list.map((q) => {
                        const attempted = (Number(q.correct) || 0) + (Number(q.incorrect) || 0);
                        return (
                          <div key={q.id} className="sb-timeline-row" style={{ borderLeftColor: SYLLABUS[q.subject]?.color }}>
                            <span className="sb-dot" style={{ background: SYLLABUS[q.subject]?.color }} />
                            <div className="sb-timeline-info">
                              <div><b>{q.question_type}</b> · {q.subject}{q.chapter ? ` — ${q.chapter}` : ""}</div>
                              <div className="sb-muted">
                                {q.count} question{Number(q.count) === 1 ? "" : "s"} · {q.difficulty}
                                {attempted > 0 ? ` · ${Math.round((Number(q.correct) / attempted) * 100)}% accuracy` : ""}
                                {q.time_taken_minutes ? ` · ${q.time_taken_minutes}m` : ""}
                              </div>
                            </div>
                            {p.deleteQuestion && (
                              <button className="sb-icon-btn danger" title="Delete entry" onClick={() => p.deleteQuestion(q.id)}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {(hasMoreDays || isFullyExpanded) && (
                  <div className="sb-track-timeline-actions">
                    {hasMoreDays && (
                      <Btn variant="soft" onClick={() => setVisibleDays((v) => v + DAYS_PER_PAGE)}>
                        <ChevronDown size={14} /> Show 7 more days
                      </Btn>
                    )}
                    {hasMoreDays && grouped.length > visibleDays + DAYS_PER_PAGE && (
                      <Btn variant="ghost" onClick={() => setVisibleDays(grouped.length)}>
                        View all {grouped.length} days
                      </Btn>
                    )}
                    {isFullyExpanded && (
                      <Btn variant="ghost" onClick={() => setVisibleDays(DAYS_PER_PAGE)}>
                        <ChevronUp size={14} /> Show recent only
                      </Btn>
                    )}
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
