import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FolderClock, Plus, X, Star, Trash2, Archive, Pencil, RotateCcw, AlertTriangle,
  Sparkles, Target, TrendingDown, Map, CalendarCheck, PlayCircle, EyeOff, CheckCircle2,
} from "lucide-react";
import { Card, SectionTitle, Btn, EmptyState, ProgressRing } from "../components/ui";
import { todayIST, formatISTCalendarDate, formatISTTimestamp, tsToISTDateStr, daysBetweenDateStrs } from "../lib/dateIST";
import { buildRecoverySignals, mergeWithPersisted, buildTodayPlan, computeScoreLeakage, buildChapterMap } from "../lib/recoveryEngine";
import { buildProactiveSyllabusSignals } from "../lib/priorityEngine";

const SUBJECTS = ["Biology", "Physics", "Chemistry", "Mathematics", "Maths", "Other"];
const CATEGORIES = ["Full Chapter", "Lecture", "Notes", "Questions", "DPP", "Module", "Revision", "Mock Analysis", "Custom"];
const STATUSES = ["Not Started", "In Progress", "Completed", "Paused"];
const REASONS = ["Procrastination", "Illness", "Busy Schedule", "Difficult Topic", "Missed Class", "Custom"];
const SORTS = ["Recently added", "Nearest deadline", "Oldest first", "Subject"];
const FILTERS = ["All", "Pending", "In Progress", "Completed"];

const fmtDate = (d) => (d ? formatISTCalendarDate(d, { month: "short", day: "numeric" }) : null);
const fmtCompletedAt = (iso) => (iso ? formatISTTimestamp(iso, { month: "short", day: "numeric" }) : null);
const isOverdue = (d) => !!d && d < todayIST();
const daysPastDue = (d) => daysBetweenDateStrs(todayIST(), d);
const daysUntilDue = (d) => daysBetweenDateStrs(d, todayIST());
const isManual = (b) => !b.source_type || b.source_type === "manual";
const healthColor = (pct) => (pct >= 70 ? "#4E8F63" : pct >= 40 ? "#A67A2E" : "#C0435A");

const emptyDraft = () => ({
  title: "", subject: "Biology", category: "Full Chapter", deadline: "",
  estimated_amount: "", estimated_unit: "hours", reason: "", reason_custom: "", notes: "",
});
const toDraft = (b) => ({
  title: b.title || "", subject: b.subject || "Biology", category: b.category || "Custom",
  deadline: b.deadline || "", estimated_amount: b.estimated_amount ?? "", estimated_unit: b.estimated_unit || "hours",
  reason: b.reason || "", reason_custom: b.reason_custom || "", notes: b.notes || "",
});

function ItemForm({ initial, onSubmit, onCancel, submitLabel = "Add to backlog", subjects = SUBJECTS }) {
  const [d, setD] = useState(initial || emptyDraft());
  const subjectList = d.subject && !subjects.includes(d.subject) ? [...subjects, d.subject] : subjects;
  const set = (k) => (e) => setD((s) => ({ ...s, [k]: e.target.value }));

  const submit = () => {
    if (!d.title.trim()) return;
    onSubmit({
      title: d.title.trim(),
      subject: d.subject,
      category: d.category,
      deadline: d.deadline || null,
      estimated_amount: d.estimated_amount === "" ? null : Number(d.estimated_amount),
      estimated_unit: d.estimated_unit,
      reason: d.reason || null,
      reason_custom: d.reason === "Custom" ? d.reason_custom.trim() || null : null,
      notes: d.notes.trim() || null,
    });
    if (!initial) setD(emptyDraft());
  };

  return (
    <div>
      <div className="sb-form-grid">
        <div style={{ gridColumn: "span 2" }}>
          <label>Title</label>
          <input className="sb-input" value={d.title} onChange={set("title")} placeholder="e.g. Read NCERT — Molecular Basis of Inheritance" />
        </div>
        <div>
          <label>Subject</label>
          <select className="sb-input" value={d.subject} onChange={set("subject")}>{subjectList.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <div>
          <label>Category</label>
          <select className="sb-input" value={d.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <div>
          <label>Deadline (optional)</label>
          <input type="date" className="sb-input" value={d.deadline} onChange={set("deadline")} />
        </div>
        <div>
          <label>Estimated time</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input type="number" min="0" step="0.5" className="sb-input" value={d.estimated_amount} onChange={set("estimated_amount")} placeholder="e.g. 2" />
            <select className="sb-input" style={{ maxWidth: 104 }} value={d.estimated_unit} onChange={set("estimated_unit")}>
              <option value="hours">hours</option>
              <option value="sessions">sessions</option>
            </select>
          </div>
        </div>
        <div>
          <label>Reason (optional)</label>
          <select className="sb-input" value={d.reason} onChange={set("reason")}>
            <option value="">—</option>
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        {d.reason === "Custom" && (
          <div>
            <label>Custom reason</label>
            <input className="sb-input" value={d.reason_custom} onChange={set("reason_custom")} placeholder="What happened?" />
          </div>
        )}
        <div style={{ gridColumn: "span 2" }}>
          <label>Notes (optional)</label>
          <input className="sb-input" value={d.notes} onChange={set("notes")} placeholder='e.g. "Continue from Lecture 12"' />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={submit}><Plus size={16} /> {submitLabel}</Btn>
        {onCancel && <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>}
      </div>
    </div>
  );
}

function RecoveryCard({ item, onStart, onAddToday, onDismiss, onComplete, compact }) {
  return (
    <div className={`sb-recovery-card impact-${item.impactTier}`}>
      <div className="sb-recovery-card-head">
        <div style={{ minWidth: 0 }}>
          <div className="sb-recovery-subject">{item.subject}</div>
          <div className="sb-recovery-title">{item.chapter || item.subject}</div>
          <div className="sb-recovery-problem">{item.problemLabel}</div>
        </div>
        <span className={`sb-recovery-impact-badge ${item.impactTier}`}>{item.impactTier} impact</span>
      </div>

      <div className="sb-recovery-why"><b>Why: </b>{item.why}</div>
      <div className="sb-recovery-action"><b>Recommended:</b> {item.recommendedAction}</div>

      <div className="sb-recovery-meta-row">
        <span>~{item.effortMin} min</span>
        <span>{item.recoveryStatus === "In Progress" ? "In progress" : `Last seen ${fmtDate(item.lastEvidenceAt) || "—"}`}</span>
      </div>

      {!compact && (
        <div className="sb-recovery-card-actions">
          <Btn onClick={() => onStart(item)}><PlayCircle size={14} /> Start recovery</Btn>
          <Btn variant="soft" onClick={() => onAddToday(item)}>Add to today</Btn>
          <Btn variant="ghost" onClick={() => onComplete(item)}><CheckCircle2 size={14} /> Mark recovered</Btn>
          <Btn variant="ghost" onClick={() => onDismiss(item)}><EyeOff size={14} /> Not now</Btn>
        </div>
      )}
    </div>
  );
}

export default function BacklogPage(p) {
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState("Recently added");
  const [buildingSession, setBuildingSession] = useState(false);
  const [sessionPicks, setSessionPicks] = useState([]);

  const activeSubjects = p.activeSubjects ? [...p.activeSubjects, "Other"] : SUBJECTS;
  const allItems = p.backlogItems || [];
  const mocks = p.mocks || [];
  const mockAnalysisMap = p.mockAnalysisMap || {};
  const revisions = p.revisions || [];

  // ---------- Layer A → B → C: the recovery queue ----------
  // Reactive half: driven by mock mistakes / overdue revisions (unchanged).
  const reactiveSignals = useMemo(
    () => buildRecoverySignals({ mocks, mockAnalysisMap, revisions }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mocks, mockAnalysisMap, revisions]
  );
  // Proactive half: chapters the Syllabus priority engine already flags as
  // Critical/blocked, even before any mock has caught it. Never duplicates
  // a chapter that already has a reactive card.
  const syllabusSignals = useMemo(() => {
    if (!p.allChapters || !p.getChStatus) return [];
    const excludeChapterKeys = new Set(reactiveSignals.filter((s) => s.chapter).map((s) => `${s.subject}::${s.chapter}`));
    return buildProactiveSyllabusSignals({
      allChapters: p.allChapters, getChStatus: p.getChStatus, questions: p.questions || [],
      excludeChapterKeys, limit: 5,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactiveSignals, p.allChapters, p.getChStatus, p.questions]);
  const liveSignals = useMemo(() => [...reactiveSignals, ...syllabusSignals], [reactiveSignals, syllabusSignals]);
  const { merged: queue, toReopen } = useMemo(() => mergeWithPersisted(liveSignals, allItems), [liveSignals, allItems]);

  // A mistake that repeats after being marked Recovered/Dismissed reopens the
  // card automatically — the feedback loop from spec §24/§25. Guarded so a
  // given row is only re-triggered once per fresh evidence bump.
  const reopenedRef = useRef(new Set());
  useEffect(() => {
    toReopen.forEach(({ id, sig }) => {
      const guardKey = `${id}:${sig.evidenceCount}`;
      if (reopenedRef.current.has(guardKey)) return;
      reopenedRef.current.add(guardKey);
      p.reopenRecoveryRow(id, sig);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toReopen]);

  const today = todayIST();
  const activeQueue = useMemo(
    () => queue.filter((it) => (it.recoveryStatus === "Open" || it.recoveryStatus === "In Progress") && (!it.dismissedUntil || it.dismissedUntil <= today)),
    [queue, today]
  );
  const dismissedQueue = useMemo(() => queue.filter((it) => it.recoveryStatus === "Dismissed" && it.dismissedUntil && it.dismissedUntil > today), [queue, today]);
  const recoveredQueue = useMemo(() => queue.filter((it) => it.recoveryStatus === "Recovered"), [queue]);

  const todayPlan = useMemo(() => {
    const pinned = activeQueue.filter((it) => it.inSession);
    const auto = buildTodayPlan(activeQueue).picks;
    const combined = [...pinned];
    auto.forEach((it) => { if (!combined.some((c) => c.sourceKey === it.sourceKey)) combined.push(it); });
    const picks = combined.slice(0, 4);
    return { picks, totalMin: picks.reduce((s, it) => s + it.effortMin, 0) };
  }, [activeQueue]);

  const leakage = useMemo(() => computeScoreLeakage(mocks, queue), [mocks, queue]);
  const chapterMap = useMemo(() => buildChapterMap(queue), [queue]);
  const repeatMistakeCount = useMemo(() => activeQueue.filter((it) => it.mockOccurrences >= 2).length, [activeQueue]);
  const highImpactCount = activeQueue.filter((it) => it.impactTier === "high").length;

  // ---------- Manual backlog (secondary, existing behaviour preserved) ----------
  const manualItems = useMemo(() => allItems.filter(isManual), [allItems]);
  const active = useMemo(() => manualItems.filter((b) => b.status !== "Completed"), [manualItems]);
  const completed = useMemo(() => manualItems.filter((b) => b.status === "Completed"), [manualItems]);
  const sessionItems = useMemo(() => active.filter((b) => b.in_session), [active]);

  const overdueItems = useMemo(
    () => active.filter((b) => isOverdue(b.deadline)).sort((a, b) => (a.deadline < b.deadline ? -1 : 1)),
    [active]
  );

  const visible = useMemo(() => {
    const base = filter === "Completed" ? completed
      : filter === "Pending" ? active.filter((b) => b.status === "Not Started")
      : filter === "In Progress" ? active.filter((b) => b.status === "In Progress")
      : active;
    const cmp = {
      "Nearest deadline": (a, b) => (a.deadline ? new Date(a.deadline).getTime() : Infinity) - (b.deadline ? new Date(b.deadline).getTime() : Infinity),
      "Oldest first": (a, b) => new Date(a.created_at) - new Date(b.created_at),
      "Recently added": (a, b) => new Date(b.created_at) - new Date(a.created_at),
      "Subject": (a, b) => a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title),
    }[sort];
    return [...base].sort(cmp);
  }, [filter, sort, active, completed]);

  const grouped = useMemo(() => {
    const bySubject = {};
    visible.forEach((b) => {
      const key = b.subject || "Other";
      (bySubject[key] = bySubject[key] || []).push(b);
    });
    const order = [...SUBJECTS, ...Object.keys(bySubject).filter((k) => !SUBJECTS.includes(k))];
    return order.filter((s) => bySubject[s]?.length).map((s) => [s, bySubject[s]]);
  }, [visible]);

  const startSession = () => {
    sessionPicks.forEach((id) => {
      const item = active.find((b) => b.id === id);
      if (item) p.toggleSessionItem(item);
    });
    setSessionPicks([]);
    setBuildingSession(false);
  };

  // ---------- Hero copy ----------
  const hasAnyMockReview = Object.keys(mockAnalysisMap).length > 0;
  const heroSub = !hasAnyMockReview && manualItems.length === 0
    ? "Review your first mock and tag the chapters behind your mistakes. We'll turn those mistakes into a prioritized recovery plan."
    : "Your recovery queue is built from mock mistakes, weak chapters, missed revision and unfinished work.";

  // ---------- Recovery health ring (pulse) ----------
  const recoveryHealthPct = activeQueue.length === 0
    ? 100
    : Math.round(100 - activeQueue.reduce((sum, it) => sum + it.priorityScore, 0) / activeQueue.length);
  const recoveredThisWeek = useMemo(() => {
    return recoveredQueue.filter((it) => {
      const row = allItems.find((b) => b.source_key === it.sourceKey);
      return row?.completed_at && daysBetweenDateStrs(today, tsToISTDateStr(row.completed_at)) <= 6;
    }).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveredQueue, allItems, today]);

  return (
    <div className="sb-page">
      <Card className="sb-hero" washi>
        <div className="sb-hero-copy">
          <div className="sb-hero-greet">Clear what is costing you marks.</div>
          <div className="sb-hero-line">{heroSub}</div>
          {(activeQueue.length > 0 || manualItems.length > 0) && (
            <div className="sb-recovery-summary">
              <span className="sb-recovery-summary-chip"><b>{activeQueue.length}</b> recovery items</span>
              {highImpactCount > 0 && <span className="sb-recovery-summary-chip warn"><b>{highImpactCount}</b> high impact</span>}
              <span className="sb-recovery-summary-chip"><b>{activeQueue.filter((it) => it.problemType === "revision_overdue").length}</b> revision overdue</span>
              <span className="sb-recovery-summary-chip"><b>{activeQueue.filter((it) => it.sourceType === "mock_analysis").length}</b> mock-derived</span>
            </div>
          )}
        </div>
      </Card>

      <div className="sb-backlog-layout">
        {/* ---------- Left: manual add form + recovery pulse (sticky on desktop) ---------- */}
        <div className="sb-backlog-left">
          <Card washi>
            <SectionTitle icon={Plus}>Add manual item</SectionTitle>
            <ItemForm onSubmit={(payload) => p.addBacklogItem(payload)} />
          </Card>

          <Card className="sb-card-tinted">
            <SectionTitle icon={Sparkles}>Backlog health</SectionTitle>
            <div className="sb-backlog-pulse">
              <div className="sb-backlog-ring-wrap">
                <ProgressRing pct={recoveryHealthPct} size={80} stroke={9} color={healthColor(recoveryHealthPct)} />
                <div className="sb-backlog-ring-label">Recovery health</div>
              </div>
              <div className="sb-backlog-pulse-nums">
                <div className="sb-backlog-stat">
                  <span className="sb-backlog-stat-label">Recovery load</span>
                  <span className="sb-backlog-stat-num">{activeQueue.length}</span>
                </div>
                <div className="sb-backlog-stat">
                  <span className="sb-backlog-stat-label">High impact</span>
                  <span className="sb-backlog-stat-num">{highImpactCount}</span>
                </div>
                <div className="sb-backlog-stat">
                  <span className="sb-backlog-stat-label">Recovered this week</span>
                  <span className="sb-backlog-stat-num">{recoveredThisWeek}</span>
                </div>
              </div>
            </div>
            {repeatMistakeCount > 0 && (
              <div className="sb-repeat-callout">
                <div className="sb-repeat-callout-num">{repeatMistakeCount}</div>
                <div className="sb-repeat-callout-text">Repeat mistake{repeatMistakeCount === 1 ? "" : "s"} — this is the biggest threat to your score right now.</div>
              </div>
            )}
          </Card>
        </div>

        {/* ---------- Right: recovery plan, priority queue, leakage, chapter map, manual list, history ---------- */}
        <div className="sb-backlog-right">

          {/* ---------- Today's Recovery Plan ---------- */}
          <Card>
            <SectionTitle icon={CalendarCheck}>Today's Recovery Plan</SectionTitle>
            {todayPlan.picks.length === 0 ? (
              <EmptyState mascot={p.mascot} mood="idle" text={hasAnyMockReview ? "No major recovery signals right now." : "Your recovery engine is ready."}
                sub={hasAnyMockReview ? "Keep reviewing mocks and we'll surface repeated weaknesses automatically." : "Review your first mock and tag the chapters behind your mistakes."} />
            ) : (
              <>
                <div className="sb-today-plan-list">
                  {todayPlan.picks.map((it, i) => (
                    <div key={it.sourceKey} className="sb-today-plan-row">
                      <div className="sb-today-plan-num">{String(i + 1).padStart(2, "0")}</div>
                      <div className="sb-today-plan-info"><b>{it.chapter || it.subject}</b><div className="sb-muted small">{it.problemLabel}</div></div>
                      <div className="sb-today-plan-effort">{it.effortMin} min</div>
                    </div>
                  ))}
                </div>
                <div className="sb-today-plan-total">Total: ~{todayPlan.totalMin} min</div>
                <div style={{ marginTop: 10 }}>
                  <Btn onClick={() => p.startRecoveryItem(todayPlan.picks[0])}><PlayCircle size={16} /> Start today's plan</Btn>
                </div>
              </>
            )}
          </Card>

          {/* ---------- Clear These First ---------- */}
          <Card>
            <SectionTitle icon={Target}>Clear these first <span className="sb-muted">({activeQueue.length})</span></SectionTitle>
            {activeQueue.length === 0 ? (
              <EmptyState mascot={p.mascot} mood="happy" text="No major recovery signals right now." sub="Keep reviewing mocks and we'll surface repeated weaknesses automatically." />
            ) : (
              <div className="sb-recovery-grid">
                {activeQueue.map((it) => (
                  <RecoveryCard
                    key={it.sourceKey}
                    item={it}
                    onStart={p.startRecoveryItem}
                    onAddToday={p.addRecoveryToToday}
                    onDismiss={p.dismissRecoveryItem}
                    onComplete={p.completeRecoveryItem}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* ---------- Score leakage ---------- */}
          {(leakage.hasMainsData || leakage.hasPotentialData) && (
            <Card>
              <SectionTitle icon={TrendingDown}>Score leakage</SectionTitle>
              {leakage.hasMainsData ? (
                <div className="sb-leakage-grid">
                  {["Biology", "Physics", "Chemistry", ...(leakage.actual.Maths > 0 ? ["Maths"] : [])].map((s) => {
                    const v = leakage.actual[s] || 0;
                    const max = Math.max(1, leakage.actual.Biology || 0, leakage.actual.Physics || 0, leakage.actual.Chemistry || 0, leakage.actual.Maths || 0);
                    return (
                      <div key={s} className="sb-leakage-row">
                        <div className="sb-leakage-label">{s}</div>
                        <div className="sb-leakage-track"><div className="sb-leakage-fill" style={{ width: `${(v / max) * 100}%` }} /></div>
                        <div className="sb-leakage-value">-{v}</div>
                      </div>
                    );
                  })}
                  <p className="sb-muted small" style={{ marginTop: 2 }}>Actual negative marks from NEET UG mocks (+4/-1 scheme).</p>
                </div>
              ) : (
                <p className="sb-muted small">Log a NEET UG mock to see actual negative marks by subject.</p>
              )}
              {leakage.hasPotentialData && (
                <p className="sb-leakage-potential">
                  Potential recovery: ~{Object.values(leakage.potential).reduce((a, b) => a + b, 0)} marks if you clear the open items in "Clear these first". This is an estimate, not a guarantee.
                </p>
              )}
            </Card>
          )}

          {/* ---------- Chapter Recovery Map ---------- */}
          {Object.keys(chapterMap).length > 0 && (
            <Card>
              <SectionTitle icon={Map}>Chapter recovery map</SectionTitle>
              {Object.entries(chapterMap).map(([subject, chapters]) => (
                <div key={subject} className="sb-chaptermap-subject">
                  <div className="sb-chaptermap-subject-title">{subject}</div>
                  {chapters.map((c) => (
                    <div key={c.chapter} className="sb-chaptermap-row">
                      <div className="sb-chaptermap-name">{c.chapter}</div>
                      <div className="sb-chaptermap-health">
                        <div className="sb-chaptermap-health-track">
                          <div className="sb-chaptermap-health-fill" style={{ width: `${c.health}%`, background: healthColor(c.health) }} />
                        </div>
                      </div>
                      <span className="sb-tag">{c.health}/100</span>
                    </div>
                  ))}
                </div>
              ))}
            </Card>
          )}

          {/* ---------- Manual backlog ---------- */}
          <Card>
            <SectionTitle
              icon={Star}
              right={sessionItems.length > 0 && !buildingSession ? <Btn variant="ghost" onClick={() => setBuildingSession(true)}>Add more</Btn> : null}
            >
              Today's manual session
            </SectionTitle>

            {sessionItems.length === 0 && !buildingSession && (
              active.length === 0 ? (
                <EmptyState mascot={p.mascot} mood="idle" text="No manual backlog items yet." sub="Add unfinished lectures, DPPs, or pending assignments on the left." />
              ) : (
                <>
                  <p className="sb-muted" style={{ marginBottom: 10 }}>Pick a few manual items to focus on today.</p>
                  <Btn variant="soft" onClick={() => setBuildingSession(true)}><Plus size={16} /> Build today's session</Btn>
                </>
              )
            )}

            {buildingSession && (
              <div>
                <p className="sb-muted" style={{ marginBottom: 10 }}>Select what you'll work on today.</p>
                {active.filter((b) => !b.in_session).length === 0 ? (
                  <p className="sb-muted small">Everything left is already in today's session.</p>
                ) : (
                  active.filter((b) => !b.in_session).map((b) => (
                    <label key={b.id} className="sb-task-row" style={{ cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={sessionPicks.includes(b.id)}
                        onChange={() => setSessionPicks((prev) => (prev.includes(b.id) ? prev.filter((id) => id !== b.id) : [...prev, b.id]))}
                      />
                      <div className="sb-task-info"><b>{b.title}</b><div className="sb-muted">{b.subject} · {b.category}</div></div>
                    </label>
                  ))
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <Btn disabled={!sessionPicks.length} onClick={startSession}>Start session</Btn>
                  <Btn variant="ghost" onClick={() => { setSessionPicks([]); setBuildingSession(false); }}>Cancel</Btn>
                </div>
              </div>
            )}

            {sessionItems.length > 0 && (
              <div>
                {sessionItems.map((b) => (
                  <div key={b.id} className="sb-task-row">
                    <button
                      className={`sb-checkbox ${b.status === "Completed" ? "checked" : ""}`}
                      onClick={() => p.setBacklogStatus(b, b.status === "Completed" ? "Not Started" : "Completed")}
                    />
                    <div className="sb-task-info"><b>{b.title}</b><div className="sb-muted">{b.subject} · {b.category}{b.deadline ? ` · due ${fmtDate(b.deadline)}` : ""}</div></div>
                    <select className="sb-input small" style={{ width: "auto" }} value={b.status} onChange={(e) => p.setBacklogStatus(b, e.target.value)}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <button className="sb-icon-btn" title="Remove from today's session" onClick={() => p.toggleSessionItem(b)}><X size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {overdueItems.length > 0 && (
            <Card className="sb-overdue-card">
              <SectionTitle icon={AlertTriangle}>Manual items overdue</SectionTitle>
              <p className="sb-muted small" style={{ marginBottom: 10 }}>
                {overdueItems.length} manual item{overdueItems.length === 1 ? "" : "s"} past deadline.
              </p>
              {overdueItems.slice(0, 4).map((b) => (
                <div key={b.id} className="sb-overdue-row">
                  <span className="sb-overdue-days">{daysPastDue(b.deadline)}d late</span>
                  <div className="sb-overdue-info"><b>{b.title}</b><div className="sb-muted">{b.subject} · {b.category}</div></div>
                  <button
                    className={`sb-icon-btn ${b.in_session ? "starred" : ""}`}
                    title={b.in_session ? "Remove from today's session" : "Add to today's session"}
                    onClick={() => p.toggleSessionItem(b)}
                  >
                    <Star size={16} fill={b.in_session ? "currentColor" : "none"} />
                  </button>
                </div>
              ))}
            </Card>
          )}

          {manualItems.length > 0 && (
            <Card>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
                <div className="sb-chip-row">
                  {FILTERS.map((f) => (
                    <button key={f} className={`sb-chip small ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                      {f}{f === "Completed" && completed.length ? ` (${completed.length})` : ""}
                    </button>
                  ))}
                </div>
                <select className="sb-input small" style={{ width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value)}>
                  {SORTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </Card>
          )}

          {manualItems.length === 0 ? null : filter === "Completed" ? (
            <Card>
              <SectionTitle icon={Archive}>Archive <span className="sb-muted">({completed.length} completed)</span></SectionTitle>
              {completed.length === 0 ? (
                <EmptyState mascot={p.mascot} mood="idle" text="Nothing completed yet." sub="Cleared items land here instead of disappearing." />
              ) : (
                <div className="sb-chapter-grid">
                  {visible.map((b) => (
                    <div key={b.id} className="sb-chapter-card">
                      <div className="sb-chapter-name" style={{ textDecoration: "line-through" }}>{b.title}</div>
                      <div className="sb-chapter-tags">
                        <span className="sb-tag">{b.subject}</span>
                        <span className="sb-tag">{b.category}</span>
                        {b.completed_at && <span className="sb-tag">done {fmtCompletedAt(b.completed_at)}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Btn variant="soft" onClick={() => p.setBacklogStatus(b, "Not Started")}><RotateCcw size={14} /> Reopen</Btn>
                        <button className="sb-icon-btn danger" title="Delete" onClick={() => p.deleteBacklogItem(b.id)}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : visible.length === 0 ? (
            <Card><EmptyState mascot={p.mascot} mood="happy" text="Nothing here." sub="Try a different filter." /></Card>
          ) : (
            grouped.map(([subject, list]) => (
              <Card key={subject}>
                <SectionTitle icon={FolderClock}>{subject} <span className="sb-muted">({list.length})</span></SectionTitle>
                <div className="sb-chapter-grid">
                  {list.map((b) => (
                    editingId === b.id ? (
                      <div key={b.id} className="sb-chapter-card sb-chapter-card-open">
                        <ItemForm
                          initial={toDraft(b)}
                          submitLabel="Save changes" subjects={activeSubjects}
                          onSubmit={(payload) => { p.updateBacklogItem(b.id, payload); setEditingId(null); }}
                          onCancel={() => setEditingId(null)}
                        />
                      </div>
                    ) : (
                      <div key={b.id} className="sb-chapter-card">
                        <div className="sb-chapter-name">{b.title}</div>
                        <div className="sb-chapter-tags">
                          <span className="sb-recovery-source-tag manual">Manual</span>
                          <span className="sb-tag">{b.category}</span>
                          {b.deadline && (() => {
                            const overdue = isOverdue(b.deadline);
                            const dueSoon = !overdue && daysUntilDue(b.deadline) <= 3;
                            const cls = overdue ? "priority-high" : dueSoon ? "priority-medium" : "";
                            return (
                              <span className={`sb-tag ${cls}`}>
                                {overdue ? `overdue ${daysPastDue(b.deadline)}d` : `due ${fmtDate(b.deadline)}`}
                              </span>
                            );
                          })()}
                          {b.estimated_amount != null && <span className="sb-tag">~{b.estimated_amount} {b.estimated_unit}</span>}
                          {b.reason && <span className="sb-tag">{b.reason === "Custom" ? (b.reason_custom || "Custom") : b.reason}</span>}
                        </div>
                        {b.notes && <div className="sb-muted small">{b.notes}</div>}
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <select className="sb-input small" style={{ width: "auto" }} value={b.status} onChange={(e) => p.setBacklogStatus(b, e.target.value)}>
                            {STATUSES.map((s) => <option key={s}>{s}</option>)}
                          </select>
                          <button
                            className={`sb-icon-btn ${b.in_session ? "starred" : ""}`}
                            title={b.in_session ? "Remove from today's session" : "Add to today's session"}
                            onClick={() => p.toggleSessionItem(b)}
                          >
                            <Star size={16} fill={b.in_session ? "currentColor" : "none"} />
                          </button>
                          <button className="sb-icon-btn" title="Edit" onClick={() => setEditingId(b.id)}><Pencil size={16} /></button>
                          <button className="sb-icon-btn danger" title="Delete" onClick={() => p.deleteBacklogItem(b.id)}><Trash2 size={16} /></button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </Card>
            ))
          )}

          {/* ---------- Completed / Recovered history ---------- */}
          {(recoveredQueue.length > 0 || dismissedQueue.length > 0) && (
            <Card>
              <SectionTitle icon={CheckCircle2}>Recovered <span className="sb-muted">({recoveredQueue.length})</span></SectionTitle>
              {recoveredQueue.length === 0 ? (
                <p className="sb-muted small">Nothing recovered yet — cleared recovery items will land here.</p>
              ) : (
                <div className="sb-chapter-grid">
                  {recoveredQueue.map((it) => (
                    <div key={it.sourceKey} className="sb-chapter-card">
                      <div className="sb-chapter-name" style={{ textDecoration: "line-through" }}>{it.chapter || it.subject}</div>
                      <div className="sb-chapter-tags">
                        <span className="sb-recovery-source-tag generated">Recovered</span>
                        <span className="sb-tag">{it.problemLabel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {dismissedQueue.length > 0 && (
                <p className="sb-muted small" style={{ marginTop: 12 }}>
                  {dismissedQueue.length} item{dismissedQueue.length === 1 ? "" : "s"} dismissed for now — they'll resurface automatically if the evidence grows, or after their snooze window ends.
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
