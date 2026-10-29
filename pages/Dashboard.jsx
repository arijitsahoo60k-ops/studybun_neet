import React, { memo, useState, useEffect } from "react";
import { Target, Clock3, Flame, TrendingUp, BookOpen, Plus, Trash2, CalendarClock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Card, ProgressRing, SectionTitle, EmptyState, Btn } from "../components/ui";
import Mascot from "../components/Mascot";
import { SYLLABUS } from "../data/syllabus";
import { todayIST, formatISTCalendarDate, dateStrToUTCms } from "../lib/dateIST";
import { computeExamCountdown, resolveProfileConfig } from "../lib/examTracker";

import { MOTIVATIONAL } from "../data/motivationalQuotes";
export { MOTIVATIONAL };

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

// How long each countdown stays on screen before the card slides to the next.
const COUNTDOWN_SLIDE_MS = 4000;
// Keeps the title row a constant width/height no matter what the user typed.
const shortExamName = (name, max = 18) => {
  const s = String(name || "").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

// Isolated live-ticking exam & custom exam time tracker card so its 1-second
// clock tick only ever re-renders this one card, never the Recharts charts.
//
// The card is a slideshow: slide 0 is the primary exam, every custom exam
// the user adds becomes its own slide after it. All slides sit stacked in
// one CSS-grid cell (so the card is always as tall as its tallest slide and
// never jumps while cross-fading) and auto-advance every COUNTDOWN_SLIDE_MS.
// Auto-advance pauses while the mouse is over the card, while a keyboard
// user is focused inside it, and while the "add custom exam" form is open.
const ExamTimeTrackerCard = memo(function ExamTimeTrackerCard({ profile, daysToExam, saveProfile }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("14:00");
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const cfg = resolveProfileConfig(profile);
  const mainCd = computeExamCountdown(cfg.exam_date, cfg.exam_time, nowMs);
  const customExams = cfg.custom_exams || [];
  const canEdit = typeof saveProfile === "function";

  const mainName = cfg.exam || "NEET UG";
  const slides = [
    { key: "main", name: mainName, ce: null },
    ...customExams.map((ce) => ({ key: ce.id, name: ce.name || "Custom exam", ce })),
  ];
  const count = slides.length;
  // A removed custom exam can leave `active` pointing past the end; clamp
  // at render time instead of syncing state in an effect.
  const activeIdx = Math.min(active, count - 1);
  const paused = hovered || focused || addingCustom;

  useEffect(() => {
    if (count < 2 || paused) return undefined;
    // setTimeout keyed on activeIdx (not setInterval) so a manual dot click
    // restarts the full 4s for the slide the user just picked.
    const id = setTimeout(() => {
      setActive((i) => (Math.min(i, count - 1) + 1) % count);
    }, COUNTDOWN_SLIDE_MS);
    return () => clearTimeout(id);
  }, [activeIdx, count, paused]);

  const handleAddCustom = () => {
    if (!customName.trim() || !customDate || !canEdit) return;
    const item = {
      id: `ce_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: customName.trim(),
      date: customDate,
      time: customTime || "14:00",
    };
    saveProfile({ custom_exams: [...customExams, item] });
    // Jump straight to the slide that was just created (index = old count).
    setActive(count);
    setCustomName("");
    setCustomDate("");
    setCustomTime("14:00");
    setAddingCustom(false);
  };

  const handleRemoveCustom = (id) => {
    if (!canEdit) return;
    // The focused trash button unmounts with its slide and never fires blur,
    // which would leave auto-advance paused forever.
    setFocused(false);
    saveProfile({ custom_exams: customExams.filter((x) => x.id !== id) });
  };

  const handleFocus = (e) => {
    // Only keyboard focus pauses the show; a mouse click on a dot shouldn't.
    let keyboard = true;
    try { keyboard = e.target.matches(":focus-visible"); } catch { keyboard = true; }
    if (keyboard) setFocused(true);
  };
  const handleBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
  };

  const renderTicker = (cd, onRemove) => (
    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
      {!cd.isPast && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: "var(--card)",
            border: "1.5px solid var(--mascot-outline)",
            fontSize: 11.5,
            fontWeight: 800,
            width: "fit-content",
          }}
        >
          <CalendarClock size={12} style={{ color: "var(--accent)" }} />
          <span>
            {cd.days}d : {String(cd.hours).padStart(2, "0")}h : {String(cd.minutes).padStart(2, "0")}m : {String(cd.seconds).padStart(2, "0")}s
          </span>
        </div>
      )}
      <div className="sb-cd-targetrow">
        <div className="sb-muted" style={{ fontSize: 11, fontWeight: 700 }}>
          Target: {cd.formattedDate} · {cd.formattedTime}
        </div>
        {onRemove && (
          <button type="button" className="sb-icon-btn danger" onClick={onRemove} title="Remove custom tracker" aria-label="Remove custom tracker">
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );

  const renderSlide = (s) => {
    if (!s.ce) {
      return (
        <>
          <div className="sb-countdown sb-countdown-hero">
            {profile?.exam_date && mainCd.valid ? mainCd.calendarDays : daysToExam}
            <span>days left</span>
          </div>
          {mainCd.valid && renderTicker(mainCd, null)}
        </>
      );
    }
    const cd = computeExamCountdown(s.ce.date, s.ce.time, nowMs);
    return (
      <>
        <div className="sb-countdown sb-countdown-hero">
          {!cd.valid ? "—" : cd.isPast ? <span className="sb-cd-donetext">Done</span> : cd.calendarDays}
          {cd.valid && !cd.isPast && <span>{cd.calendarDays === 1 ? "day left" : "days left"}</span>}
        </div>
        {cd.valid ? renderTicker(cd, canEdit ? () => handleRemoveCustom(s.ce.id) : null) : (
          <div className="sb-cd-targetrow" style={{ marginTop: 6 }}>
            <div className="sb-muted" style={{ fontSize: 11, fontWeight: 700 }}>Date not set correctly</div>
            {canEdit && (
              <button type="button" className="sb-icon-btn danger" onClick={() => handleRemoveCustom(s.ce.id)} title="Remove custom tracker" aria-label="Remove custom tracker">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <Card paper glass className="sb-countdown-card">
      <div
        onPointerEnter={(e) => { if (e.pointerType === "mouse") setHovered(true); }}
        onPointerLeave={() => setHovered(false)}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <div className="sb-section-title">
          <span>
            <span className="sb-icon-badge"><Target size={16} /></span>
            <span className="sb-cd-titlestack">
              {slides.map((s, i) => (
                <span
                  key={s.key}
                  className={`sb-cd-title${i === activeIdx ? " is-active" : ""}`}
                  aria-hidden={i !== activeIdx}
                  title={s.name}
                >
                  Countdown to {shortExamName(s.name)}
                </span>
              ))}
            </span>
          </span>
          {canEdit && (
            <button
              type="button"
              className="sb-chip small"
              style={{ padding: "3px 9px", fontSize: 10.5 }}
              onClick={() => setAddingCustom((v) => !v)}
              title="Add a custom exam or coaching test countdown"
            >
              <Plus size={11} style={{ marginRight: 2, verticalAlign: -1 }} /> Custom exam
            </button>
          )}
        </div>

        <div className="sb-cd-slides">
          {slides.map((s, i) => (
            <div
              key={s.key}
              className={`sb-cd-slide${i === activeIdx ? " is-active" : ""}`}
              aria-hidden={i !== activeIdx}
              data-testid="sb-cd-slide"
            >
              {renderSlide(s)}
            </div>
          ))}
        </div>

        {count > 1 && (
          <div className="sb-cd-dots" role="group" aria-label="Exam countdowns">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                className={`sb-cd-dot${i === activeIdx ? " is-active" : ""}`}
                aria-label={`Show ${s.name} countdown`}
                aria-current={i === activeIdx ? "true" : undefined}
                onClick={() => setActive(i)}
              />
            ))}
          </div>
        )}

        {addingCustom && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 14,
              background: "var(--card)",
              border: "1.5px solid var(--mascot-outline)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 6 }}>Add Custom Exam / Test Time Tracker</div>
            <input
              className="sb-input small"
              placeholder="e.g. AIATS 3, Allen Major, Pre-Boards..."
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              style={{ marginBottom: 6 }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 6, marginBottom: 8 }}>
              <input type="date" className="sb-input small" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
              <input type="time" className="sb-input small" value={customTime} onChange={(e) => setCustomTime(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setAddingCustom(false)}>Cancel</Btn>
              <Btn onClick={handleAddCustom} disabled={!customName.trim() || !customDate}>Save</Btn>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
});

const DashboardCharts = memo(function DashboardCharts({ weeklyData, subjectPie, mascot }) {
  const subjectTotal = subjectPie.reduce((a, s) => a + s.value, 0) || 1;
  const subjectRows = [...subjectPie].sort((a, b) => b.value - a.value);

  return (
    <div className="sb-grid-2">
      <Card paper>
        <SectionTitle icon={TrendingUp}>Weekly study hours</SectionTitle>
        <div className="sb-dash-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--soft)" />
              <XAxis dataKey="day" stroke="var(--muted)" fontSize={12} />
              <YAxis stroke="var(--muted)" fontSize={12} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontFamily: "var(--font-body)" }} />
              <Legend wrapperStyle={{ fontSize: 11.5 }} />
              <Line type="monotone" dataKey="hours" name="Logged" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="timerHours" name="Focus Timer" stroke="var(--chart-secondary, var(--outline))" strokeWidth={3} strokeDasharray="5 3" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card paper>
        <SectionTitle icon={BookOpen}>Subject split</SectionTitle>
        {subjectRows.length ? (
          <div className="sb-subject-donut-wrap">
            <div className="sb-subject-donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={subjectRows}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="64%"
                    outerRadius="100%"
                    paddingAngle={4}
                    cornerRadius={6}
                    stroke="var(--card)"
                    strokeWidth={3}
                    isAnimationActive={true}
                  >
                    {subjectRows.map((s) => (
                      <Cell key={s.name} fill={SYLLABUS[s.name]?.color || "var(--accent)"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "none", fontFamily: "var(--font-body)" }}
                    formatter={(value, name) => [`${value}h`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="sb-subject-donut-center">
                <div className="sb-subject-donut-total">{Math.round(subjectTotal)}h</div>
                <div className="sb-subject-donut-label">total</div>
              </div>
            </div>
            <div className="sb-subject-legend">
              {subjectRows.map((s) => {
                const pct = Math.round((s.value / subjectTotal) * 100);
                return (
                  <div className="sb-subject-legend-row" key={s.name}>
                    <span className="sb-subject-dot" style={{ background: SYLLABUS[s.name]?.color || "var(--accent)" }} />
                    <span className="sb-subject-legend-name">{s.name}</span>
                    <span className="sb-subject-legend-meta">
                      <span className="sb-subject-legend-pct">{pct}%</span>
                      <span className="sb-subject-legend-hrs">{Math.round(s.value)}h</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : <EmptyState mascot={mascot} mood="idle" text="No study logged yet." sub="Log your first session and I'll chart it here." />}
      </Card>
    </div>
  );
});

function DashboardInner(p) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const goalPct = (p.todayHours / (p.profile.daily_goal || 6)) * 100;
  const todayStr = todayIST();
  const dayIndex = Math.floor(dateStrToUTCms(todayStr) / 86400000);
  const line = MOTIVATIONAL[((dayIndex % MOTIVATIONAL.length) + MOTIVATIONAL.length) % MOTIVATIONAL.length];
  const mascotMood = p.mascotMood || "idle";
  const mascotEnergyLevel = p.mascotEnergy;

  const backlogOpen = p.backlogItems.filter((b) => b.status !== "Completed").length;
  const revisionsDue = p.dueRevisions.length + p.overdueRevisions.length;
  const cfg = resolveProfileConfig(p.profile);

  return (
    <div className="sb-page">
      <div className="sb-dash-layout">
        <div className="sb-dash-main">
          <Card className="sb-hero" washi paper glass>
            <div className="sb-hero-copy">
              <div className="sb-hero-greet">{greeting}, {p.profile.name || "friend"} 🌸</div>
              <div className="sb-hero-line sb-quote">{line}</div>
              <div className="sb-hero-meta">
                {formatISTCalendarDate(todayStr, { weekday: "long", month: "long", day: "numeric" })} · {cfg.exam} · {cfg.subject_stream}
              </div>
            </div>
            <div className="sb-hero-mascot-wrap">
              <Mascot species={p.mascot} mood={mascotMood} energy={mascotEnergyLevel} size={84} pettable />
            </div>
          </Card>

          <div className="sb-grid-3">
            <ExamTimeTrackerCard profile={p.profile} daysToExam={p.daysToExam} saveProfile={p.saveProfile} />
            <Card paper glass className="sb-dash-stat-card">
              <SectionTitle icon={Clock3}>Today's goal</SectionTitle>
              <div className="sb-dash-stat-body">
                <div className="sb-goal-row">
                  <ProgressRing pct={goalPct} />
                  <div><div className="sb-goal-num">{p.todayHours}h <span>/ {p.profile.daily_goal}h</span></div><div className="sb-muted">{p.todayLoggedHours}h logged · {p.todayTimerHours}h focus timer</div></div>
                </div>
              </div>
            </Card>
            <Card paper glass className="sb-dash-stat-card">
              <div className="sb-section-title">
                <span>
                  <span className={`sb-icon-badge sb-streak-flame sb-flame-tier-${flameTierFor(p.streak).tier}${p.streakActiveToday ? " sb-streak-flame--lit" : ""}`}>
                    <Flame size={16} />
                  </span> Streak
                </span>
                {flameTierFor(p.streak).label && (
                  <span className="sb-chip" style={{ fontSize: 11, cursor: "default", boxShadow: "none" }}>{flameTierFor(p.streak).label}</span>
                )}
              </div>
              <div className="sb-dash-stat-body">
                <div className="sb-countdown" style={{ color: "var(--countdown-ink, var(--outline))" }}>{p.streak}<span>day streak</span></div>
                <div className="sb-muted" style={{ marginTop: 2 }}>
                  {p.streak === 0 ? "Log today or clear your plan to start one" : p.streakActiveToday ? "Today's logged 🔥" : "Study or clear today's plan to keep it lit"}
                </div>
                {p.profile.streak_freeze_tokens > 0 && (
                  <div className="sb-muted" style={{ marginTop: 2, fontSize: 12 }}>
                    ❄️ {p.profile.streak_freeze_tokens} freeze {p.profile.streak_freeze_tokens === 1 ? "token" : "tokens"} — covers a missed day automatically
                  </div>
                )}
              </div>
            </Card>
          </div>

          <DashboardCharts weeklyData={p.weeklyData} subjectPie={p.subjectPie} mascot={p.mascot} />
        </div>

        <div className="sb-pinboard">
          <div className="sb-pinboard-title">pinboard</div>
          <div className="sb-pin-note sb-pin-quote sb-paper" style={{ "--pin-ink": "var(--muted)" }}>"{line}"</div>
          <div
            className="sb-pin-note sb-paper sb-clickable"
            style={{ background: "color-mix(in srgb, var(--p2) 30%, var(--card) 70%)", "--pin-ink": "color-mix(in srgb, var(--p2) 35%, var(--pin-base-ink, var(--outline)) 65%)" }}
            onClick={() => p.setPage("backlog")}
          >
            <div className="sb-pin-label">backlog</div>
            <div className="sb-pin-value">{backlogOpen} open</div>
          </div>
          <div
            className="sb-pin-note sb-paper sb-clickable"
            style={{ background: "color-mix(in srgb, var(--p5) 30%, var(--card) 70%)", "--pin-ink": "color-mix(in srgb, var(--p5) 35%, var(--pin-base-ink, var(--outline)) 65%)" }}
            onClick={() => p.setPage("revision")}
          >
            <div className="sb-pin-label">revisions</div>
            <div className="sb-pin-value">{revisionsDue} due</div>
          </div>
          <div
            className="sb-pin-note sb-paper sb-clickable"
            style={{ background: "color-mix(in srgb, var(--p1) 30%, var(--card) 70%)", "--pin-ink": "color-mix(in srgb, var(--p1) 35%, var(--pin-base-ink, var(--outline)) 65%)" }}
            onClick={() => p.setPage("questions")}
          >
            <div className="sb-pin-label">questions</div>
            <div className="sb-pin-value" style={{ color: p.questionTargetMet ? "var(--status-success, #3E9E5C)" : undefined }}>
              {p.todayQuestions || 0}<span style={{ fontSize: "0.55em", opacity: 0.75 }}> / {p.dailyQuestionTarget || 50}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const DASHBOARD_PROP_KEYS = [
  "profile", "saveProfile", "mascot", "mascotMood", "mascotEnergy",
  "todayHours", "todayLoggedHours", "todayTimerHours", "daysToExam",
  "streak", "streakActiveToday", "weeklyData", "subjectPie",
  "backlogItems", "dueRevisions", "overdueRevisions",
  "todayQuestions", "dailyQuestionTarget", "questionTargetMet", "setPage",
];
function dashboardPropsEqual(prev, next) {
  return DASHBOARD_PROP_KEYS.every((key) => prev[key] === next[key]);
}

export default memo(DashboardInner, dashboardPropsEqual);
