import React, { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  Clock3, HelpCircle, CheckSquare, RotateCcw, ClipboardList, Flame, Target, BookOpen, Sparkles, Quote,
} from "lucide-react";
import { Card, SectionTitle, ProgressRing, EmptyState } from "../components/ui";
import Mascot from "../components/Mascot";
import OverviewClockCard from "../components/OverviewClockCard";
import { SYLLABUS } from "../data/syllabus";
import { todayIST, formatISTCalendarDate, dateStrToUTCms, tsToISTDateStr } from "../lib/dateIST";
import { totalOf, defaultTotalFor } from "../lib/mockScore";
import { computeExamCountdown, resolveProfileConfig } from "../lib/examTracker";
import { MOTIVATIONAL } from "./Dashboard";

const num = (v) => Number(v || 0);

const FLAME_TIERS = [
  { min: 90, label: "Legendary blue flame 💎" },
  { min: 30, label: "Blazing hot 🔵" },
  { min: 7, label: "On fire 🔥" },
  { min: 3, label: "Warming up" },
  { min: 0, label: "" },
];
const flameTierFor = (streak) => {
  const idx = FLAME_TIERS.findIndex((t) => streak >= t.min);
  return { tier: FLAME_TIERS.length - idx, label: FLAME_TIERS[idx].label };
};

export default function DailyOverview(p) {
  const todayStr = todayIST();
  const cfg = resolveProfileConfig(p.profile);
  const mainCd = computeExamCountdown(cfg.exam_date, cfg.exam_time);

  const sessionsToday = useMemo(
    () => (p.sessions || []).filter((s) => s.session_date === todayStr),
    [p.sessions, todayStr]
  );

  const subjectRows = useMemo(() => {
    const allowed = p.activeSubjects ? new Set(p.activeSubjects) : null;
    const map = {};
    sessionsToday.forEach((s) => {
      const subj = s.subject === "Maths" ? "Mathematics" : s.subject;
      if (allowed && !allowed.has(subj)) return;
      map[subj] = (map[subj] || 0) + num(s.minutes);
    });
    return Object.entries(map)
      .map(([name, mins]) => ({ name, value: +(mins / 60).toFixed(2) }))
      .sort((a, b) => b.value - a.value);
  }, [sessionsToday, p.activeSubjects]);
  const subjectTotal = subjectRows.reduce((a, s) => a + s.value, 0) || 1;

  const todayQuestionRows = useMemo(() => (p.questions || []).filter((q) => q.log_date === todayStr), [p.questions, todayStr]);
  const questionsCorrect = todayQuestionRows.reduce((a, q) => a + num(q.correct), 0);
  const questionsIncorrect = todayQuestionRows.reduce((a, q) => a + num(q.incorrect), 0);
  const questionAccuracy = questionsCorrect + questionsIncorrect > 0
    ? Math.round((questionsCorrect / (questionsCorrect + questionsIncorrect)) * 100)
    : null;

  const todayTasks = useMemo(() => (p.tasks || []).filter((t) => t.due_date === todayStr), [p.tasks, todayStr]);
  const todayTasksDone = todayTasks.filter((t) => t.status === "Completed").length;

  const todayMocks = useMemo(() => (p.mocks || []).filter((m) => m.mock_date === todayStr), [p.mocks, todayStr]);
  const mockScoreOf = (m) => totalOf(m);
  const mockTotalOf = (m) => num(m.total_marks) || defaultTotalFor(m);

  const revisionsDueToday = useMemo(
    () => (p.revisions || []).filter((r) => r.due_date === todayStr && r.status === "Pending"),
    [p.revisions, todayStr]
  );
  const revisionsDoneToday = useMemo(
    () => (p.revisions || []).filter((r) => {
      if (r.status !== "Completed") return false;
      return r.completed_at ? tsToISTDateStr(r.completed_at) === todayStr : r.due_date === todayStr;
    }).length,
    [p.revisions, todayStr]
  );
  const revisionsTodayTotal = revisionsDueToday.length + revisionsDoneToday;
  const overdueRevisions = p.overdueRevisions?.length || 0;

  const dailyGoal = p.profile?.daily_goal || 6;
  const goalPct = Math.min(100, (p.todayHours / dailyGoal) * 100);
  const flame = flameTierFor(p.streak || 0);

  const dayIndex = Math.floor(dateStrToUTCms(todayStr) / 86400000);
  const line = MOTIVATIONAL[((dayIndex % MOTIVATIONAL.length) + MOTIVATIONAL.length) % MOTIVATIONAL.length];

  return (
    <div className="sb-page sb-overview-page">
      <div className="sb-overview-head">
        <div>
          <div className="sb-overview-title">Daily Recap</div>
          <div className="sb-muted">
            {formatISTCalendarDate(todayStr, { weekday: "long", month: "long", day: "numeric" })} · {cfg.exam || "NEET UG"} ({cfg.subject_stream})
          </div>
        </div>
        <div className={`sb-overview-streak-chip sb-streak-flame sb-flame-tier-${flame.tier}${p.streakActiveToday ? " sb-streak-flame--lit" : ""}`}>
          <Flame size={15} /> {p.streak || 0} day{p.streak === 1 ? "" : "s"}
        </div>
      </div>

      <div className="sb-overview-hero">
        <OverviewClockCard />

        <Card paper glass className="sb-overview-quote-card">
          <Quote size={20} className="sb-overview-quote-icon" />
          <div className="sb-overview-quote-text">{line}</div>
          <div className="sb-overview-quote-brand">
            <Mascot species={p.mascot} mood={p.mascotMood || "happy"} size={26} />
            <span>StudyBun NEET</span>
          </div>
        </Card>
      </div>

      <div className="sb-overview-stats-grid">
        <Card paper glass className="sb-overview-card">
          <SectionTitle icon={Clock3}>Study time</SectionTitle>
          <div className="sb-overview-big">{p.todayHours}<span>h</span></div>
          <div className="sb-muted">{p.todayLoggedHours}h logged · {p.todayTimerHours}h focus timer</div>
          <div className="sb-overview-mini-bar">
            <div className="sb-overview-mini-fill" style={{ width: `${Math.min(100, (p.todayLoggedHours / (p.todayHours || 1)) * 100)}%`, background: "var(--accent)" }} />
          </div>
        </Card>

        <Card paper glass className="sb-overview-card">
          <SectionTitle icon={Target}>Today's goal</SectionTitle>
          <div className="sb-overview-ring-row">
            <ProgressRing pct={goalPct} size={64} stroke={7} />
            <div>
              <div className="sb-overview-big" style={{ fontSize: 22 }}>{p.todayHours}h <span style={{ fontSize: 13 }}>/ {dailyGoal}h</span></div>
              <div className="sb-muted">{goalPct >= 100 ? "Goal hit today 🎉" : `${Math.round(dailyGoal - p.todayHours < 0 ? 0 : dailyGoal - p.todayHours)}h to go`}</div>
            </div>
          </div>
        </Card>

        <Card paper glass className="sb-overview-card">
          <SectionTitle icon={HelpCircle}>Questions solved</SectionTitle>
          <div className="sb-overview-ring-row">
            <ProgressRing pct={p.questionTargetPct || 0} size={64} stroke={7} color={p.questionTargetMet ? "#3E9E5C" : undefined} />
            <div>
              <div className="sb-overview-big" style={{ fontSize: 22 }}>{p.todayQuestions || 0} <span style={{ fontSize: 13 }}>/ {p.dailyQuestionTarget || 50}</span></div>
              <div className="sb-muted">
                {p.questionTargetMet ? "Target hit today 🎯" : questionAccuracy !== null ? `${questionAccuracy}% accuracy · ${questionsCorrect} correct` : "today's practice"}
              </div>
            </div>
          </div>
        </Card>

        <Card paper glass className="sb-overview-card">
          <SectionTitle icon={CheckSquare}>Tasks</SectionTitle>
          <div className="sb-overview-big">{todayTasksDone}<span>/{todayTasks.length}</span></div>
          <div className="sb-overview-mini-bar">
            <div className="sb-overview-mini-fill" style={{ width: `${todayTasks.length ? (todayTasksDone / todayTasks.length) * 100 : 0}%`, background: "var(--p2)" }} />
          </div>
          <div className="sb-muted">{todayTasks.length ? "planned for today" : "nothing planned today"}</div>
        </Card>

        <Card paper glass className="sb-overview-card">
          <SectionTitle icon={RotateCcw}>Revisions</SectionTitle>
          <div className="sb-overview-big">{revisionsDoneToday}<span>/{revisionsTodayTotal}</span></div>
          <div className="sb-muted">
            {revisionsDueToday.length > 0 ? `${revisionsDueToday.length} still due today` : "today's plan clear"}
            {overdueRevisions > 0 ? ` · ${overdueRevisions} overdue` : ""}
          </div>
        </Card>

        <Card paper glass className="sb-overview-card">
          <SectionTitle icon={ClipboardList}>Mock test</SectionTitle>
          {todayMocks.length ? (
            <>
              <div className="sb-overview-big" style={{ fontSize: 22 }}>{todayMocks.map((m) => mockScoreOf(m)).reduce((a, b) => a + b, 0)}<span>/{todayMocks.reduce((a, m) => a + mockTotalOf(m), 0)}</span></div>
              <div className="sb-muted">{todayMocks.length} mock{todayMocks.length > 1 ? "s" : ""} taken today</div>
            </>
          ) : (
            <div className="sb-muted" style={{ marginTop: 6 }}>No mock today</div>
          )}
        </Card>
      </div>

      <Card paper glass className="sb-overview-card sb-overview-card-wide">
        <SectionTitle icon={BookOpen}>Subject split today</SectionTitle>
        {subjectRows.length ? (
          <div className="sb-overview-donut-wrap">
            <div className="sb-overview-donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={subjectRows} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={4} cornerRadius={6} stroke="var(--card)" strokeWidth={3}>
                    {subjectRows.map((s) => <Cell key={s.name} fill={SYLLABUS[s.name]?.color || "var(--accent)"} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontFamily: "var(--font-body)" }} formatter={(v, n) => [`${v}h`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="sb-overview-donut-center">
                <div className="sb-overview-donut-total">{Math.round(subjectTotal)}h</div>
              </div>
            </div>
            <div className="sb-overview-legend">
              {subjectRows.map((s) => (
                <div className="sb-overview-legend-row" key={s.name}>
                  <span className="sb-overview-legend-dot" style={{ background: SYLLABUS[s.name]?.color || "var(--accent)" }} />
                  <span>{s.name}</span>
                  <span className="sb-muted" style={{ marginLeft: "auto" }}>{Math.round(s.value * 60)}m</span>
                </div>
              ))}
            </div>
          </div>
        ) : <EmptyState mascot={p.mascot} mood="idle" text="Nothing logged yet today." sub="Log a session and it'll show up here." />}
      </Card>

      <div className="sb-overview-footer">
        <div className="sb-overview-brand">
          <Mascot species={p.mascot} mood={p.mascotMood || "happy"} size={30} />
          <span>StudyBun NEET</span>
          <span className="sb-muted">
            · {mainCd.valid ? `${mainCd.calendarDays}d ${mainCd.hours}h` : `${p.daysToExam} days`} to {cfg.exam || "NEET UG"}
            {(cfg.custom_exams || []).map((ce) => {
              const ccd = computeExamCountdown(ce.date, ce.time);
              return ccd.valid && !ccd.isPast ? ` · ${ce.name}: ${ccd.calendarDays}d ${ccd.hours}h` : "";
            }).join("")}
          </span>
          <Sparkles size={13} style={{ marginLeft: 4, opacity: 0.6 }} />
        </div>
      </div>
    </div>
  );
}
