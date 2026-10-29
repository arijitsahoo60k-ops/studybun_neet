import { getActiveSyllabus, normalizeStream } from "../data/syllabus.js";
import { totalOf, biologyMarksOf, botanyMarksOf, zoologyMarksOf, defaultTotalFor, pctOf, unpackMockRow, normalizeExamType } from "./mockScore.js";

const num = (v) => Number(v) || 0;

/**
 * Builds a compact, real-data-only snapshot of the user's progress. Shared by
 * the AI Insights page (deep analysis) and the Smart Study Buddy chat
 * (grounded, in-the-moment guidance).
 */
export function buildStatsSnapshot(p) {
  const stream = normalizeStream(p.profile);
  const activeSyllabus = getActiveSyllabus(stream);
  const bySubject = {};

  Object.keys(activeSyllabus).forEach((s) => {
    const chs = Object.values(activeSyllabus[s].groups).flat();
    const done = chs.filter((c) => ["Completed", "Mastered"].includes(p.getChStatus(`${s}::${c}`).status)).length;
    const pendingWeightage = chs
      .filter((c) => !["Completed", "Mastered"].includes(p.getChStatus(`${s}::${c}`).status))
      .reduce((a, c) => a + num(p.getChStatus(`${s}::${c}`).weightage), 0);
    bySubject[s] = {
      total_chapters: chs.length,
      completed: done,
      backlog: chs.length - done,
      questions_solved: p.questions.filter((q) => q.subject === s).reduce((a, q) => a + Number(q.count || 0), 0),
      pending_weightage_total: pendingWeightage,
    };
  });

  const analysisRows = Object.values(p.mockAnalysisMap || {});
  const mistakeTotals = { silly_mistakes: 0, concept_errors: 0, calculation_errors: 0, time_management_errors: 0, guess_work: 0 };
  const chapterFlagCounts = {};
  analysisRows.forEach((r) => {
    Object.keys(mistakeTotals).forEach((k) => { mistakeTotals[k] += num(r[k]); });
    (r.linked_chapters || []).forEach((c) => { chapterFlagCounts[c] = (chapterFlagCounts[c] || 0) + 1; });
  });
  const flaggedChapters = Object.entries(chapterFlagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([chapter, times_flagged]) => ({ chapter, times_flagged }));

  const unpackedMocks = (p.mocks || []).map(unpackMockRow);
  const bioMinsOf = (m) => num(m.biology_minutes) || (num(m.botany_minutes) + num(m.zoology_minutes));
  const pacingMocks = unpackedMocks.filter((m) => bioMinsOf(m) + num(m.physics_minutes) + num(m.chemistry_minutes) + num(m.math_minutes) > 0);
  let pacing = null;
  if (pacingMocks.length > 0) {
    const mins = { biology: 0, physics: 0, chemistry: 0, math: 0 };
    const marks = { biology: 0, physics: 0, chemistry: 0, math: 0 };
    pacingMocks.forEach((m) => {
      mins.biology += bioMinsOf(m);
      mins.physics += num(m.physics_minutes);
      mins.chemistry += num(m.chemistry_minutes);
      mins.math += num(m.math_minutes);
      marks.biology += biologyMarksOf(m);
      marks.physics += num(m.physics_marks);
      marks.chemistry += num(m.chemistry_marks);
      marks.math += num(m.math_marks);
    });
    const totalMins = mins.biology + mins.physics + mins.chemistry + (stream === "PCMB" ? mins.math : 0);
    const totalMarks = marks.biology + marks.physics + marks.chemistry + (stream === "PCMB" ? marks.math : 0);
    if (totalMins > 0 && totalMarks > 0) {
      const pSubjs = stream === "PCMB" ? ["biology", "physics", "chemistry", "math"] : ["biology", "physics", "chemistry"];
      pacing = pSubjs.map((s) => ({
        subject: s,
        time_share_pct: Math.round((mins[s] / totalMins) * 100),
        score_share_pct: Math.round((marks[s] / totalMarks) * 100),
      }));
    }
  }

  return {
    profile: {
      exam: p.profile.exam || "NEET UG",
      subject_stream: stream,
      days_to_exam: p.daysToExam,
      exam_date: p.profile.exam_date,
      exam_time: p.profile.exam_time || "14:00",
      custom_exams: p.profile.custom_exams || [],
      daily_goal_hours: p.profile.daily_goal,
    },
    study_pattern: {
      today_hours: p.todayHours,
      weekly_hours: (p.weeklyData || []).map((d) => ({ day: d.day, hours: d.hours })),
      current_streak_days: p.streak,
    },
    subjects: bySubject,
    backlog: { total_pending_chapters: p.backlogChapters.length, overall_completion_pct: Math.round(p.overallPct) },
    questions: { total_lifetime: p.totalQuestions, today: p.todayQuestions },
    revisions: { due_today: p.dueRevisions.length, overdue: p.overdueRevisions.length, upcoming: p.upcomingRevisions.length },
    mocks: unpackedMocks.slice(0, 10).map((m) => ({
      name: m.exam_name,
      date: m.mock_date,
      exam_type: normalizeExamType(m.exam_type),
      score: totalOf(m),
      total: num(m.total_marks) || defaultTotalFor(m),
      percentage: pctOf(m),
      biology_marks: biologyMarksOf(m),
      botany_marks: botanyMarksOf(m),
      zoology_marks: zoologyMarksOf(m),
      physics_marks: num(m.physics_marks),
      chemistry_marks: num(m.chemistry_marks),
      math_marks: num(m.math_marks),
      correct: m.correct,
      incorrect: m.incorrect,
    })),
    mistake_patterns: analysisRows.length > 0 ? {
      mocks_reviewed: analysisRows.length,
      totals: mistakeTotals,
      most_flagged_chapters: flaggedChapters,
    } : null,
    pacing,
  };
}
