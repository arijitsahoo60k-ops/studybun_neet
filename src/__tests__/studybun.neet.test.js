import { describe, it, expect, beforeEach } from "vitest";
import {
  SYLLABUS,
  BIOLOGY_BRANCHES,
  BIOLOGY_CHAPTER_META,
  getActiveSubjects,
  getActiveChapters,
} from "../data/syllabus";
import {
  NEET_TOTAL_MARKS,
  NEET_MARKS_FOR,
  packMockMeta,
  unpackMockRow,
  botanyMarksOf,
  zoologyMarksOf,
  biologyMarksOf,
  totalOf,
  defaultTotalFor,
  pctOf,
} from "../lib/mockScore";
import {
  marksToNeetRank,
  estimateNeetStanding,
  computeOLSRegression,
  computeMathematicalMockAnalysis,
  buildDeterministicComparisonReport,
} from "../lib/examBenchmarks";
import {
  computeExamCountdown,
  resolveProfileConfig,
  formatExamTimeIST,
} from "../lib/examTracker";

describe("StudyBun NEET — Syllabus & Biology Classification", () => {
  it("has 17 Botany and 15 Zoology chapters (32 total) with complete metadata and high-yield flags", () => {
    expect(SYLLABUS.Biology.groups.Botany).toHaveLength(17);
    expect(SYLLABUS.Biology.groups.Zoology).toHaveLength(15);
    expect(Object.keys(BIOLOGY_CHAPTER_META)).toHaveLength(32);
    expect(BIOLOGY_BRANCHES.Botany.marks).toBe(180);
    expect(BIOLOGY_BRANCHES.Zoology.marks).toBe(180);
    for (const code of ["BOT-05", "BOT-08", "BOT-11", "BOT-12", "ZOO-01", "ZOO-10", "ZOO-14"]) {
      expect(Object.values(BIOLOGY_CHAPTER_META).some((m) => m.batchId === code && m.highYield)).toBe(true);
    }
  });

  it("filters active subjects and chapters for PCB vs PCMB streams", () => {
    expect(getActiveSubjects({ subject_stream: "PCB" })).toEqual(["Biology", "Physics", "Chemistry"]);
    expect(getActiveSubjects({ subject_stream: "PCMB" })).toEqual(["Biology", "Physics", "Chemistry", "Mathematics"]);
    expect(getActiveChapters({ subject_stream: "PCB" }).some((c) => c.subject === "Mathematics")).toBe(false);
    expect(getActiveChapters({ subject_stream: "PCMB" }).some((c) => c.subject === "Mathematics")).toBe(true);
  });
});

describe("StudyBun NEET — Exam Date & Custom Exam Time Tracker (IST)", () => {
  beforeEach(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it("formats IST exam time and computes countdown accurately", () => {
    expect(formatExamTimeIST("14:00")).toBe("2:00 PM IST");
    expect(formatExamTimeIST("09:30")).toBe("9:30 AM IST");
    const cd = computeExamCountdown("2027-05-02", "14:00", new Date("2027-05-01T14:00:00+05:30").getTime());
    expect(cd.valid).toBe(true);
    expect(cd.days).toBe(1);
    expect(cd.hours).toBe(0);
  });

  it("normalizes legacy JEE profiles to NEET UG and preserves custom_exams", () => {
    const cfg = resolveProfileConfig({
      exam: "JEE Main",
      exam_date: "2027-05-02",
      subject_stream: "PCMB",
      custom_exams: [{ id: "ce1", name: "AIATS 1", date: "2026-12-01", time: "14:00" }],
    });
    expect(cfg.exam).toBe("NEET UG");
    expect(cfg.subject_stream).toBe("PCMB");
    expect(cfg.custom_exams).toHaveLength(1);
  });
});

describe("StudyBun NEET — 720-Mark Mock Scoring & Mathematical Comparison Engine", () => {
  it("calculates +4/-1 NEET section marks and never double-counts Biology or adds Maths to NEET UG 720 total", () => {
    expect(NEET_MARKS_FOR(40, 5)).toBe(155);
    const mock = {
      id: "m1",
      exam_name: "NEET Full Mock 1",
      mock_date: "2026-10-01",
      exam_type: "NEET UG",
      total_marks: NEET_TOTAL_MARKS,
      botany_marks: 155,
      zoology_marks: 155,
      biology_marks: 310,
      physics_marks: 110,
      chemistry_marks: 115,
      math_marks: 120, // PCMB extra subject stat — excluded from NEET UG 720 total
      botany_correct: 40, botany_incorrect: 5,
      zoology_correct: 40, zoology_incorrect: 5,
      biology_correct: 80, biology_incorrect: 10, // sum of bot+zoo
      physics_correct: 30, physics_incorrect: 10,
      chemistry_correct: 30, chemistry_incorrect: 5,
      math_correct: 32, math_incorrect: 8,
    };
    expect(botanyMarksOf(mock)).toBe(155);
    expect(zoologyMarksOf(mock)).toBe(155);
    expect(biologyMarksOf(mock)).toBe(310);
    expect(totalOf(mock)).toBe(535);

    const math = computeMathematicalMockAnalysis([mock]);
    expect(math.latest.rawScore).toBe(535);
    expect(math.latest.correct).toBe(140);
    expect(math.latest.incorrect).toBe(25);
    expect(math.accuracyStats.avgCorrect).toBe(140);
    expect(math.accuracyStats.avgIncorrect).toBe(25);
  });

  it("infers sensible default total_marks for Custom / Part mocks and unpacks fallback metadata cleanly", () => {
    const partMock = { exam_type: "Custom Exam", total_marks: 0, botany_marks: 150 };
    expect(defaultTotalFor(partMock)).toBe(180);
    expect(pctOf(partMock)).toBe(83);

    const packed = unpackMockRow({
      id: "m2",
      exam_type: "JEE Main",
      total_marks: 720,
      botany_marks: 0,
      zoology_marks: 0,
      physics_marks: 160,
      chemistry_marks: 165,
      notes: packMockMeta({ real_exam_type: "NEET UG", botany_marks: 170, zoology_marks: 175, biology_marks: 345 }, "Great bio accuracy"),
    });
    expect(packed.exam_type).toBe("NEET UG");
    expect(totalOf(packed)).toBe(670);
    expect(packed.notes).toBe("Great bio accuracy");
  });

  it("computes OLS regression, NTA rank interpolation, and deterministic comparison reports", () => {
    expect(marksToNeetRank(720)).toBe(1);
    expect(estimateNeetStanding(665, 720).percentile).toBeGreaterThan(99);
    const ols = computeOLSRegression([400, 420, 440, 460]);
    expect(ols.slope).toBe(20);
    expect(ols.rSquared).toBe(1);
    expect(ols.nextPredicted).toBe(480);

    const report = buildDeterministicComparisonReport([
      { exam_name: "M1", mock_date: "2026-09-01", exam_type: "NEET UG", total_marks: 720, botany_marks: 160, zoology_marks: 160, physics_marks: 140, chemistry_marks: 150 },
      { exam_name: "M2", mock_date: "2026-09-15", exam_type: "NEET UG", total_marks: 720, botany_marks: 170, zoology_marks: 165, physics_marks: 150, chemistry_marks: 155 },
    ], []);
    expect(report.mode).toBe("progression");
    expect(report.subject_comparison.biology).toContain("/360");
  });
});

describe("StudyBun NEET — Strict Date/Time Validation & Part-Mock Isolation", () => {
  it("rejects out-of-range time strings like 25:99 or invalid calendar dates like 2027-02-31", () => {
    expect(computeExamCountdown("2027-05-02", "25:99").valid).toBe(false);
    expect(computeExamCountdown("2027-05-02", "-1:00").valid).toBe(false);
    expect(computeExamCountdown("2027-02-31", "14:00").valid).toBe(false);
    expect(computeExamCountdown("2027-05-02", "14:00").valid).toBe(true);
  });

  it("isolates NEET UG regression from Custom/Part mocks in buildDeterministicComparisonReport", () => {
    const neetMocks = [
      { exam_name: "NEET 1", mock_date: "2026-09-01", exam_type: "NEET UG", total_marks: 720, botany_marks: 150, zoology_marks: 150, physics_marks: 150, chemistry_marks: 150 },
      { exam_name: "NEET 2", mock_date: "2026-09-10", exam_type: "NEET UG", total_marks: 720, botany_marks: 160, zoology_marks: 160, physics_marks: 160, chemistry_marks: 160 },
    ];
    const partMocks = [
      { exam_name: "Part Bio 1", mock_date: "2026-09-05", exam_type: "Custom Exam", total_marks: 180, botany_marks: 90, zoology_marks: 0, physics_marks: 0, chemistry_marks: 0 },
    ];
    const report = buildDeterministicComparisonReport(neetMocks, partMocks);
    // Primary overallMath must reflect the 2 NEET UG mocks (600 and 640 -> mean 620, slope +40), not the 50% part mock
    expect(report.math_metrics.count).toBe(2);
    expect(report.math_metrics.mean720).toBe(620);
    expect(report.math_metrics.ols720.slope).toBe(40);
  });
});
