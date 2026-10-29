import React, { useState, useMemo, useRef } from "react";
import {
  ClipboardList, Plus, Sparkles, RefreshCw, AlertTriangle, Scale, Pencil, Trash2, X, Search,
  Clock, Target, Award, Compass, Atom, FlaskConical, Calculator, Dna, Trophy,
  TrendingUp, TrendingDown, Minus, Lightbulb, Info, Sigma,
} from "lucide-react";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Card, SectionTitle, Btn, EmptyState, ProgressRing } from "../components/ui";
import { formatISTCalendarDate, todayIST } from "../lib/dateIST";
import { generateMockComparison } from "../services/groqMockCompare";
import { SYLLABUS, getActiveSubjects, getActiveChapters } from "../data/syllabus";
import {
  NEET_TOTAL_MARKS,
  NEET_SECTION_QUESTIONS,
  NEET_SECTION_MARKS,
  NEET_MARKS_FOR,
  totalOf,
  biologyMarksOf,
  botanyMarksOf,
  zoologyMarksOf,
  defaultTotalFor,
  pctOf,
  unpackMockRow,
  normalizeExamType,
} from "../lib/mockScore";
import {
  estimateNeetStanding,
  computeMathematicalMockAnalysis,
} from "../lib/examBenchmarks";

// ---------- Mistake-tagging (mock review) ----------
const MISTAKE_TYPES = [
  { key: "silly_mistakes", label: "Silly mistakes", hint: "Misread 'NOT/incorrect', bubbling slip, or knew it but slipped under pressure" },
  { key: "concept_errors", label: "Concept / NCERT gaps", hint: "Forgot an NCERT line, diagram, exception, or core principle" },
  { key: "calculation_errors", label: "Calculation errors", hint: "Right formula/method, wrong arithmetic or unit conversion" },
  { key: "time_management_errors", label: "Time pressure", hint: "Rushed, guessed or skipped because the clock ran out" },
  { key: "guess_work", label: "Guesswork (-1 bleed)", hint: "Attempted 50-50 or blind guess without solid elimination" },
];
const emptyAnalysis = () => ({
  silly_mistakes: 0, concept_errors: 0, calculation_errors: 0, time_management_errors: 0, guess_work: 0,
  linked_chapters: [], revision_needed: false,
});

const dayLabel = (d) => formatISTCalendarDate(d, { month: "short", day: "numeric" });
const num = (v) => Number(v) || 0;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// In a 45-question section with +4/-1 marking, certain high scores (179, 178, 177, 174, 173, 169)
// cannot be formed by 4C - W where C + W <= 45 and C, W >= 0.
const IMPOSSIBLE_45Q_SCORES = new Set([179, 178, 177, 174, 173, 169]);
const isPossibleNeetSectionScore = (score) => {
  const s = Math.trunc(num(score));
  if (s < -45 || s > 180) return false;
  return !IMPOSSIBLE_45Q_SCORES.has(s);
};

const emptyForm = () => ({
  exam_name: "",
  mock_date: todayIST(),
  input_mode: "counts", // "counts" (+4/-1 auto) | "marks" (direct marks)
  // NEET UG (+4/-1, 45 scored questions per section = 180 marks each, 720 total)
  botany_correct: 0, botany_incorrect: 0,
  zoology_correct: 0, zoology_incorrect: 0,
  physics_correct: 0, physics_incorrect: 0,
  chemistry_correct: 0, chemistry_incorrect: 0,
  math_correct: 0, math_incorrect: 0,
  // Direct marks inputs
  total_marks: NEET_TOTAL_MARKS,
  botany_marks: 0, zoology_marks: 0, biology_marks: 0,
  physics_marks: 0, chemistry_marks: 0, math_marks: 0,
  attempted: 0, correct: 0, incorrect: 0,
  // Optional per-subject time spent (minutes) — powers the pacing insight
  biology_minutes: "", botany_minutes: "", zoology_minutes: "",
  physics_minutes: "", chemistry_minutes: "", math_minutes: "",
});

const toAIRow = (rawMock) => {
  const m = unpackMockRow(rawMock);
  return {
    exam_name: m.exam_name,
    date: m.mock_date,
    exam_type: normalizeExamType(m.exam_type),
    botany_marks: botanyMarksOf(m),
    zoology_marks: zoologyMarksOf(m),
    biology_marks: biologyMarksOf(m),
    physics_marks: num(m.physics_marks),
    chemistry_marks: num(m.chemistry_marks),
    math_marks: num(m.math_marks),
    botany_correct: num(m.botany_correct),
    botany_incorrect: num(m.botany_incorrect),
    zoology_correct: num(m.zoology_correct),
    zoology_incorrect: num(m.zoology_incorrect),
    physics_correct: num(m.physics_correct),
    physics_incorrect: num(m.physics_incorrect),
    chemistry_correct: num(m.chemistry_correct),
    chemistry_incorrect: num(m.chemistry_incorrect),
    correct: num(m.correct),
    incorrect: num(m.incorrect),
    attempted: num(m.attempted),
    negative_marks: num(m.negative_marks),
    total: totalOf(m),
    total_marks: num(m.total_marks) || defaultTotalFor(m),
    percentage: pctOf(m),
  };
};

export default function MocksPage(p) {
  const activeSubjects = useMemo(() => getActiveSubjects(p.profile), [p.profile]);
  const activeChapters = useMemo(() => getActiveChapters(p.profile), [p.profile]);
  const isPCMB = activeSubjects.includes("Mathematics");

  const [examType, setExamType] = useState("NEET UG");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const aiResult = p.mockAiComparison?.result || null;
  const formRef = useRef(null);
  const [reviewOpenId, setReviewOpenId] = useState(null);
  const [reviewDraft, setReviewDraft] = useState(emptyAnalysis());
  const [reviewInfoOpen, setReviewInfoOpen] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Clamps correct/incorrect counts for a 45-question NEET section so neither
  // exceeds 45 and their sum never exceeds 45.
  const setSectionCount = (section, type, rawValue, maxQuestions = NEET_SECTION_QUESTIONS) => {
    const value = clamp(Math.trunc(num(rawValue)), 0, maxQuestions);
    const otherType = type === "correct" ? "incorrect" : "correct";
    const otherKey = `${section}_${otherType}`;
    setForm((f) => ({
      ...f,
      [`${section}_${type}`]: value,
      [otherKey]: Math.min(num(f[otherKey]), maxQuestions - value),
    }));
  };

  const setDirectMark = (key, rawValue, minVal = -45, maxVal = 180) => {
    const val = clamp(Math.trunc(num(rawValue)), minVal, maxVal);
    setForm((f) => ({ ...f, [key]: val }));
  };

  const toggleReview = (mockId) => {
    setReviewInfoOpen(false);
    if (reviewOpenId === mockId) { setReviewOpenId(null); return; }
    const existing = p.mockAnalysisMap?.[mockId];
    setReviewDraft(existing ? {
      silly_mistakes: existing.silly_mistakes || 0,
      concept_errors: existing.concept_errors || 0,
      calculation_errors: existing.calculation_errors || 0,
      time_management_errors: existing.time_management_errors || 0,
      guess_work: existing.guess_work || 0,
      linked_chapters: existing.linked_chapters || [],
      revision_needed: !!existing.revision_needed,
    } : emptyAnalysis());
    setReviewOpenId(mockId);
  };

  const toggleLinkedChapter = (name) => {
    setReviewDraft((d) => ({
      ...d,
      linked_chapters: d.linked_chapters.includes(name) ? d.linked_chapters.filter((c) => c !== name) : [...d.linked_chapters, name],
    }));
  };

  const saveReview = async (mockId) => {
    await p.saveMockAnalysis(mockId, reviewDraft);
    setReviewOpenId(null);
  };

  // Live preview of marks, counts, accuracy, negative bleed, and NEET rank band
  const useCountsMode = examType === "NEET UG" && form.input_mode !== "marks";

  const preview = useMemo(() => {
    if (useCountsMode) {
      const bot = NEET_MARKS_FOR(form.botany_correct, form.botany_incorrect);
      const zoo = NEET_MARKS_FOR(form.zoology_correct, form.zoology_incorrect);
      const bio = bot + zoo;
      const phy = NEET_MARKS_FOR(form.physics_correct, form.physics_incorrect);
      const chem = NEET_MARKS_FOR(form.chemistry_correct, form.chemistry_incorrect);
      const math = isPCMB ? NEET_MARKS_FOR(form.math_correct, form.math_incorrect) : 0;
      // NEET UG total is strictly out of 720 (Botany 180 + Zoology 180 + Physics 180 + Chemistry 180)
      const total = bio + phy + chem;
      const totalMarks = NEET_TOTAL_MARKS;
      const cTotal = num(form.botany_correct) + num(form.zoology_correct) + num(form.physics_correct) + num(form.chemistry_correct);
      const wTotal = num(form.botany_incorrect) + num(form.zoology_incorrect) + num(form.physics_incorrect) + num(form.chemistry_incorrect);
      const attTotal = cTotal + wTotal;
      const accPct = attTotal > 0 ? Math.round((cTotal / attTotal) * 1000) / 10 : 0;
      const ev = attTotal > 0 ? Math.round(((4 * cTotal - wTotal) / attTotal) * 100) / 100 : 0;
      const standing = estimateNeetStanding(total, totalMarks);
      return {
        bot, zoo, bio, phy, chem, math,
        total, totalMarks,
        cTotal, wTotal, attTotal,
        negMarks: wTotal,
        accPct, ev, standing,
        impossibleSections: [],
      };
    } else {
      const bot = num(form.botany_marks);
      const zoo = num(form.zoology_marks);
      const bio = bot + zoo || num(form.biology_marks);
      const phy = num(form.physics_marks);
      const chem = num(form.chemistry_marks);
      const math = isPCMB || examType === "Custom Exam" ? num(form.math_marks) : 0;
      const total = bio + phy + chem + (examType === "NEET UG" ? 0 : math);
      const totalMarks = examType === "NEET UG"
        ? NEET_TOTAL_MARKS
        : (num(form.total_marks) || defaultTotalFor({ ...form, exam_type: examType, total_marks: 0 }));
      const cTotal = num(form.correct);
      const wTotal = num(form.incorrect);
      const attTotal = num(form.attempted) || (cTotal + wTotal);
      const accPct = cTotal + wTotal > 0 ? Math.round((cTotal / (cTotal + wTotal)) * 1000) / 10 : null;
      const ev = cTotal + wTotal > 0 ? Math.round(((4 * cTotal - wTotal) / (cTotal + wTotal)) * 100) / 100 : null;
      const standing = estimateNeetStanding(total, totalMarks);

      const impossibleSections = [];
      if (examType === "NEET UG") {
        if (!isPossibleNeetSectionScore(bot)) impossibleSections.push(`Botany (${bot})`);
        if (!isPossibleNeetSectionScore(zoo)) impossibleSections.push(`Zoology (${zoo})`);
        if (!isPossibleNeetSectionScore(phy)) impossibleSections.push(`Physics (${phy})`);
        if (!isPossibleNeetSectionScore(chem)) impossibleSections.push(`Chemistry (${chem})`);
      }

      return {
        bot, zoo, bio, phy, chem, math,
        total, totalMarks,
        cTotal, wTotal, attTotal,
        negMarks: wTotal,
        accPct, ev, standing,
        impossibleSections,
      };
    }
  }, [form, examType, useCountsMode, isPCMB]);

  const unpackedMocks = useMemo(() => (p.mocks || []).map(unpackMockRow), [p.mocks]);
  const neetMocks = useMemo(() => unpackedMocks.filter((m) => normalizeExamType(m.exam_type) === "NEET UG"), [unpackedMocks]);
  const customMocks = useMemo(() => unpackedMocks.filter((m) => normalizeExamType(m.exam_type) !== "NEET UG"), [unpackedMocks]);

  // Live deterministic mathematical & statistical analysis (runs on NEET UG mocks when present so part mocks never distort regression/Z-score)
  const liveMath = useMemo(
    () => computeMathematicalMockAnalysis(
      neetMocks.length > 0 ? [...neetMocks].reverse() : [...unpackedMocks].reverse()
    ),
    [neetMocks, unpackedMocks]
  );

  const [trendView, setTrendView] = useState("marks"); // "marks" | "pct"

  const trendData = useMemo(() => {
    const nSorted = [...neetMocks].reverse();
    const cSorted = [...customMocks].reverse();
    const len = Math.max(nSorted.length, cSorted.length);
    return Array.from({ length: len }, (_, i) => ({
      name: `#${i + 1}`,
      "NEET UG": nSorted[i] ? (trendView === "pct" ? pctOf(nSorted[i]) : totalOf(nSorted[i])) : null,
      "Custom / Part": cSorted[i] ? (trendView === "pct" ? pctOf(cSorted[i]) : totalOf(cSorted[i])) : null,
    }));
  }, [neetMocks, customMocks, trendView]);

  const cmpStats = useMemo(() => {
    const statsFor = (arr) => {
      if (!arr.length) return null;
      const pcts = arr.map(pctOf);
      const totals = arr.map(totalOf);
      const best = Math.max(...pcts);
      const bestMarks = Math.max(...totals);
      const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
      const avgMarks = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
      const latest = pcts[0];
      const first = pcts[pcts.length - 1];
      return { count: arr.length, best, bestMarks, avg, avgMarks, delta: arr.length > 1 ? latest - first : 0 };
    };
    return { neet: statsFor(neetMocks), custom: statsFor(customMocks) };
  }, [neetMocks, customMocks]);

  const pacingData = useMemo(() => {
    const bioMinsOf = (m) => num(m.biology_minutes) || (num(m.botany_minutes) + num(m.zoology_minutes));
    const pacingMocks = unpackedMocks.filter((m) => bioMinsOf(m) + num(m.physics_minutes) + num(m.chemistry_minutes) + num(m.math_minutes) > 0);
    if (pacingMocks.length === 0) return null;
    const totals = { Biology: 0, Physics: 0, Chemistry: 0, ...(isPCMB ? { Maths: 0 } : {}) };
    const marks = { Biology: 0, Physics: 0, Chemistry: 0, ...(isPCMB ? { Maths: 0 } : {}) };
    pacingMocks.forEach((m) => {
      totals.Biology += bioMinsOf(m);
      totals.Physics += num(m.physics_minutes);
      totals.Chemistry += num(m.chemistry_minutes);
      if (isPCMB) totals.Maths += num(m.math_minutes);

      marks.Biology += Math.max(0, biologyMarksOf(m));
      marks.Physics += Math.max(0, num(m.physics_marks));
      marks.Chemistry += Math.max(0, num(m.chemistry_marks));
      if (isPCMB) marks.Maths += Math.max(0, num(m.math_marks));
    });
    const totalMins = Object.values(totals).reduce((a, b) => a + b, 0);
    const totalMarks = Object.values(marks).reduce((a, b) => a + b, 0);
    if (totalMins === 0 || totalMarks === 0) return null;
    const rows = Object.keys(totals).map((s) => ({
      name: s,
      "Time share %": Math.round((totals[s] / totalMins) * 100),
      "Score share %": Math.round((marks[s] / totalMarks) * 100),
    }));
    const withGap = rows.map((r) => ({ ...r, gap: r["Time share %"] - r["Score share %"] }));
    const worst = withGap.reduce((a, b) => (Math.abs(b.gap) > Math.abs(a.gap) ? b : a));
    return { rows, worst, mockCount: pacingMocks.length };
  }, [unpackedMocks, isPCMB]);

  const mistakeSummary = useMemo(() => {
    const rows = Object.values(p.mockAnalysisMap || {});
    if (rows.length === 0) return null;
    const totals = { silly_mistakes: 0, concept_errors: 0, calculation_errors: 0, time_management_errors: 0, guess_work: 0 };
    const chapterCounts = {};
    rows.forEach((r) => {
      MISTAKE_TYPES.forEach(({ key }) => { totals[key] += num(r[key]); });
      (r.linked_chapters || []).forEach((c) => { chapterCounts[c] = (chapterCounts[c] || 0) + 1; });
    });
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
    if (grandTotal === 0) return { reviewedCount: rows.length, grandTotal: 0, breakdown: [], topChapters: [] };
    const breakdown = MISTAKE_TYPES.map(({ key, label }) => ({ label, count: totals[key], pct: Math.round((totals[key] / grandTotal) * 100) }))
      .filter((b) => b.count > 0)
      .sort((a, b) => b.count - a.count);
    const topChapters = Object.entries(chapterCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { reviewedCount: rows.length, grandTotal, breakdown, topChapters };
  }, [p.mockAnalysisMap]);

  const sanitizeSectionPair = (correctRaw, incorrectRaw, maxQ = NEET_SECTION_QUESTIONS) => {
    const correct = clamp(Math.trunc(num(correctRaw)), 0, maxQ);
    const incorrect = clamp(Math.trunc(num(incorrectRaw)), 0, maxQ - correct);
    return [correct, incorrect];
  };

  const startEdit = (rawMock) => {
    const m = unpackMockRow(rawMock);
    const et = normalizeExamType(m.exam_type);
    setEditingId(m.id);
    setExamType(et);
    const [botany_correct, botany_incorrect] = sanitizeSectionPair(m.botany_correct, m.botany_incorrect);
    const [zoology_correct, zoology_incorrect] = sanitizeSectionPair(m.zoology_correct, m.zoology_incorrect);
    const [physics_correct, physics_incorrect] = sanitizeSectionPair(m.physics_correct, m.physics_incorrect);
    const [chemistry_correct, chemistry_incorrect] = sanitizeSectionPair(m.chemistry_correct, m.chemistry_incorrect);
    const [math_correct, math_incorrect] = sanitizeSectionPair(m.math_correct, m.math_incorrect);
    const hasCounts = (botany_correct + botany_incorrect + zoology_correct + zoology_incorrect + physics_correct + physics_incorrect + chemistry_correct + chemistry_incorrect) > 0;

    setForm({
      exam_name: m.exam_name || "",
      mock_date: m.mock_date || todayIST(),
      input_mode: m.input_mode || (et === "NEET UG" && hasCounts ? "counts" : et === "NEET UG" ? "marks" : "marks"),
      botany_correct, botany_incorrect,
      zoology_correct, zoology_incorrect,
      physics_correct, physics_incorrect,
      chemistry_correct, chemistry_incorrect,
      math_correct, math_incorrect,
      total_marks: num(m.total_marks) || defaultTotalFor(m),
      botany_marks: botanyMarksOf(m),
      zoology_marks: zoologyMarksOf(m),
      biology_marks: biologyMarksOf(m),
      physics_marks: num(m.physics_marks),
      chemistry_marks: num(m.chemistry_marks),
      math_marks: num(m.math_marks),
      attempted: num(m.attempted),
      correct: num(m.correct),
      incorrect: num(m.incorrect),
      biology_minutes: m.biology_minutes ?? "",
      botany_minutes: m.botany_minutes ?? "",
      zoology_minutes: m.zoology_minutes ?? "",
      physics_minutes: m.physics_minutes ?? "",
      chemistry_minutes: m.chemistry_minutes ?? "",
      math_minutes: m.math_minutes ?? "",
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setExamType("NEET UG");
    setForm(emptyForm());
  };

  const handleSave = () => {
    if (!form.exam_name.trim()) return;
    let payload;
    const bioMins = form.biology_minutes !== ""
      ? num(form.biology_minutes)
      : (form.botany_minutes !== "" || form.zoology_minutes !== "" ? num(form.botany_minutes) + num(form.zoology_minutes) : null);

    if (useCountsMode) {
      payload = {
        exam_name: form.exam_name.trim(),
        mock_date: form.mock_date || todayIST(),
        exam_type: "NEET UG",
        input_mode: "counts",
        total_marks: NEET_TOTAL_MARKS,
        botany_marks: preview.bot,
        zoology_marks: preview.zoo,
        biology_marks: preview.bio,
        physics_marks: preview.phy,
        chemistry_marks: preview.chem,
        math_marks: preview.math,
        botany_correct: num(form.botany_correct), botany_incorrect: num(form.botany_incorrect),
        zoology_correct: num(form.zoology_correct), zoology_incorrect: num(form.zoology_incorrect),
        biology_correct: num(form.botany_correct) + num(form.zoology_correct),
        biology_incorrect: num(form.botany_incorrect) + num(form.zoology_incorrect),
        physics_correct: num(form.physics_correct), physics_incorrect: num(form.physics_incorrect),
        chemistry_correct: num(form.chemistry_correct), chemistry_incorrect: num(form.chemistry_incorrect),
        math_correct: isPCMB ? num(form.math_correct) : 0,
        math_incorrect: isPCMB ? num(form.math_incorrect) : 0,
        attempted: preview.attTotal,
        correct: preview.cTotal,
        incorrect: preview.wTotal,
        negative_marks: preview.negMarks,
        biology_minutes: bioMins,
        physics_minutes: form.physics_minutes === "" ? null : num(form.physics_minutes),
        chemistry_minutes: form.chemistry_minutes === "" ? null : num(form.chemistry_minutes),
        math_minutes: form.math_minutes === "" ? null : num(form.math_minutes),
      };
    } else {
      const bot = num(form.botany_marks);
      const zoo = num(form.zoology_marks);
      const bio = (bot !== 0 || zoo !== 0) ? (bot + zoo) : num(form.biology_marks);
      payload = {
        exam_name: form.exam_name.trim(),
        mock_date: form.mock_date || todayIST(),
        exam_type: examType,
        input_mode: "marks",
        total_marks: examType === "NEET UG" ? NEET_TOTAL_MARKS : (num(form.total_marks) || defaultTotalFor({ ...form, exam_type: examType, total_marks: 0 })),
        botany_marks: bot,
        zoology_marks: zoo,
        biology_marks: bio,
        physics_marks: num(form.physics_marks),
        chemistry_marks: num(form.chemistry_marks),
        math_marks: (isPCMB || examType === "Custom Exam") ? num(form.math_marks) : 0,
        attempted: preview.attTotal,
        correct: preview.cTotal,
        incorrect: preview.wTotal,
        negative_marks: preview.wTotal,
        biology_minutes: bioMins,
        physics_minutes: form.physics_minutes === "" ? null : num(form.physics_minutes),
        chemistry_minutes: form.chemistry_minutes === "" ? null : num(form.chemistry_minutes),
        math_minutes: form.math_minutes === "" ? null : num(form.math_minutes),
      };
    }

    if (editingId) {
      p.updateMock(editingId, payload);
      cancelEdit();
    } else {
      p.addMock(payload);
      setForm({ ...emptyForm(), total_marks: form.total_marks, input_mode: form.input_mode });
    }
  };

  const runAIComparison = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const out = await generateMockComparison(
        [...neetMocks].reverse().map(toAIRow),
        [...customMocks].reverse().map(toAIRow)
      );
      await p.saveMockAiComparison(out);
    } catch (e) {
      setAiError(e.message || "Something went wrong generating the comparison.");
    } finally {
      setAiLoading(false);
    }
  };

  const latestMock = unpackedMocks[0] || null;
  const latestPct = latestMock ? pctOf(latestMock) : null;
  const bestPct = unpackedMocks.length ? Math.max(...unpackedMocks.map(pctOf)) : null;

  return (
    <div className="sb-page">
      <div className="sb-mocks-layout">
        {/* ---------- Left: add/edit form + mock pulse (sticky on desktop) ---------- */}
        <div className="sb-mocks-left">
          <div ref={formRef}>
            <Card washi style={editingId ? { borderColor: "var(--accent)", boxShadow: "0 0 0 3px var(--soft)" } : undefined}>
              <SectionTitle
                icon={ClipboardList}
                right={editingId && <button className="sb-icon-btn" title="Cancel edit" onClick={cancelEdit}><X size={16} /></button>}
              >
                {editingId ? "Edit mock test" : "Add mock test"}
              </SectionTitle>

              <div className="sb-chip-row" style={{ marginBottom: 12 }}>
                {["NEET UG", "Custom Exam"].map((e) => (
                  <button
                    key={e}
                    type="button"
                    className={`sb-chip ${examType === e ? "active" : ""}`}
                    onClick={() => setExamType(e)}
                  >
                    {e === "NEET UG" ? "🩺 NEET UG (720)" : "⏱️ Custom / Part Test"}
                  </button>
                ))}
              </div>

              {examType === "NEET UG" && (
                <div className="sb-chip-row" style={{ marginBottom: 12 }}>
                  <button
                    type="button"
                    className={`sb-chip small ${form.input_mode !== "marks" ? "active" : ""}`}
                    onClick={() => set("input_mode", "counts")}
                  >
                    ✨ Auto (+4 / -1 from Counts)
                  </button>
                  <button
                    type="button"
                    className={`sb-chip small ${form.input_mode === "marks" ? "active" : ""}`}
                    onClick={() => set("input_mode", "marks")}
                  >
                    ✏️ Direct Marks Entry
                  </button>
                </div>
              )}

              <div className="sb-form-grid">
                <div>
                  <label>Mock / Test name</label>
                  <input className="sb-input" value={form.exam_name} onChange={(ev) => set("exam_name", ev.target.value)} placeholder="e.g. NEET Full Syllabus Mock 4 / AIATS" />
                </div>
                <div>
                  <label>Test date</label>
                  <input type="date" className="sb-input" value={form.mock_date} onChange={(ev) => set("mock_date", ev.target.value)} max={todayIST()} />
                </div>
                {examType === "Custom Exam" && (
                  <div>
                    <label>Total max marks</label>
                    <input type="number" min={10} max={1440} className="sb-input" value={form.total_marks} onChange={(ev) => set("total_marks", +ev.target.value)} />
                  </div>
                )}
              </div>

              {useCountsMode ? (
                <>
                  <p className="sb-muted" style={{ fontSize: 12, marginTop: -4, marginBottom: 10 }}>
                    NEET UG NTA pattern — {NEET_SECTION_QUESTIONS} scored questions per section (+4 correct, -1 incorrect, {NEET_SECTION_MARKS} marks each · 360 Biology + 180 Physics + 180 Chemistry = 720 total).
                  </p>
                  {[
                    ["botany", "🌱 Botany (Sec A+B)"],
                    ["zoology", "🧬 Zoology (Sec A+B)"],
                    ["physics", "⚛️ Physics"],
                    ["chemistry", "🧪 Chemistry"],
                    ...(isPCMB ? [["math", "📐 Mathematics (PCMB)"]] : []),
                  ].map(([k, label]) => {
                    const secKey = k === "botany" ? "bot" : k === "zoology" ? "zoo" : k === "physics" ? "phy" : k === "chemistry" ? "chem" : "math";
                    const cVal = num(form[`${k}_correct`]);
                    const wVal = num(form[`${k}_incorrect`]);
                    const unatt = NEET_SECTION_QUESTIONS - cVal - wVal;
                    return (
                      <div key={k} style={{ marginBottom: 10 }}>
                        <div className="sb-form-grid dense">
                          <div>
                            <label>{label} — Correct</label>
                            <input
                              type="number"
                              min={0}
                              max={NEET_SECTION_QUESTIONS - wVal}
                              className="sb-input"
                              value={form[`${k}_correct`]}
                              onChange={(ev) => setSectionCount(k, "correct", ev.target.value)}
                            />
                          </div>
                          <div>
                            <label>Incorrect (-1)</label>
                            <input
                              type="number"
                              min={0}
                              max={NEET_SECTION_QUESTIONS - cVal}
                              className="sb-input"
                              value={form[`${k}_incorrect`]}
                              onChange={(ev) => setSectionCount(k, "incorrect", ev.target.value)}
                            />
                          </div>
                          <div>
                            <label>Score ({unatt} left)</label>
                            <div className="sb-input" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 800, background: "var(--bg)" }}>
                              <span>{preview[secKey]} / {NEET_SECTION_MARKS}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <>
                  <p className="sb-muted" style={{ fontSize: 12, marginTop: -4, marginBottom: 10 }}>
                    Enter marks per section directly (Botany + Zoology auto-sum to total Biology marks).
                  </p>
                  <div className="sb-form-grid dense" style={{ marginBottom: 10 }}>
                    <div>
                      <label>🌱 Botany (/180)</label>
                      <input type="number" min={-45} max={examType === "NEET UG" ? 180 : 360} className="sb-input" value={form.botany_marks} onChange={(ev) => setDirectMark("botany_marks", ev.target.value, -45, examType === "NEET UG" ? 180 : 500)} />
                    </div>
                    <div>
                      <label>🧬 Zoology (/180)</label>
                      <input type="number" min={-45} max={examType === "NEET UG" ? 180 : 360} className="sb-input" value={form.zoology_marks} onChange={(ev) => setDirectMark("zoology_marks", ev.target.value, -45, examType === "NEET UG" ? 180 : 500)} />
                    </div>
                    <div>
                      <label>⚛️ Physics (/180)</label>
                      <input type="number" min={-45} max={examType === "NEET UG" ? 180 : 360} className="sb-input" value={form.physics_marks} onChange={(ev) => setDirectMark("physics_marks", ev.target.value, -45, examType === "NEET UG" ? 180 : 500)} />
                    </div>
                    <div>
                      <label>🧪 Chemistry (/180)</label>
                      <input type="number" min={-45} max={examType === "NEET UG" ? 180 : 360} className="sb-input" value={form.chemistry_marks} onChange={(ev) => setDirectMark("chemistry_marks", ev.target.value, -45, examType === "NEET UG" ? 180 : 500)} />
                    </div>
                    {(isPCMB || examType === "Custom Exam") && (
                      <div>
                        <label>📐 Maths</label>
                        <input type="number" min={-45} max={360} className="sb-input" value={form.math_marks} onChange={(ev) => setDirectMark("math_marks", ev.target.value, -45, 500)} />
                      </div>
                    )}
                  </div>

                  {preview.impossibleSections.length > 0 && (
                    <div className="sb-muted small" style={{ color: "#C0435A", marginBottom: 8, fontWeight: 700 }}>
                      ⚠️ Note: {preview.impossibleSections.join(", ")} cannot occur in a standard 45-question (+4/-1) section (scores like 179, 178, 177, 174, 173 are mathematically impossible).
                    </div>
                  )}

                  <div className="sb-form-grid dense" style={{ marginBottom: 10 }}>
                    <div>
                      <label>Total Correct (optional)</label>
                      <input
                        type="number"
                        min={0}
                        max={200}
                        className="sb-input"
                        value={form.correct}
                        onChange={(ev) => {
                          const c = Math.max(0, +ev.target.value || 0);
                          setForm((f) => ({ ...f, correct: c, attempted: c + num(f.incorrect) }));
                        }}
                      />
                    </div>
                    <div>
                      <label>Total Incorrect (optional)</label>
                      <input
                        type="number"
                        min={0}
                        max={200}
                        className="sb-input"
                        value={form.incorrect}
                        onChange={(ev) => {
                          const w = Math.max(0, +ev.target.value || 0);
                          setForm((f) => ({ ...f, incorrect: w, attempted: num(f.correct) + w }));
                        }}
                      />
                    </div>
                    <div>
                      <label>Attempted</label>
                      <input type="number" min={0} max={200} className="sb-input" value={preview.attTotal} onChange={(ev) => set("attempted", +ev.target.value)} />
                    </div>
                  </div>
                </>
              )}

              {/* Live Mathematical Score & Standing Preview Box */}
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "var(--soft)",
                  border: "1.5px solid var(--mascot-outline)",
                  marginBottom: 12,
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800, marginBottom: 4 }}>
                  <span>Total: {preview.total} / {preview.totalMarks} ({Math.round((preview.total / (preview.totalMarks || 720)) * 1000) / 10}%)</span>
                  <span style={{ color: "var(--accent)" }}>Biology: {preview.bio} / 360 (Bot {preview.bot} + Zoo {preview.zoo})</span>
                </div>
                <div className="sb-muted" style={{ fontSize: 11, display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
                  <span>Est. Standing: <b>{preview.standing.rankBand}</b> (~{preview.standing.percentile}%ile)</span>
                  {preview.accPct !== null && <span>Accuracy: <b>{preview.accPct}%</b></span>}
                  {preview.negMarks > 0 && <span style={{ color: "#C0435A" }}>Negative bleed: <b>-{preview.negMarks}m</b></span>}
                  {preview.ev !== null && <span>EV/Attempt: <b>{preview.ev >= 0 ? `+${preview.ev}` : preview.ev}m</b></span>}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="sb-muted small" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Clock size={13} /> Time spent per subject (minutes, optional — unlocks pacing elasticity check)
                </label>
                <div className="sb-form-grid dense" style={{ marginTop: 6 }}>
                  {[
                    ["biology_minutes", "Biology"],
                    ["physics_minutes", "Physics"],
                    ["chemistry_minutes", "Chemistry"],
                    ...(isPCMB ? [["math_minutes", "Maths"]] : []),
                  ].map(([k, label]) => (
                    <div key={k}>
                      <label>{label} mins</label>
                      <input
                        type="number"
                        min={0}
                        max={200}
                        className="sb-input"
                        value={form[k]}
                        onChange={(ev) => set(k, ev.target.value === "" ? "" : +ev.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <Btn onClick={handleSave} disabled={!form.exam_name.trim()}>
                  {editingId ? <><Pencil size={16} /> Update mock</> : <><Plus size={16} /> Save mock</>}
                </Btn>
                {editingId && <Btn variant="soft" onClick={cancelEdit}>Cancel</Btn>}
              </div>
            </Card>
          </div>

          <Card className="sb-card-tinted">
            <SectionTitle icon={Award}>Mock pulse</SectionTitle>
            {unpackedMocks.length > 0 ? (
              <div className="sb-backlog-pulse">
                <div className="sb-backlog-ring-wrap">
                  <ProgressRing pct={latestPct} size={80} stroke={9} color={latestPct < 50 ? "#C0435A" : undefined} paw={false} />
                  <div className="sb-backlog-ring-label">Latest score</div>
                </div>
                <div className="sb-backlog-pulse-nums">
                  <div className="sb-backlog-stat"><span className="sb-backlog-stat-label">Best score</span><span className="sb-backlog-stat-num">{bestPct}%</span></div>
                  <div className="sb-backlog-stat"><span className="sb-backlog-stat-label">Total mocks</span><span className="sb-backlog-stat-num">{unpackedMocks.length}</span></div>
                  <div className="sb-backlog-stat"><span className="sb-backlog-stat-label">NEET · Custom</span><span className="sb-backlog-stat-num">{neetMocks.length} · {customMocks.length}</span></div>
                </div>
              </div>
            ) : (
              <div className="sb-hero-meta">Log your first NEET mock to see your pulse here.</div>
            )}
          </Card>
        </div>

        {/* ---------- Right: history, mathematical comparison, trend, AI insight, mistakes ---------- */}
        <div className="sb-mocks-right">
          <Card>
            <SectionTitle icon={ClipboardList}>History</SectionTitle>
            {unpackedMocks.length === 0 ? (
              <EmptyState mascot={p.mascot} mood="idle" text="Nothing here yet." sub="Log your first NEET UG or coaching mock on the left." />
            ) : unpackedMocks.map((m) => {
              const analysis = p.mockAnalysisMap?.[m.id];
              const isReviewOpen = reviewOpenId === m.id;
              const bioM = biologyMarksOf(m);
              const botM = botanyMarksOf(m);
              const zooM = zoologyMarksOf(m);
              const phyM = num(m.physics_marks);
              const chemM = num(m.chemistry_marks);
              const mathM = num(m.math_marks);
              const totM = totalOf(m);
              const maxM = num(m.total_marks) || defaultTotalFor(m);
              const st = estimateNeetStanding(totM, maxM);

              return (
                <div key={m.id} className="sb-mock-block" style={{ marginBottom: 10 }}>
                  <div className="sb-mock-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                        <b>{m.exam_name}</b>
                        <span className="sb-chip small" style={{ boxShadow: "none", cursor: "default" }}>{normalizeExamType(m.exam_type)}</span>
                        <span className="sb-chip small" style={{ boxShadow: "none", cursor: "default", color: "var(--accent)" }}>
                          {st.rankBand} (~{st.percentile}%ile)
                        </span>
                        {analysis && <span className="sb-chip small" style={{ boxShadow: "none", cursor: "default" }} title="Mistakes reviewed">🔍 reviewed</span>}
                      </div>
                      <div className="sb-muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                        {dayLabel(m.mock_date)} · Bio <b>{bioM}</b>{(botM || zooM) ? ` (Bot ${botM} · Zoo ${zooM})` : ""} · Phy <b>{phyM}</b> · Chem <b>{chemM}</b>{mathM ? <> · Math <b>{mathM}</b></> : ""}
                        {num(m.negative_marks) > 0 && <span style={{ color: "#C0435A" }}> · -{num(m.negative_marks)} neg</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="sb-mock-score">{totM}<span>/{maxM}</span></div>
                      <button className="sb-icon-btn" title={isReviewOpen ? "Close review" : "Review mistakes"} onClick={() => toggleReview(m.id)}><Search size={15} /></button>
                      <button className="sb-icon-btn" title="Edit" onClick={() => startEdit(m)}><Pencil size={15} /></button>
                      <button className="sb-icon-btn danger" title="Delete" onClick={() => p.deleteMock(m.id)}><Trash2 size={15} /></button>
                    </div>
                  </div>

                  {isReviewOpen && (
                    <div className="sb-chapter-detail" style={{ marginTop: 8 }}>
                      <div className="sb-review-info-row">
                        <div className="sb-muted small">
                          Tag why you lost marks on this mock — this feeds AI Insights and Backlog recovery priority with real error data.
                        </div>
                        <button
                          type="button"
                          className="sb-icon-btn"
                          title={reviewInfoOpen ? "Hide explanation" : "What does each category mean?"}
                          onClick={() => setReviewInfoOpen((v) => !v)}
                        >
                          <Info size={14} />
                        </button>
                      </div>

                      {reviewInfoOpen && (
                        <div className="sb-review-info-box">
                          {MISTAKE_TYPES.map(({ key, label, hint }) => (
                            <div key={key} className="sb-review-info-line"><b>{label}</b> — {hint}</div>
                          ))}
                          <div className="sb-review-info-line" style={{ marginTop: 6 }}>
                            <b>Link to chapters</b> — which chapters these mistakes came from, grouped by subject below.
                          </div>
                        </div>
                      )}

                      <div className="sb-form-grid dense">
                        {MISTAKE_TYPES.map(({ key, label }) => (
                          <div key={key}>
                            <label>{label}</label>
                            <input
                              type="number"
                              min={0}
                              className="sb-input small"
                              value={reviewDraft[key]}
                              onChange={(e) => setReviewDraft((d) => ({ ...d, [key]: +e.target.value }))}
                            />
                          </div>
                        ))}
                      </div>

                      <label className="sb-muted small" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
                        <input type="checkbox" checked={reviewDraft.revision_needed} onChange={(e) => setReviewDraft((d) => ({ ...d, revision_needed: e.target.checked }))} />
                        Flag for urgent NCERT revision
                      </label>

                      <div className="sb-muted small" style={{ marginTop: 10, marginBottom: 6 }}>Link to chapters (optional)</div>
                      {activeSubjects.map((subj) => {
                        const chs = activeChapters.filter((c) => c.subject === subj);
                        return (
                          <div key={subj} className="sb-review-chapter-group">
                            <div className="sb-review-chapter-group-label" style={{ color: SYLLABUS[subj]?.deepColor || SYLLABUS[subj]?.color }}>{subj}</div>
                            <div className="sb-chip-row">
                              {chs.map((c) => (
                                <button
                                  key={c.key}
                                  type="button"
                                  className={`sb-chip small ${reviewDraft.linked_chapters.includes(c.name) ? "active" : ""}`}
                                  onClick={() => toggleLinkedChapter(c.name)}
                                >
                                  {c.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                        <Btn onClick={() => saveReview(m.id)}>Save mistake breakdown</Btn>
                        <Btn variant="soft" onClick={() => setReviewOpenId(null)}>Cancel</Btn>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>

          <Card className="sb-cmp-card">
            <SectionTitle
              icon={Scale}
              right={
                <div className="sb-cmp-toggle">
                  <button type="button" className={trendView === "marks" ? "active" : ""} onClick={() => setTrendView("marks")}>Marks</button>
                  <button type="button" className={trendView === "pct" ? "active" : ""} onClick={() => setTrendView("pct")}>%</button>
                </div>
              }
            >
              NEET UG & Custom Mock Progression
            </SectionTitle>

            {(cmpStats.neet || cmpStats.custom) && (
              <div className="sb-cmp-stats">
                <div className="sb-cmp-stat-pill main">
                  <span className="sb-cmp-dot" />
                  <div className="sb-cmp-stat-body">
                    <div className="sb-cmp-stat-label">NEET UG (720) <span className="sb-muted">· {cmpStats.neet?.count || 0} mocks</span></div>
                    {cmpStats.neet ? (
                      <div className="sb-cmp-stat-nums">
                        <span><b>{cmpStats.neet.avgMarks}/720</b> ({cmpStats.neet.avg}%) avg</span>
                        <span><b>{cmpStats.neet.bestMarks}/720</b> best</span>
                        {cmpStats.neet.delta !== 0 && (
                          <span className={cmpStats.neet.delta > 0 ? "up" : "down"}>
                            {cmpStats.neet.delta > 0 ? "▲" : "▼"} {Math.abs(cmpStats.neet.delta)}%
                          </span>
                        )}
                      </div>
                    ) : <div className="sb-cmp-stat-nums sb-muted">No NEET UG mocks yet</div>}
                  </div>
                </div>
                <div className="sb-cmp-stat-pill advanced">
                  <span className="sb-cmp-dot" />
                  <div className="sb-cmp-stat-body">
                    <div className="sb-cmp-stat-label">Custom / Part <span className="sb-muted">· {cmpStats.custom?.count || 0} mocks</span></div>
                    {cmpStats.custom ? (
                      <div className="sb-cmp-stat-nums">
                        <span><b>{cmpStats.custom.avg}%</b> avg</span>
                        <span><b>{cmpStats.custom.best}%</b> best</span>
                        {cmpStats.custom.delta !== 0 && (
                          <span className={cmpStats.custom.delta > 0 ? "up" : "down"}>
                            {cmpStats.custom.delta > 0 ? "▲" : "▼"} {Math.abs(cmpStats.custom.delta)}%
                          </span>
                        )}
                      </div>
                    ) : <div className="sb-cmp-stat-nums sb-muted">No custom mocks yet</div>}
                  </div>
                </div>
              </div>
            )}

            {trendData.length ? (
              <>
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={trendData} margin={{ top: 6, right: 14, left: 4, bottom: 4 }}>
                    <defs>
                      <linearGradient id="sbMainGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--soft)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--muted)" fontSize={11.5} tickLine={false} axisLine={false} padding={{ left: 12, right: 12 }} />
                    <YAxis stroke="var(--muted)" fontSize={11.5} tickLine={false} axisLine={false} unit={trendView === "pct" ? "%" : ""} width={44} />
                    <Tooltip
                      contentStyle={{ borderRadius: 14, border: "1.5px solid var(--mascot-outline)", background: "var(--card-bg, #fff)", fontSize: 12.5, boxShadow: "3px 3px 0 var(--mascot-outline)" }}
                      labelStyle={{ fontWeight: 800, marginBottom: 4 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                    <Line type="monotone" dataKey="NEET UG" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "var(--bg)" }} activeDot={{ r: 6 }} connectNulls fill="url(#sbMainGrad)" />
                    <Line type="monotone" dataKey="Custom / Part" stroke="var(--p3, #8b5cf6)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "var(--bg)" }} activeDot={{ r: 6 }} connectNulls strokeDasharray={customMocks.length ? undefined : "4 4"} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="sb-muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                  {trendView === "pct"
                    ? `Shown as % of each mock's total marks so NEET UG (out of ${NEET_TOTAL_MARKS}) and Custom/Part mocks sit on one unified scale.`
                    : `Shown as raw marks — NEET UG tops out at ${NEET_TOTAL_MARKS} (360 Biology + 180 Physics + 180 Chemistry).`}
                </p>
              </>
            ) : <EmptyState mascot={p.mascot} mood="idle" text="No mocks logged yet." sub="Add your first mock to start tracking trends." />}
          </Card>

          {/* ---------- Live Mathematical & Statistical Engine Card ---------- */}
          {liveMath && (
            <Card>
              <SectionTitle icon={Sigma}>Mathematical & Statistical Diagnostics</SectionTitle>
              <p className="sb-muted" style={{ fontSize: 12, marginTop: -4, marginBottom: 12 }}>
                Live quantitative diagnostics computed across your {liveMath.count} logged mock{liveMath.count === 1 ? "" : "s"} (normalized to the 720-mark NEET UG scale).
              </p>

              <div className="sb-grid-4" style={{ marginBottom: 12 }}>
                <div className="sb-backlog-stat" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                  <span className="sb-backlog-stat-label">Mean · Median</span>
                  <span className="sb-backlog-stat-num">{liveMath.mean720} <span className="sb-muted" style={{ fontSize: 11 }}>/ {liveMath.median720}</span></span>
                  <span className="sb-muted" style={{ fontSize: 10.5 }}>{liveMath.avgStanding.rankBand}</span>
                </div>
                <div className="sb-backlog-stat" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                  <span className="sb-backlog-stat-label">OLS Trajectory (β₁)</span>
                  <span className="sb-backlog-stat-num" style={{ color: liveMath.ols720.slope >= 0 ? "#2E9955" : "#C0435A" }}>
                    {liveMath.ols720.slope >= 0 ? `+${liveMath.ols720.slope}` : liveMath.ols720.slope}m/mock
                  </span>
                  <span className="sb-muted" style={{ fontSize: 10.5 }}>R² = {liveMath.ols720.rSquared} · Next ≈ {Math.min(720, Math.max(0, liveMath.ols720.nextPredicted))}</span>
                </div>
                <div className="sb-backlog-stat" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                  <span className="sb-backlog-stat-label">Consistency Index</span>
                  <span className="sb-backlog-stat-num">{liveMath.consistencyIndex}/100</span>
                  <span className="sb-muted" style={{ fontSize: 10.5 }}>σ = {liveMath.sd720}m · CV = {liveMath.cvPct}%</span>
                </div>
                <div className="sb-backlog-stat" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                  <span className="sb-backlog-stat-label">EMA Momentum & Z</span>
                  <span className="sb-backlog-stat-num">{liveMath.ema720}/720</span>
                  <span className="sb-muted" style={{ fontSize: 10.5 }}>
                    Latest Z = {liveMath.zScoreLatest >= 0 ? `+${liveMath.zScoreLatest}` : liveMath.zScoreLatest}σ
                  </span>
                </div>
              </div>

              {liveMath.accuracyStats && (
                <div className="sb-review-info-box" style={{ marginBottom: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 12.5, marginBottom: 4, color: "var(--mascot-ink)" }}>
                    🎯 +4 / -1 Game-Theoretic Accuracy & Counterfactual Rank Simulator
                  </div>
                  <div className="sb-review-info-line">
                    <b>Strike Accuracy:</b> {liveMath.accuracyStats.accuracyPct}% · <b>Expected Value (EV):</b> +{liveMath.accuracyStats.evPerAttempt} marks/attempt (out of +4.00) · <b>Avg Negative Bleed:</b> -{liveMath.accuracyStats.avgNegativeMarksLost} marks/mock ({liveMath.accuracyStats.negativeDragPct}% gross drag)
                  </div>
                  <div className="sb-review-info-line" style={{ marginTop: 4 }}>
                    <b>Counterfactual #1 (Skip 50% of wrong guesses):</b> Saves <b>+{liveMath.accuracyStats.counterfactualSkipHalf.marksGained} marks</b> → pushes mean to <b>~{liveMath.accuracyStats.counterfactualSkipHalf.projectedScore720}/720</b> (jumping <b>~{liveMath.accuracyStats.counterfactualSkipHalf.rankJump.toLocaleString("en-IN")} AIR ranks</b>).
                  </div>
                  <div className="sb-review-info-line" style={{ marginTop: 2 }}>
                    <b>Counterfactual #2 (Convert 50% of wrong answers via NCERT revision):</b> Adds <b>+{liveMath.accuracyStats.counterfactualFixHalf.marksGained} marks</b> (+5m swing per question) → pushes mean to <b>~{liveMath.accuracyStats.counterfactualFixHalf.projectedScore720}/720</b> (jumping <b>~{liveMath.accuracyStats.counterfactualFixHalf.rankJump.toLocaleString("en-IN")} AIR ranks</b>).
                  </div>
                </div>
              )}
            </Card>
          )}

          <Card>
            <SectionTitle icon={Clock}>Pacing check</SectionTitle>
            {pacingData ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={pacingData.rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--soft)" />
                    <XAxis dataKey="name" stroke="var(--muted)" fontSize={12} />
                    <YAxis stroke="var(--muted)" fontSize={12} unit="%" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "none" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Time share %" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Score share %" fill="var(--p3, #8b5cf6)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="sb-muted" style={{ fontSize: 12, marginTop: 8 }}>
                  Averaged across {pacingData.mockCount} mock{pacingData.mockCount === 1 ? "" : "s"} with time logged.{" "}
                  {Math.abs(pacingData.worst.gap) >= 8 ? (
                    <>Biggest mismatch: <b>{pacingData.worst.name}</b> is {pacingData.worst.gap > 0 ? "eating more time than it returns in marks" : "returning more marks than the time you give it"} ({pacingData.worst["Time share %"]}% of time vs {pacingData.worst["Score share %"]}% of score).</>
                  ) : "Your time split roughly matches your score split — pacing looks balanced."}
                </p>
              </>
            ) : (
              <EmptyState mascot={p.mascot} mood="idle" text="No pacing data yet." sub="Fill in the optional per-subject minutes when logging a mock to see how your time split compares to your score split." />
            )}
          </Card>

          <Card washi className="sb-ai-card">
            <SectionTitle icon={Sparkles}>Smart AI & Mathematical Comparison</SectionTitle>
            <p className="sb-muted" style={{ fontSize: 12, marginBottom: 10 }}>
              Combines exact mathematical modeling (NTA NEET UG marks-vs-rank log interpolation, OLS regression slope β₁, Z-score volatility, and +4/-1 Expected Value analysis) with AI diagnostic synthesis across Biology (Botany & Zoology), Physics, and Chemistry.
            </p>
            <Btn onClick={runAIComparison} disabled={aiLoading || unpackedMocks.length === 0}>
              {aiLoading ? <><RefreshCw size={16} className="sb-spin" /> Comparing...</> : <><Sparkles size={16} /> {aiResult ? "Re-run AI & Math Comparison" : "Run Smart Comparison"}</>}
            </Btn>

            {unpackedMocks.length === 0 && <div className="sb-muted" style={{ fontSize: 12, marginTop: 8 }}>Log at least one mock to run a comparison.</div>}

            {aiError && (
              <div style={{ marginTop: 14 }}>
                <SectionTitle icon={AlertTriangle}>Couldn't generate a new comparison</SectionTitle>
                <p className="sb-muted">{aiError}</p>
                {aiResult && <p className="sb-muted small" style={{ marginTop: 4 }}>Showing your last successful comparison below.</p>}
              </div>
            )}

            {aiResult && (
              <div className="sb-ai-report">
                {aiResult.mode === "single" && (
                  <div className="sb-ai-notice">
                    <Compass size={14} /> Baseline evaluation for {aiResult.exam_focus || "NEET UG"} — log 2+ mocks to unlock multi-mock trajectory & window deltas.
                  </div>
                )}

                <div className="sb-ai-headline">
                  <div className="sb-ai-badge winner">
                    <Trophy size={16} />
                    <div>
                      <div className="sb-ai-badge-label">{aiResult.mode === "single" ? "Focus exam" : "Trajectory / Stronger"}</div>
                      <div className="sb-ai-badge-value">{aiResult.mode === "single" ? (aiResult.exam_focus || "NEET UG") : aiResult.stronger_paper}</div>
                    </div>
                  </div>
                  <div className="sb-ai-badge gap">
                    <Target size={16} />
                    <div>
                      <div className="sb-ai-badge-label">{aiResult.mode === "single" ? "Est. NEET standing" : "Delta / Standing"}</div>
                      <div className="sb-ai-badge-value">{aiResult.mode === "single" ? aiResult.percentile_estimate : aiResult.score_gap_pct}</div>
                    </div>
                  </div>
                </div>

                <p className="sb-ai-summary">{aiResult.summary}</p>

                {aiResult.subject_comparison && (
                  <div className="sb-ai-subjects" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
                    {aiResult.subject_comparison.biology && (
                      <div className="sb-ai-subject biology">
                        <div className="sb-ai-subject-head" style={{ color: "#C43668" }}><Dna size={15} /> Biology (360)</div>
                        <p>{aiResult.subject_comparison.biology}</p>
                      </div>
                    )}
                    {aiResult.subject_comparison.botany && (
                      <div className="sb-ai-subject botany">
                        <div className="sb-ai-subject-head" style={{ color: "#2E9955" }}><Dna size={15} /> Botany (180)</div>
                        <p>{aiResult.subject_comparison.botany}</p>
                      </div>
                    )}
                    {aiResult.subject_comparison.zoology && (
                      <div className="sb-ai-subject zoology">
                        <div className="sb-ai-subject-head" style={{ color: "#C43668" }}><Dna size={15} /> Zoology (180)</div>
                        <p>{aiResult.subject_comparison.zoology}</p>
                      </div>
                    )}
                    {aiResult.subject_comparison.physics && (
                      <div className="sb-ai-subject physics">
                        <div className="sb-ai-subject-head"><Atom size={15} /> Physics (180)</div>
                        <p>{aiResult.subject_comparison.physics}</p>
                      </div>
                    )}
                    {aiResult.subject_comparison.chemistry && (
                      <div className="sb-ai-subject chemistry">
                        <div className="sb-ai-subject-head"><FlaskConical size={15} /> Chemistry (180)</div>
                        <p>{aiResult.subject_comparison.chemistry}</p>
                      </div>
                    )}
                    {isPCMB && aiResult.subject_comparison.math && (
                      <div className="sb-ai-subject math">
                        <div className="sb-ai-subject-head"><Calculator size={15} /> Mathematics</div>
                        <p>{aiResult.subject_comparison.math}</p>
                      </div>
                    )}
                  </div>
                )}

                {aiResult.benchmark_context && (
                  <div className="sb-ai-benchmark">
                    <div className="sb-ai-benchmark-head">
                      <Award size={13} />
                      Real-world NEET UG benchmark {aiResult.percentile_estimate ? `· ${aiResult.percentile_estimate}` : ""}
                    </div>
                    <p>{aiResult.benchmark_context}</p>
                    <p className="sb-ai-benchmark-foot">
                      Mathematically interpolated from published NTA NEET UG marks-vs-rank curves (~24 lakh candidates) + your +4/-1 attempt accuracy.
                    </p>
                  </div>
                )}

                {aiResult.trend && (
                  <div className="sb-ai-line trend">
                    {/[+-]?\bimprov|\bup\b|\bupward\b|above/i.test(aiResult.trend) ? <TrendingUp size={15} /> : /narrow|dip|declin|drop|downward/i.test(aiResult.trend) ? <TrendingDown size={15} /> : <Minus size={15} />}
                    <div><b>Mathematical Trajectory</b><p>{aiResult.trend}</p></div>
                  </div>
                )}
                {aiResult.recommendation && (
                  <div className="sb-ai-line rec">
                    <Lightbulb size={15} />
                    <div><b>Critical Recommendation</b><p>{aiResult.recommendation}</p></div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {mistakeSummary && mistakeSummary.grandTotal > 0 && (
            <Card>
              <SectionTitle icon={Target}>Mistake patterns</SectionTitle>
              <p className="sb-muted" style={{ fontSize: 12, marginBottom: 10 }}>
                From {mistakeSummary.reviewedCount} reviewed mock{mistakeSummary.reviewedCount === 1 ? "" : "s"}. A concept/NCERT gap needs re-reading NCERT line-by-line, while guesswork & calculation errors need timed elimination drills.
              </p>
              {mistakeSummary.breakdown.map((b) => (
                <div key={b.label} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                    <span>{b.label}</span><span className="sb-muted">{b.count} ({b.pct}%)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: "var(--soft)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${b.pct}%`, background: "var(--accent)", borderRadius: 4 }} />
                  </div>
                </div>
              ))}
              {mistakeSummary.topChapters.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="sb-muted small" style={{ marginBottom: 6 }}>Most flagged chapters</div>
                  <div className="sb-chip-row">
                    {mistakeSummary.topChapters.map(([name, count]) => (
                      <span key={name} className="sb-chip small" style={{ boxShadow: "none", cursor: "default" }}>{name} ×{count}</span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
