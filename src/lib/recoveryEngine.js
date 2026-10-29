// ============================================================
// NEET Recovery Engine
// ============================================================
// Turns Layer A signals (mock mistake tags, linked chapters, revision
// overdue flags, pacing) into Layer B academic problems and Layer C
// concrete actions — deterministically, no AI in the loop.
// ============================================================

import { ALL_CHAPTERS, weightageFor } from "../data/syllabus.js";
import { todayIST, daysBetweenDateStrs } from "./dateIST.js";
import { biologyMarksOf, unpackMockRow, normalizeExamType } from "./mockScore.js";

const num = (v) => Number(v) || 0;

// ---------- Chapter → subject lookup ----------
const CHAPTER_SUBJECT = {};
ALL_CHAPTERS.forEach((c) => {
  const subj = c.subject === "Mathematics" ? "Maths" : c.subject;
  if (!CHAPTER_SUBJECT[c.name]) {
    CHAPTER_SUBJECT[c.name] = subj;
  }
});
// Ensure NEET-first precedence for shared chapter names
CHAPTER_SUBJECT["Biomolecules"] = "Biology";
CHAPTER_SUBJECT["Basic Mathematics"] = "Physics";

export const subjectForChapter = (name) => CHAPTER_SUBJECT[name] || "Other";

// ---------- Mistake type → problem type / action ----------
export const PROBLEM_TYPES = {
  concept_gap: {
    label: "Concept gap",
    action: (n) => `Re-read NCERT line-by-line & core notes, then solve ${Math.min(30, 15 + n * 3)} targeted NEET PYQs.`,
    effortMin: 45,
  },
  calculation_error: {
    label: "Calculation errors",
    action: () => "Redo the questions you got wrong, then run a timed numerical practice set.",
    effortMin: 35,
  },
  silly_mistake: {
    label: "Silly mistakes",
    action: () => "Redo wrong questions and underline 'NOT / Incorrect / Correct' keywords carefully during reading.",
    effortMin: 25,
  },
  time_management: {
    label: "Time pressure",
    action: () => "Run a timed sectional drill (45 Qs in 40 mins for Bio/Chem, 55 mins for Physics) to fix pacing.",
    effortMin: 30,
  },
  guesswork: {
    label: "Guesswork",
    action: () => "Run an accuracy drill — eliminate down to 2 options before attempting to protect against -1 negative bleed.",
    effortMin: 30,
  },
  revision_overdue: {
    label: "Revision overdue",
    action: () => "Complete the pending NCERT & notes revision for this chapter.",
    effortMin: 20,
  },
  pacing: {
    label: "Pacing imbalance",
    action: (n, ctx) => `Your time share in ${ctx?.subject || "this subject"} is well above its score share — practice timed sectional sets.`,
    effortMin: 30,
  },
};

const MISTAKE_KEY_TO_PROBLEM = [
  { key: "concept_errors", type: "concept_gap" },
  { key: "calculation_errors", type: "calculation_error" },
  { key: "time_management_errors", type: "time_management" },
  { key: "guess_work", type: "guesswork" },
  { key: "silly_mistakes", type: "silly_mistake" },
];

const sourceKeyFor = (subject, chapter, problemType) =>
  `${subject}::${chapter}::${problemType}`.toLowerCase().replace(/\s+/g, "_");

// ---------- Recency scoring ----------
function recencyScore(dateStr) {
  if (!dateStr) return 15;
  const daysAgo = daysBetweenDateStrs(todayIST(), dateStr);
  if (daysAgo <= 7) return 100;
  if (daysAgo <= 14) return 70;
  if (daysAgo <= 30) return 40;
  return 15;
}

// ---------- Layer A → Layer B: chapter-level mistake signals ----------
function buildChapterSignals(mocks, mockAnalysisMap) {
  const mockById = {};
  mocks.forEach((m) => { mockById[m.id] = m; });

  const acc = {};
  const touch = (subject, chapter, problemType, mock, weight) => {
    const key = sourceKeyFor(subject, chapter, problemType);
    if (!acc[key]) {
      acc[key] = {
        key, subject, chapter, problemType,
        mockIds: new Set(), weightedCount: 0, lastDate: null, revisionFlagged: false,
      };
    }
    const s = acc[key];
    s.mockIds.add(mock.id);
    s.weightedCount += weight;
    if (!s.lastDate || mock.mock_date > s.lastDate) s.lastDate = mock.mock_date;
  };

  Object.values(mockAnalysisMap || {}).forEach((row) => {
    const mock = mockById[row.mock_id];
    if (!mock) return;
    const chapters = row.linked_chapters || [];
    if (chapters.length === 0) return;

    const counts = MISTAKE_KEY_TO_PROBLEM.map(({ key, type }) => ({ type, n: num(row[key]) })).filter((c) => c.n > 0);

    chapters.forEach((chapterName) => {
      const subject = subjectForChapter(chapterName);
      if (counts.length === 0) {
        if (row.revision_needed) {
          touch(subject, chapterName, "revision_overdue", mock, 1);
          acc[sourceKeyFor(subject, chapterName, "revision_overdue")].revisionFlagged = true;
        }
        return;
      }
      const dominant = counts.reduce((a, b) => (b.n > a.n ? b : a));
      touch(subject, chapterName, dominant.type, mock, dominant.n);
      if (row.revision_needed) acc[sourceKeyFor(subject, chapterName, dominant.type)].revisionFlagged = true;
    });
  });

  return Object.values(acc);
}

// ---------- Layer A → Layer B: standalone revision-overdue signals ----------
function buildRevisionSignals(revisions, alreadyCoveredKeys) {
  const today = todayIST();
  const acc = {};
  (revisions || []).forEach((r) => {
    if (r.status !== "Pending" || r.due_date >= today) return;
    const subject = r.subject === "Mathematics" ? "Maths" : r.subject;
    const key = sourceKeyFor(subject, r.chapter, "revision_overdue");
    if (alreadyCoveredKeys.has(key)) return;
    if (!acc[key]) {
      acc[key] = { key, subject, chapter: r.chapter, problemType: "revision_overdue", mockIds: new Set(), weightedCount: 0, lastDate: r.due_date, revisionFlagged: true, daysOverdue: 0 };
    }
    acc[key].weightedCount += 1;
    acc[key].daysOverdue = Math.max(acc[key].daysOverdue, daysBetweenDateStrs(today, r.due_date));
  });
  return Object.values(acc);
}

// ---------- Layer A → Layer B: pacing signals ----------
function buildPacingSignals(mocks) {
  const unpacked = (mocks || []).map(unpackMockRow);
  const bioMinsOf = (m) => num(m.biology_minutes) || (num(m.botany_minutes) + num(m.zoology_minutes));
  const withTime = unpacked.filter((m) => bioMinsOf(m) + num(m.physics_minutes) + num(m.chemistry_minutes) + num(m.math_minutes) > 0);
  if (withTime.length === 0) return [];

  const totals = { Biology: 0, Physics: 0, Chemistry: 0, Maths: 0 };
  const marks = { Biology: 0, Physics: 0, Chemistry: 0, Maths: 0 };
  withTime.forEach((m) => {
    totals.Biology += bioMinsOf(m);
    totals.Physics += num(m.physics_minutes);
    totals.Chemistry += num(m.chemistry_minutes);
    totals.Maths += num(m.math_minutes);
    marks.Biology += biologyMarksOf(m);
    marks.Physics += num(m.physics_marks);
    marks.Chemistry += num(m.chemistry_marks);
    marks.Maths += num(m.math_marks);
  });
  const totalMins = totals.Biology + totals.Physics + totals.Chemistry + totals.Maths;
  const totalMarks = marks.Biology + marks.Physics + marks.Chemistry + marks.Maths;
  if (totalMins === 0 || totalMarks <= 0) return [];

  const lastDate = withTime.reduce((max, m) => (m.mock_date > max ? m.mock_date : max), withTime[0].mock_date);
  const out = [];
  ["Biology", "Physics", "Chemistry", "Maths"].forEach((subject) => {
    if (totals[subject] === 0 && marks[subject] === 0) return;
    const timeShare = Math.round((totals[subject] / totalMins) * 100);
    const scoreShare = Math.round((marks[subject] / totalMarks) * 100);
    const gap = timeShare - scoreShare;
    if (gap >= 12) {
      out.push({
        key: sourceKeyFor(subject, "Pacing", "pacing"),
        subject, chapter: null, problemType: "pacing",
        mockIds: new Set(withTime.map((m) => m.id)), weightedCount: gap,
        lastDate, revisionFlagged: false, timeShare, scoreShare,
      });
    }
  });
  return out;
}

function scoreSignal(s) {
  const mistakeFrequency = Math.min(1, s.weightedCount / 6) * 100;
  const recency = recencyScore(s.lastDate);
  const chapterRepetition = Math.min(1, s.mockIds.size / 3) * 100;
  const scoreImpact = s.chapter ? weightageFor(s.chapter) * 10 : 50;
  const revisionOverdue = s.revisionFlagged ? 100 : (s.problemType === "revision_overdue" ? 100 : 0);
  const pacingPenalty = s.problemType === "pacing" ? Math.min(100, s.weightedCount * 4) : 0;

  const score =
    mistakeFrequency * 0.30 +
    recency * 0.20 +
    chapterRepetition * 0.20 +
    scoreImpact * 0.15 +
    revisionOverdue * 0.10 +
    pacingPenalty * 0.05;

  return Math.round(Math.min(100, Math.max(0, score)));
}

function passesThreshold(s) {
  if (s.problemType === "pacing") return true;
  if (s.mockIds.size >= 2) return true;
  if (s.problemType === "revision_overdue") return true;
  if (s.weightedCount >= 2) return true;
  return false;
}

function whyText(s) {
  const def = PROBLEM_TYPES[s.problemType];
  const mocks = s.mockIds.size;
  if (s.problemType === "pacing") {
    return `Time share (${s.timeShare}%) is ${s.timeShare - s.scoreShare} points above score share (${s.scoreShare}%) across your logged mocks.`;
  }
  if (s.problemType === "revision_overdue" && s.weightedCount <= 1 && mocks <= 1 && s.daysOverdue) {
    return `This revision is ${s.daysOverdue} day${s.daysOverdue === 1 ? "" : "s"} overdue.`;
  }
  const mockPart = mocks > 1 ? `across ${mocks} reviewed mocks` : "in your last reviewed mock";
  const mistakePart = s.problemType === "revision_overdue"
    ? "flagged for revision"
    : `${s.weightedCount} ${def.label.toLowerCase()}`;
  return `You logged ${mistakePart} ${mockPart}${s.revisionFlagged && s.problemType !== "revision_overdue" ? ", and it's flagged for revision" : ""}.`;
}

export function buildRecoverySignals({ mocks = [], mockAnalysisMap = {}, revisions = [] }) {
  const chapterSignals = buildChapterSignals(mocks, mockAnalysisMap);
  const coveredKeys = new Set(chapterSignals.map((s) => s.key));
  const revisionSignals = buildRevisionSignals(revisions, coveredKeys);
  const pacingSignals = buildPacingSignals(mocks);

  return [...chapterSignals, ...revisionSignals, ...pacingSignals]
    .filter(passesThreshold)
    .map((s) => {
      const def = PROBLEM_TYPES[s.problemType];
      const score = scoreSignal(s);
      return {
        sourceKey: s.key,
        sourceType: s.problemType === "pacing" ? "pacing" : (s.problemType === "revision_overdue" && s.mockIds.size === 0 ? "revision" : "mock_analysis"),
        subject: s.subject,
        chapter: s.chapter,
        problemType: s.problemType,
        problemLabel: def.label,
        evidenceCount: s.mockIds.size || s.weightedCount,
        mockOccurrences: s.mockIds.size,
        mistakeCount: s.problemType === "pacing" ? null : s.weightedCount,
        lastEvidenceAt: s.lastDate,
        priorityScore: score,
        impactTier: score >= 70 ? "high" : score >= 40 ? "medium" : "low",
        recommendedAction: def.action(s.weightedCount, s),
        effortMin: def.effortMin,
        why: whyText(s),
        title: s.chapter ? `${s.chapter} — ${def.label}` : `${s.subject} — ${def.label}`,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

export function mergeWithPersisted(liveSignals, backlogItems) {
  const bySourceKey = {};
  (backlogItems || []).forEach((b) => { if (b.source_key) bySourceKey[b.source_key] = b; });

  const toReopen = [];
  const merged = liveSignals.map((sig) => {
    const row = bySourceKey[sig.sourceKey];
    if (!row) {
      return { ...sig, id: null, status: "Not Started", inSession: false, dismissedUntil: null, recoveryStatus: "Open" };
    }
    const priorEvidence = num(row.evidence_count);
    const newEvidenceArrived = sig.evidenceCount > priorEvidence;
    const shouldReopen = newEvidenceArrived && (row.status === "Completed" || row.status === "Paused");
    if (shouldReopen) toReopen.push({ id: row.id, sig });

    const effectiveStatus = shouldReopen ? "Not Started" : row.status;
    const dismissedUntil = shouldReopen ? null : row.dismissed_until;
    return {
      ...sig,
      id: row.id,
      status: effectiveStatus,
      inSession: !!row.in_session,
      dismissedUntil,
      recoveryStatus: effectiveStatus === "Completed" ? "Recovered" : effectiveStatus === "Paused" ? "Dismissed" : effectiveStatus === "In Progress" ? "In Progress" : "Open",
    };
  });

  return { merged, toReopen };
}

export function buildTodayPlan(queueItems, effortBudgetMin = 120) {
  const open = queueItems.filter((it) => it.recoveryStatus === "Open" && !it.dismissedUntil);
  const high = open.filter((it) => it.impactTier === "high");
  const medium = open.filter((it) => it.impactTier === "medium");
  const maintenance = open.filter((it) => it.problemType === "revision_overdue" || it.impactTier === "low");

  const picks = [];
  const pushUnique = (item) => { if (item && !picks.some((p) => p.sourceKey === item.sourceKey)) picks.push(item); };
  pushUnique(high[0]);
  pushUnique(medium[0]);
  pushUnique(maintenance.find((m) => !picks.some((p) => p.sourceKey === m.sourceKey)));

  for (const item of open) {
    if (picks.length >= 4) break;
    const used = picks.reduce((sum, p) => sum + p.effortMin, 0);
    if (used + item.effortMin > effortBudgetMin) continue;
    pushUnique(item);
  }

  const totalMin = picks.reduce((sum, p) => sum + p.effortMin, 0);
  return { picks: picks.slice(0, 4), totalMin };
}

// ---------- Score leakage (+4/-1 NEET UG scheme) ----------
export function computeScoreLeakage(mocks, queueItems) {
  const unpacked = (mocks || []).map(unpackMockRow);
  const neetMocks = unpacked.filter((m) => {
    const et = normalizeExamType(m.exam_type);
    return et === "NEET UG" || et === "NEET Part Test" || (num(m.botany_incorrect) + num(m.zoology_incorrect) + num(m.biology_incorrect) + num(m.physics_incorrect) + num(m.chemistry_incorrect) + num(m.math_incorrect) > 0);
  });
  const actual = { Biology: 0, Physics: 0, Chemistry: 0, Maths: 0 };
  neetMocks.forEach((m) => {
    actual.Biology += (num(m.botany_incorrect) || num(m.zoology_incorrect)) ? (num(m.botany_incorrect) + num(m.zoology_incorrect)) : num(m.biology_incorrect);
    actual.Physics += num(m.physics_incorrect);
    actual.Chemistry += num(m.chemistry_incorrect);
    actual.Maths += num(m.math_incorrect);
  });
  const hasMainsData = neetMocks.length > 0 && (actual.Biology + actual.Physics + actual.Chemistry + actual.Maths > 0);

  const potential = { Biology: 0, Physics: 0, Chemistry: 0, Maths: 0 };
  queueItems.forEach((it) => {
    if (it.recoveryStatus !== "Open" || !it.subject || !(it.subject in potential)) return;
    potential[it.subject] += Math.round(4 * Math.min(1.5, it.evidenceCount / 2));
  });
  const hasPotentialData = queueItems.some((it) => it.recoveryStatus === "Open");

  return { actual, hasMainsData, potential, hasPotentialData };
}

export function buildChapterMap(queueItems) {
  const bySubject = {};
  queueItems.forEach((it) => {
    if (!it.chapter) return;
    if (it.recoveryStatus === "Dismissed") return;
    const health = it.recoveryStatus === "Recovered" ? 100 : Math.max(5, 100 - it.priorityScore);
    (bySubject[it.subject] = bySubject[it.subject] || {});
    const existing = bySubject[it.subject][it.chapter];
    if (!existing || health < existing.health) {
      bySubject[it.subject][it.chapter] = {
        chapter: it.chapter, health, problemLabel: it.problemLabel, problemType: it.problemType,
        mockOccurrences: it.mockOccurrences, lastEvidenceAt: it.lastEvidenceAt,
        recommendedAction: it.recommendedAction, status: it.recoveryStatus,
      };
    }
  });
  const out = {};
  Object.entries(bySubject).forEach(([subject, chapters]) => {
    out[subject] = Object.values(chapters).sort((a, b) => a.health - b.health);
  });
  return out;
}
