// ============================================================
// Real-world NEET UG & Custom Mock Mathematical Benchmark Engine
// ============================================================
// Combines:
//  1. Empirical NTA NEET UG marks-vs-rank (AIR) and percentile curves
//     (calibrated across ~24,00,000 candidates, out of 720 marks) using
//     log-rank piecewise interpolation for realistic top-end steepness.
//  2. Ordinary Least Squares (OLS) linear regression (slope β1, intercept β0,
//     R² determination, and projected future mock scores).
//  3. Statistical volatility & consistency index (Mean μ, SD σ, Coefficient
//     of Variation CV, and Z-score of the latest mock).
//  4. Game-theoretic +4/-1 negative-marking & accuracy analysis (Expected
//     Value per attempt EV = 5p - 1, Negative Drag %, and Counterfactual
//     Rank Gain simulations).
//  5. Subject & sub-discipline (Botany, Zoology, Physics, Chemistry, Maths)
//     headroom, ROI, and pacing elasticity.
// ============================================================

import { totalOf, biologyMarksOf, botanyMarksOf, zoologyMarksOf, defaultTotalFor, unpackMockRow, normalizeExamType } from "./mockScore.js";

const num = (v) => Number(v) || 0;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export const NEET_TOTAL_ASPIRANTS = 2_400_000;

// NEET UG Marks (out of 720) -> Approximate All India Rank (AIR)
// Distilled from recent NTA NEET UG marks-vs-rank distributions (~24 lakh appeared).
const NEET_MARKS_TO_RANK = [
  [0, 2400000],
  [50, 2280000],
  [100, 2100000],
  [140, 1890000],
  [160, 1770000], // General qualifying cutoff band (~50th percentile of qualified)
  [200, 1540000],
  [250, 1270000],
  [300, 1010000],
  [350, 775000],
  [400, 575000],
  [450, 405000],
  [500, 265000],
  [540, 178000],
  [570, 124000],
  [600, 79000],
  [620, 54000],   // State GMC borderline
  [640, 32500],
  [650, 23000],   // AIQ GMC cutoff zone
  [660, 15500],
  [670, 9500],
  [680, 5200],    // Tier-1 Government Medical Colleges
  [690, 2400],
  [700, 950],     // Top Central Institutes (MAMC / VMMC / JIPMER / AIIMS)
  [705, 480],
  [710, 180],
  [715, 45],
  [720, 1],
];

/**
 * Log-linear interpolation on rank: because candidate density grows
 * exponentially as marks move down from 720, interpolating in log(rank)
 * space between breakpoints is far more accurate than naive linear rank
 * interpolation.
 */
export function marksToNeetRank(marks720) {
  const m = clamp(num(marks720), 0, 720);
  const table = NEET_MARKS_TO_RANK;
  if (m >= table[table.length - 1][0]) return 1;
  if (m <= table[0][0]) return table[0][1];
  for (let i = table.length - 1; i > 0; i--) {
    const [xHi, rHi] = table[i];
    const [xLo, rLo] = table[i - 1];
    if (m <= xHi && m >= xLo) {
      const t = (m - xLo) / (xHi - xLo);
      const logLo = Math.log(Math.max(1, rLo));
      const logHi = Math.log(Math.max(1, rHi));
      return Math.max(1, Math.round(Math.exp(logLo + t * (logHi - logLo))));
    }
  }
  return table[0][1];
}

export function classifyNeetTier(scaled720) {
  const m = num(scaled720);
  if (m >= 700) return "Elite AIIMS / Top Central Medical Tier (700+)";
  if (m >= 665) return "Tier-1 Government Medical College Zone (665–699)";
  if (m >= 625) return "Safe Government MBBS Seat Zone (625–664)";
  if (m >= 575) return "Borderline State GMC / Semi-Govt MBBS Zone (575–624)";
  if (m >= 480) return "Private MBBS / Govt BDS / AYUSH Zone (480–574)";
  if (m >= 300) return "Foundation Building Zone — Push High-Yield NCERT (300–479)";
  if (m >= 160) return "NEET Qualifying Band — Needs Core Concept & PYQ Drill (160–299)";
  return "Early Prep Stage — Focus on NCERT Line-by-Line & Basic PYQs (<160)";
}

/**
 * Estimates NEET UG standing (scaled marks out of 720, approximate AIR rank,
 * rank band, NTA percentile, and medical admission tier) for any mock score.
 */
export function estimateNeetStanding(marksScored, totalMarks = 720) {
  const denom = num(totalMarks) || 720;
  const scaled720 = clamp((num(marksScored) / denom) * 720, -180, 720);
  const rank = marksToNeetRank(Math.max(0, scaled720));
  const rawPctile = 100 * (1 - (rank - 1) / NEET_TOTAL_ASPIRANTS);
  const percentile = Math.min(99.99, Math.max(1.0, Math.round(rawPctile * 100) / 100));
  const bandSpread = Math.max(15, Math.round(rank * 0.08));
  const rankLow = Math.max(1, rank - bandSpread);
  const rankHigh = rank + bandSpread;
  return {
    scaled720: Math.round(scaled720 * 10) / 10,
    rank,
    rankBand: `AIR ${rankLow.toLocaleString("en-IN")} – ${rankHigh.toLocaleString("en-IN")}`,
    percentile,
    equivalentPercentile: percentile,
    tier: classifyNeetTier(scaled720),
  };
}

// Keep legacy export names working seamlessly for any existing callers/tests
export function estimateMainPercentile(marksScored, totalMarks = 720) {
  return estimateNeetStanding(marksScored, totalMarks).percentile;
}

export function estimateAdvancedStanding(marksScored, totalMarks = 720) {
  const st = estimateNeetStanding(marksScored, totalMarks);
  return { rank: st.rank, equivalentPercentile: st.percentile };
}

/**
 * Ordinary Least Squares (OLS) Linear Regression over y = [y_1, ..., y_n]
 * for x = [1, 2, ..., n].
 * Returns { slope, intercept, rSquared, nextPredicted, plus3Predicted, direction }.
 */
export function computeOLSRegression(values) {
  const n = (values || []).length;
  if (n === 0) {
    return { slope: 0, intercept: 0, rSquared: 0, nextPredicted: 0, plus3Predicted: 0, stdError: 0, direction: "insufficient_data" };
  }
  if (n === 1) {
    const y0 = num(values[0]);
    return { slope: 0, intercept: y0, rSquared: 0, nextPredicted: y0, plus3Predicted: y0, stdError: 0, direction: "single_mock" };
  }
  const meanX = (n + 1) / 2;
  const meanY = values.reduce((a, b) => a + num(b), 0) / n;
  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    const dx = (i + 1) - meanX;
    const dy = num(values[i]) - meanY;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssYY += dy * dy;
  }
  const slope = ssXX > 0 ? ssXY / ssXX : 0;
  const intercept = meanY - slope * meanX;
  const rSquared = ssYY > 0 && ssXX > 0 ? clamp((ssXY * ssXY) / (ssXX * ssYY), 0, 1) : 0;

  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yHat = intercept + slope * (i + 1);
    ssRes += (num(values[i]) - yHat) ** 2;
  }
  const stdError = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
  const nextPredicted = intercept + slope * (n + 1);
  const plus3Predicted = intercept + slope * (n + 3);
  const direction = slope > 2.5 ? "upward" : slope < -2.5 ? "downward" : "steady";

  return {
    slope: Math.round(slope * 100) / 100,
    intercept: Math.round(intercept * 10) / 10,
    rSquared: Math.round(rSquared * 1000) / 1000,
    nextPredicted: Math.round(nextPredicted),
    plus3Predicted: Math.round(plus3Predicted),
    stdError: Math.round(stdError * 10) / 10,
    direction,
  };
}

/**
 * Exponential Moving Average (EMA) with smoothing factor alpha (default 0.45).
 */
export function computeEMA(values, alpha = 0.45) {
  if (!values || values.length === 0) return 0;
  let ema = num(values[0]);
  for (let i = 1; i < values.length; i++) {
    ema = alpha * num(values[i]) + (1 - alpha) * ema;
  }
  return Math.round(ema * 10) / 10;
}

/**
 * Computes comprehensive mathematical & statistical metrics across a chronological
 * (oldest-first) array of mock objects.
 */
export function computeMathematicalMockAnalysis(chronologicalMocks = []) {
  const mocks = (chronologicalMocks || []).map(unpackMockRow);
  const n = mocks.length;
  if (n === 0) return null;

  const normalized = mocks.map((m, idx) => {
    const totalMarks = num(m.total_marks) || defaultTotalFor(m);
    const rawScore = m.total !== undefined ? num(m.total) : totalOf(m);
    const pct = totalMarks > 0 ? (rawScore / totalMarks) * 100 : 0;
    const scaled720 = (pct / 100) * 720;
    const standing = estimateNeetStanding(rawScore, totalMarks);

    const bot = botanyMarksOf(m);
    const zoo = zoologyMarksOf(m);
    const bio = biologyMarksOf(m);
    const phy = num(m.physics_marks);
    const chem = num(m.chemistry_marks);
    const math = num(m.math_marks);

    // Count-based accuracy & negative bleed (avoid double-counting botany+zoology with biology_correct, and exclude math from NEET UG totals)
    const isNeet = normalizeExamType(m.exam_type) === "NEET UG";
    const bioC = (num(m.botany_correct) || num(m.zoology_correct))
      ? num(m.botany_correct) + num(m.zoology_correct)
      : num(m.biology_correct);
    const bioW = (num(m.botany_incorrect) || num(m.zoology_incorrect))
      ? num(m.botany_incorrect) + num(m.zoology_incorrect)
      : num(m.biology_incorrect);
    const cSum = bioC + num(m.physics_correct) + num(m.chemistry_correct) + (isNeet ? 0 : num(m.math_correct));
    const wSum = bioW + num(m.physics_incorrect) + num(m.chemistry_incorrect) + (isNeet ? 0 : num(m.math_incorrect));

    const correct = cSum > 0 ? cSum : num(m.correct);
    const incorrect = wSum > 0 ? wSum : num(m.incorrect);
    const attempted = (cSum + wSum > 0) ? (cSum + wSum) : (num(m.attempted) || (correct + incorrect));
    const negativeMarks = num(m.negative_marks) || incorrect;
    const scale720Factor = totalMarks > 0 ? 720 / totalMarks : 1;
    const scaledIncorrect = incorrect * scale720Factor;

    return {
      index: idx + 1,
      exam_name: m.exam_name || `Mock #${idx + 1}`,
      date: m.date || m.mock_date || "",
      exam_type: normalizeExamType(m.exam_type),
      rawScore,
      totalMarks,
      pct: Math.round(pct * 10) / 10,
      scaled720: Math.round(scaled720 * 10) / 10,
      standing,
      bot, zoo, bio, phy, chem, math,
      correct, incorrect, attempted, negativeMarks, scaledIncorrect,
    };
  });

  const scores720 = normalized.map((x) => x.scaled720);
  const pcts = normalized.map((x) => x.pct);
  const mean720 = scores720.reduce((a, b) => a + b, 0) / n;
  const meanPct = pcts.reduce((a, b) => a + b, 0) / n;

  const sorted720 = [...scores720].sort((a, b) => a - b);
  const median720 = n % 2 === 1
    ? sorted720[(n - 1) / 2]
    : (sorted720[n / 2 - 1] + sorted720[n / 2]) / 2;

  const variance720 = n > 1
    ? scores720.reduce((acc, val) => acc + (val - mean720) ** 2, 0) / (n - 1)
    : 0;
  const sd720 = Math.sqrt(variance720);
  const cvPct = mean720 > 0 ? (sd720 / mean720) * 100 : 0;
  // Consistency index (0-100): CV = 0% -> 100, CV = 25% -> 55
  const consistencyIndex = Math.round(clamp(100 - cvPct * 1.8, 0, 100));

  const latest = normalized[n - 1];
  const previous = n >= 2 ? normalized[n - 2] : null;
  const first = normalized[0];

  const zScoreLatest = sd720 > 0.5 ? Math.round(((latest.scaled720 - mean720) / sd720) * 100) / 100 : 0;
  const ols720 = computeOLSRegression(scores720);
  const olsPct = computeOLSRegression(pcts);
  const ema720 = computeEMA(scores720, 0.45);
  const momentumDelta720 = Math.round((ema720 - mean720) * 10) / 10;

  // Negative marking & Game-Theoretic Attempt Efficiency (+4/-1)
  const withCounts = normalized.filter((x) => x.correct + x.incorrect > 0);
  let accuracyStats = null;
  if (withCounts.length > 0) {
    const totC = withCounts.reduce((a, x) => a + x.correct, 0);
    const totW = withCounts.reduce((a, x) => a + x.incorrect, 0);
    const totAtt = totC + totW;
    const avgC = totC / withCounts.length;
    const avgW = totW / withCounts.length;
    const avgGross = avgC * 4;
    const avgNeg = avgW * 1;
    const accuracyPct = totAtt > 0 ? Math.round((totC / totAtt) * 1000) / 10 : 0;
    // Expected Value per attempt in +4/-1: EV = (4C - W) / (C + W) = 5p - 1
    const evPerAttempt = totAtt > 0 ? Math.round(((4 * totC - totW) / totAtt) * 100) / 100 : 0;
    const negativeDragPct = avgGross > 0 ? Math.round((avgNeg / avgGross) * 1000) / 10 : 0;

    // Scale incorrect count to 720-equivalent when computing counterfactual 720-mark rank jumps
    const avgScaledW = withCounts.reduce((a, x) => a + x.scaledIncorrect, 0) / withCounts.length;

    // Counterfactual 1: Skip 50% of wrong guesses (+0.5 * avgScaledW marks saved on 720 scale)
    const marksSavedSkipHalf = Math.round(avgScaledW * 0.5);
    const cfScoreSkip = clamp(mean720 + marksSavedSkipHalf, 0, 720);
    const cfRankSkip = marksToNeetRank(cfScoreSkip);

    // Counterfactual 2: Convert 50% of errors to correct via targeted revision (+2.5 * avgScaledW marks gained on 720 scale)
    const marksGainedFixHalf = Math.round(avgScaledW * 2.5);
    const cfScoreFix = clamp(mean720 + marksGainedFixHalf, 0, 720);
    const cfRankFix = marksToNeetRank(cfScoreFix);

    const baseRank = marksToNeetRank(mean720);

    accuracyStats = {
      mocksWithCounts: withCounts.length,
      avgCorrect: Math.round(avgC * 10) / 10,
      avgIncorrect: Math.round(avgW * 10) / 10,
      avgNegativeMarksLost: Math.round(avgNeg * 10) / 10,
      accuracyPct,
      evPerAttempt,
      negativeDragPct,
      counterfactualSkipHalf: {
        marksGained: marksSavedSkipHalf,
        projectedScore720: Math.round(cfScoreSkip),
        projectedRank: cfRankSkip,
        rankJump: Math.max(0, baseRank - cfRankSkip),
      },
      counterfactualFixHalf: {
        marksGained: marksGainedFixHalf,
        projectedScore720: Math.round(cfScoreFix),
        projectedRank: cfRankFix,
        rankJump: Math.max(0, baseRank - cfRankFix),
      },
    };
  }

  // Per-subject statistical breakdown
  const buildSubjStat = (key, label, maxMarks) => {
    const vals = normalized.map((x) => x[key]);
    const hasAny = vals.some((v) => v > 0);
    const avg = vals.reduce((a, b) => a + b, 0) / n;
    const best = Math.max(...vals);
    const latestVal = vals[n - 1];
    const prevVal = n >= 2 ? vals[n - 2] : latestVal;
    const pctOfMax = maxMarks > 0 ? Math.round((avg / maxMarks) * 1000) / 10 : 0;
    const reg = computeOLSRegression(vals);
    const headroom = Math.max(0, Math.round(maxMarks - avg));
    return {
      key,
      label,
      maxMarks,
      hasAny,
      avg: Math.round(avg * 10) / 10,
      best: Math.round(best * 10) / 10,
      latest: Math.round(latestVal * 10) / 10,
      deltaLast: Math.round((latestVal - prevVal) * 10) / 10,
      pctOfMax,
      slope: reg.slope,
      direction: reg.direction,
      headroom,
    };
  };

  const subjects = {
    biology: buildSubjStat("bio", "Biology (Total)", 360),
    botany: buildSubjStat("bot", "Botany", 180),
    zoology: buildSubjStat("zoo", "Zoology", 180),
    physics: buildSubjStat("phy", "Physics", 180),
    chemistry: buildSubjStat("chem", "Chemistry", 180),
    math: buildSubjStat("math", "Mathematics", 180),
  };

  // Identify strongest & bottleneck among core NEET subjects (Biology, Physics, Chemistry)
  const coreList = [subjects.biology, subjects.physics, subjects.chemistry];
  const sortedByPct = [...coreList].sort((a, b) => b.pctOfMax - a.pctOfMax);
  const strongestSubject = sortedByPct[0];
  // Bottleneck subject is the core NEET subject with the largest marks headroom (Biology is out of 360, Physics/Chemistry out of 180)
  const bottleneckSubject = [...coreList].sort((a, b) => b.headroom - a.headroom)[0];

  // Window comparison: Recent half vs Baseline half (or Latest vs Previous)
  let windowComparison = null;
  if (n >= 2) {
    const splitIdx = Math.floor(n / 2);
    const baselineSlice = normalized.slice(0, splitIdx);
    const recentSlice = normalized.slice(splitIdx);
    const baseAvg720 = baselineSlice.reduce((a, x) => a + x.scaled720, 0) / baselineSlice.length;
    const recentAvg720 = recentSlice.reduce((a, x) => a + x.scaled720, 0) / recentSlice.length;
    const delta720 = Math.round((recentAvg720 - baseAvg720) * 10) / 10;
    const deltaLatestVsPrev720 = Math.round((latest.scaled720 - previous.scaled720) * 10) / 10;

    windowComparison = {
      baselineCount: baselineSlice.length,
      recentCount: recentSlice.length,
      baselineAvg720: Math.round(baseAvg720 * 10) / 10,
      recentAvg720: Math.round(recentAvg720 * 10) / 10,
      delta720,
      latestVsPrev720: deltaLatestVsPrev720,
      latestStanding: latest.standing,
      previousStanding: previous.standing,
    };
  }

  const avgStanding = estimateNeetStanding(mean720, 720);
  const bestStanding = estimateNeetStanding(Math.max(...scores720), 720);

  return {
    count: n,
    mean720: Math.round(mean720 * 10) / 10,
    median720: Math.round(median720 * 10) / 10,
    meanPct: Math.round(meanPct * 10) / 10,
    sd720: Math.round(sd720 * 10) / 10,
    cvPct: Math.round(cvPct * 10) / 10,
    consistencyIndex,
    zScoreLatest,
    ema720,
    momentumDelta720,
    ols720,
    olsPct,
    latest,
    previous,
    first,
    avgStanding,
    bestStanding,
    accuracyStats,
    subjects,
    strongestSubject: strongestSubject.label,
    bottleneckSubject: bottleneckSubject.label,
    windowComparison,
  };
}

export function benchmarkMainMocks(mocks) {
  if (!mocks || mocks.length === 0) return null;
  const math = computeMathematicalMockAnalysis(mocks);
  if (!math) return null;
  return {
    avgPercentile: math.avgStanding.percentile,
    latestPercentile: math.latest.standing.percentile,
    avgRank: math.avgStanding.rank,
    latestRank: math.latest.standing.rank,
    rankBand: math.avgStanding.rankBand,
    tier: math.avgStanding.tier,
    avgScaled720: math.mean720,
    latestScaled720: math.latest.scaled720,
    count: math.count,
    math,
  };
}

export function benchmarkAdvancedMocks(mocks) {
  if (!mocks || mocks.length === 0) return null;
  const math = computeMathematicalMockAnalysis(mocks);
  if (!math) return null;
  return {
    avgEquivalentPercentile: math.avgStanding.percentile,
    latestEquivalentPercentile: math.latest.standing.percentile,
    avgRank: math.avgStanding.rank,
    latestRank: math.latest.standing.rank,
    rankBand: math.avgStanding.rankBand,
    tier: math.avgStanding.tier,
    avgScaled720: math.mean720,
    latestScaled720: math.latest.scaled720,
    count: math.count,
    math,
  };
}

/**
 * Builds the complete deterministic comparison object across NEET UG Full
 * Mocks and Custom/Part Mocks (as well as combined chronological history).
 */
export function buildRealComparison(neetMocks = [], customMocks = []) {
  const allChrono = [...(neetMocks || []), ...(customMocks || [])].sort(
    (a, b) => String(a.date || a.mock_date || "").localeCompare(String(b.date || b.mock_date || ""))
  );
  if (allChrono.length === 0) return null;

  const main = benchmarkMainMocks(neetMocks);
  const advanced = benchmarkAdvancedMocks(customMocks);
  const neetChrono = [...(neetMocks || [])].sort(
    (a, b) => String(a.date || a.mock_date || "").localeCompare(String(b.date || b.mock_date || ""))
  );
  const overallMath = computeMathematicalMockAnalysis(neetChrono.length > 0 ? neetChrono : allChrono);

  let gapPts = null;
  let strongerPaper = "Too close to call";
  if (main && advanced) {
    gapPts = Math.round((main.avgPercentile - advanced.avgEquivalentPercentile) * 100) / 100;
    if (Math.abs(gapPts) >= 0.3) {
      strongerPaper = gapPts > 0 ? "NEET UG" : "Custom / Part Mock";
    }
  } else if (overallMath && overallMath.windowComparison) {
    gapPts = overallMath.windowComparison.delta720;
    strongerPaper = gapPts > 4
      ? "Recent Mocks (+Momentum)"
      : gapPts < -4
        ? "Earlier Baseline (Recent Dip)"
        : "Steady Trajectory";
  }

  return {
    main,
    advanced,
    overallMath,
    gapPts,
    strongerPaper,
    totalAspirantsAssumed: NEET_TOTAL_ASPIRANTS,
    caveats: [
      "Rank and percentile bands are mathematically interpolated from published NTA NEET UG marks-vs-rank curves (~24 lakh candidates, out of 720 marks).",
      "Linear regression (OLS slope β₁) and Expected Value per attempt (EV = 5p − 1) are computed deterministically from your logged mock scores and +4/−1 counts.",
      "Counterfactual rank jumps show the mathematical ceiling of eliminating negative-marking bleed vs. conceptual errors.",
    ],
  };
}

/**
 * Generates a complete, high-precision deterministic AI + Mathematical
 * Comparison report. Used both to ground the LLM narrative on the server
 * AND as an instant, zero-failure client/server fallback when API keys are
 * unavailable.
 */
export function buildDeterministicComparisonReport(neetMocks = [], customMocks = []) {
  const real = buildRealComparison(neetMocks, customMocks);
  if (!real || !real.overallMath) return null;

  const m = real.overallMath;
  const bothTypes = neetMocks.length > 0 && customMocks.length > 0;
  const mode = bothTypes ? "compare" : m.count >= 2 ? "progression" : "single";
  const examFocus = neetMocks.length > 0 ? "NEET UG" : "Custom / Part Mock";

  const slopeSign = m.ols720.slope >= 0 ? `+${m.ols720.slope}` : `${m.ols720.slope}`;
  const zSign = m.zScoreLatest >= 0 ? `+${m.zScoreLatest}` : `${m.zScoreLatest}`;

  // Summary paragraph grounded in exact numbers
  let summary = "";
  if (bothTypes) {
    summary = `Across ${real.main.count} NEET UG mock(s) (avg ${real.main.avgScaled720}/720 · ~${real.main.avgPercentile}%ile) and ${real.advanced.count} Custom/Part mock(s) (avg ${real.advanced.avgScaled720}/720 eq · ~${real.advanced.avgEquivalentPercentile}%ile), your stronger format is ${real.strongerPaper}. Overall OLS trajectory is ${slopeSign} marks/mock (R² = ${m.ols720.rSquared}) with a Consistency Index of ${m.consistencyIndex}/100 (σ = ${m.sd720} marks).`;
  } else if (m.count >= 2) {
    const deltaLast = m.windowComparison?.latestVsPrev720 || 0;
    const dStr = deltaLast >= 0 ? `+${deltaLast}` : `${deltaLast}`;
    summary = `Across ${m.count} logged mocks, your mean score is ${m.mean720}/720 (median ${m.median720}/720 · ${m.avgStanding.rankBand}, ~${m.avgStanding.percentile}%ile). Your latest mock (${m.latest.scaled720}/720) moved ${dStr} marks vs. your previous attempt (Z-score = ${zSign}σ), with an OLS regression slope of ${slopeSign} marks/mock and an EMA momentum of ${m.ema720}/720.`;
  } else {
    summary = `Baseline established at ${m.latest.scaled720}/720 (${m.latest.pct}%) on "${m.latest.exam_name}", placing you in the ${m.latest.standing.rankBand} band (~${m.latest.standing.percentile}%ile · ${m.latest.standing.tier}). Log a second mock to unlock OLS regression slope, Z-score volatility, and moving-average momentum.`;
  }

  // Subject comparisons
  const bioSub = m.subjects.biology;
  const botSub = m.subjects.botany;
  const zooSub = m.subjects.zoology;
  const phySub = m.subjects.physics;
  const chemSub = m.subjects.chemistry;
  const mathSub = m.subjects.math;

  const botZooDetail = (botSub.hasAny || zooSub.hasAny)
    ? ` (Botany avg ${botSub.avg}/180 [${botSub.pctOfMax}%] · Zoology avg ${zooSub.avg}/180 [${zooSub.pctOfMax}%])`
    : "";

  const subject_comparison = {
    biology: `Averaging ${bioSub.avg}/360 (${bioSub.pctOfMax}%)${botZooDetail} with ${bioSub.headroom} marks of headroom and a trend slope of ${bioSub.slope >= 0 ? "+" : ""}${bioSub.slope} marks/mock.`,
    botany: botSub.hasAny
      ? `Averaging ${botSub.avg}/180 (${botSub.pctOfMax}% · best ${botSub.best}/180), leaving ${botSub.headroom} marks on the table (slope ${botSub.slope >= 0 ? "+" : ""}${botSub.slope}/mock).`
      : `Combined under Biology total (${bioSub.avg}/360) — log Botany & Zoology separately for sub-discipline split.`,
    zoology: zooSub.hasAny
      ? `Averaging ${zooSub.avg}/180 (${zooSub.pctOfMax}% · best ${zooSub.best}/180), leaving ${zooSub.headroom} marks on the table (slope ${zooSub.slope >= 0 ? "+" : ""}${zooSub.slope}/mock).`
      : `Combined under Biology total (${bioSub.avg}/360) — log Botany & Zoology separately for sub-discipline split.`,
    physics: `Averaging ${phySub.avg}/180 (${phySub.pctOfMax}% · best ${phySub.best}/180) with ${phySub.headroom} marks of headroom and a slope of ${phySub.slope >= 0 ? "+" : ""}${phySub.slope} marks/mock.`,
    chemistry: `Averaging ${chemSub.avg}/180 (${chemSub.pctOfMax}% · best ${chemSub.best}/180) with ${chemSub.headroom} marks of headroom and a slope of ${chemSub.slope >= 0 ? "+" : ""}${chemSub.slope} marks/mock.`,
    ...(mathSub.hasAny ? {
      math: `Averaging ${mathSub.avg}/180 (${mathSub.pctOfMax}% · best ${mathSub.best}/180) with slope ${mathSub.slope >= 0 ? "+" : ""}${mathSub.slope} marks/mock.`,
    } : {}),
  };

  const accNote = m.accuracyStats
    ? ` Your strike accuracy is ${m.accuracyStats.accuracyPct}% (Expected Value = +${m.accuracyStats.evPerAttempt} marks/attempt), losing an average of -${m.accuracyStats.avgNegativeMarksLost} marks/mock to negative marking (${m.accuracyStats.negativeDragPct}% drag).`
    : "";

  const benchmark_context = `Mean standing: ${m.avgStanding.rankBand} (~${m.avgStanding.percentile}%ile · ${m.avgStanding.tier}). Best mock standing: ${m.bestStanding.rankBand} (~${m.bestStanding.percentile}%ile).${accNote}`;

  const trend = m.count >= 2
    ? `OLS linear regression shows a ${m.ols720.direction} slope of ${slopeSign} marks/mock (R² = ${m.ols720.rSquared}). Exponential Moving Average (EMA = ${m.ema720}/720) is ${m.momentumDelta720 >= 0 ? `+${m.momentumDelta720} above` : `${m.momentumDelta720} below`} your historical mean (${m.mean720}/720), projecting ~${clamp(m.ols720.nextPredicted, 0, 720)}/720 on your next attempt.`
    : `Single mock logged (${m.latest.scaled720}/720). Take 1–2 more mocks to compute your regression slope (β₁), R² trend determinism, and EMA momentum.`;

  let recommendation = `Prioritize ${m.bottleneckSubject} first (largest weighted headroom), while protecting your edge in ${m.strongestSubject}. `;
  if (m.accuracyStats && m.accuracyStats.avgNegativeMarksLost >= 10) {
    recommendation += `Cutting just 50% of your negative marking (-${m.accuracyStats.avgNegativeMarksLost}m avg) by skipping low-probability 4-option guesses immediately adds +${m.accuracyStats.counterfactualSkipHalf.marksGained} marks (pushing you to ~${m.accuracyStats.counterfactualSkipHalf.projectedScore720}/720, jumping ~${m.accuracyStats.counterfactualSkipHalf.rankJump.toLocaleString("en-IN")} AIR places), while converting half of those errors via NCERT/PYQ revision adds +${m.accuracyStats.counterfactualFixHalf.marksGained} marks (~${m.accuracyStats.counterfactualFixHalf.projectedScore720}/720).`;
  } else if (bioSub.avg < 320) {
    recommendation += `In NEET UG, Biology accounts for 50% of the paper (360/720) with the highest marks-per-minute ROI: push Botany & Zoology NCERT line-by-line recall to cross the 330+/360 mark before chasing low-ROI lengthy Physics calculations.`;
  } else {
    recommendation += `Your Biology base (${bioSub.avg}/360) is strong; rank jumps inside the top 10,000 AIR now depend on eliminating calculation & assertion-reason traps in Physics (${phySub.avg}/180) and Chemistry (${chemSub.avg}/180).`;
  }

  return {
    mode,
    exam_focus: bothTypes ? null : examFocus,
    summary,
    stronger_paper: bothTypes ? real.strongerPaper : (m.count >= 2 ? real.strongerPaper : examFocus),
    score_gap_pct: bothTypes
      ? `${Math.abs(real.gapPts)} %ile pts`
      : m.count >= 2
        ? `${m.windowComparison.delta720 >= 0 ? "+" : ""}${m.windowComparison.delta720} marks (Recent vs Base)`
        : `${m.avgStanding.percentile}%ile (${m.avgStanding.rankBand})`,
    subject_comparison,
    benchmark_context,
    percentile_estimate: `${m.avgStanding.percentile}%ile · ${m.avgStanding.rankBand}`,
    trend,
    recommendation,
    real_benchmark: real,
    math_metrics: m,
  };
}
