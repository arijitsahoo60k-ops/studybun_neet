import { describe, it, expect } from "vitest";
import { marksToNeetRank, computeOLSRegression, computeEMA, computeMathematicalMockAnalysis } from "../lib/examBenchmarks";
import { totalOf, NEET_MARKS_FOR } from "../lib/mockScore";
import { examDateTimeToUTCms, computeExamCountdown } from "../lib/examTracker";
import { SYLLABUS, BIOLOGY_CHAPTER_META, getActiveSubjects } from "../data/syllabus";

describe("NEET scoring", () => {
  it("+4/-1", () => expect(NEET_MARKS_FOR(40, 5)).toBe(155));
  it("section scores 169,173,174,177,178,179 are unreachable", () => {
    const ok = new Set();
    for (let c = 0; c <= 45; c++) for (let i = 0; c + i <= 45; i++) ok.add(4 * c - i);
    expect([169, 173, 174, 177, 178, 179].every((s) => !ok.has(s))).toBe(true);
  });
  it("math excluded from NEET UG total", () => {
    expect(totalOf({ exam_type: "NEET UG", botany_marks: 100, zoology_marks: 100, physics_marks: 100, chemistry_marks: 100, math_marks: 150 })).toBe(400);
  });
});
describe("benchmarks", () => {
  it("rank monotone", () => {
    let prev = Infinity;
    for (let x = 0; x <= 720; x++) { const r = marksToNeetRank(x); expect(r).toBeLessThanOrEqual(prev); prev = r; }
  });
  it("OLS + EMA", () => {
    const o = computeOLSRegression([400, 420, 440, 460]);
    expect(o.slope).toBe(20); expect(o.rSquared).toBe(1); expect(o.nextPredicted).toBe(480);
    expect(computeEMA([400, 420, 440])).toBe(423);
  });
  it("no biology double count", () => {
    const a = computeMathematicalMockAnalysis([{ exam_type: "NEET UG", total_marks: 720, botany_marks: 150, zoology_marks: 150, physics_marks: 100, chemistry_marks: 100,
      botany_correct: 40, botany_incorrect: 5, zoology_correct: 40, zoology_incorrect: 5, biology_correct: 80, biology_incorrect: 10,
      physics_correct: 30, physics_incorrect: 10, chemistry_correct: 30, chemistry_incorrect: 10 }]);
    expect(a.latest.correct).toBe(140); expect(a.latest.incorrect).toBe(30);
  });
});
describe("examTracker IST", () => {
  it("14:00 IST = 08:30Z", () => expect(new Date(examDateTimeToUTCms("2027-05-02", "14:00")).toISOString()).toBe("2027-05-02T08:30:00.000Z"));
  it("rejects invalid time", () => expect(examDateTimeToUTCms("2027-05-02", "25:99")).toBeNaN());
  it("countdown", () => {
    const t = examDateTimeToUTCms("2027-05-02", "14:00");
    const c = computeExamCountdown("2027-05-02", "14:00", t - 90061000);
    expect([c.days, c.hours, c.minutes, c.seconds]).toEqual([1, 1, 1, 1]);
  });
});
describe("syllabus", () => {
  it("32 chapters, 17+15, all have meta", () => {
    const { Botany, Zoology } = SYLLABUS.Biology.groups;
    expect([Botany.length, Zoology.length]).toEqual([17, 15]);
    [...Botany, ...Zoology].forEach((n) => expect(BIOLOGY_CHAPTER_META[n]).toBeTruthy());
  });
  it("streams", () => {
    expect(getActiveSubjects("PCB")).not.toContain("Mathematics");
    expect(getActiveSubjects("PCMB")).toContain("Mathematics");
  });
});
