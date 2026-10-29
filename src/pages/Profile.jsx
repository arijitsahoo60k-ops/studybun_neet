import React from "react";
import { Card, SectionTitle } from "../components/ui";
import Mascot from "../components/Mascot";
import StudyCalendar from "../components/StudyCalendar";
import { resolveProfileConfig, computeExamCountdown } from "../lib/examTracker";

export default function ProfilePage(p) {
  const totalStudyHours = Math.floor(p.sessions.reduce((a, s) => a + Number(s.minutes || 0), 0) / 60);
  const cfg = resolveProfileConfig(p.profile);
  const cd = computeExamCountdown(cfg.exam_date, cfg.exam_time);
  const customExams = cfg.custom_exams || [];

  return (
    <div className="sb-page">
      <Card className="sb-hero" washi glass>
        <div className="sb-hero-copy">
          <div className="sb-hero-greet">{p.profile.name || "Friend"}</div>
          <div className="sb-hero-line">
            {cfg.exam} ({cfg.subject_stream}) · Goal {p.profile.daily_goal}h/day
          </div>
          {cd.valid && (
            <div className="sb-hero-meta">
              🎯 {cd.calendarDays}d {cd.hours}h {cd.minutes}m to {cfg.exam} ({cd.formattedDate} · {cd.formattedTime})
            </div>
          )}
          {customExams.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {customExams.map((ce) => {
                const ccd = computeExamCountdown(ce.date, ce.time);
                return (
                  <span
                    key={ce.id}
                    className="sb-tag"
                    style={{ padding: "3px 8px", fontSize: 11, fontWeight: 800, background: "var(--card)" }}
                  >
                    ⏱️ {ce.name}: {ccd.valid ? (ccd.isPast ? "Done" : `${ccd.calendarDays}d ${ccd.hours}h`) : ce.date}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="sb-hero-mascot-wrap">
          <Mascot species={p.mascot} mood="happy" size={80} />
        </div>
      </Card>
      <div className="sb-grid-4">
        <Card><div className="sb-mini-stat"><div className="sb-mini-num">{p.streak}</div><div className="sb-muted">Current streak</div></div></Card>
        <Card><div className="sb-mini-stat"><div className="sb-mini-num">{totalStudyHours}h</div><div className="sb-muted">Total study</div></div></Card>
        <Card><div className="sb-mini-stat"><div className="sb-mini-num">{p.totalQuestions}</div><div className="sb-muted">Questions solved</div></div></Card>
        <Card><div className="sb-mini-stat"><div className="sb-mini-num">{p.unlockedAchievements.length}</div><div className="sb-muted">Badges earned</div></div></Card>
      </div>

      <Card washi>
        <SectionTitle>🐾 My study calendar</SectionTitle>
        <StudyCalendar
          sessions={p.sessions}
          timerSessions={p.timerSessions}
          questions={p.questions}
          mocks={p.mocks}
          tasks={p.tasks}
          revisions={p.revisions}
        />
      </Card>
    </div>
  );
}
