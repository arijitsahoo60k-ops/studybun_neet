import { getUserFromAuthHeader } from "../_lib/supabaseAdmin.js";
import { groqComplete } from "../_lib/groqClient.js";
import { checkRateLimit } from "../_lib/rateLimit.js";
import { buildRealComparison, buildDeterministicComparisonReport } from "../../src/lib/examBenchmarks.js";

const MAX_MOCKS = 200;
const MAX_PAYLOAD_CHARS = 50_000;

function formatRealBenchmarkFacts(real, detReport) {
  if (!real || !real.overallMath) return "No benchmark could be computed (no scored mocks).";
  const m = real.overallMath;
  const lines = [];
  lines.push(`OVERALL STATISTICAL SUMMARY (${m.count} mocks):`);
  lines.push(`- Mean Score (720-scale): ${m.mean720}/720 (Median: ${m.median720}/720, Mean %: ${m.meanPct}%)`);
  lines.push(`- Standard Deviation (σ): ${m.sd720} marks | Coefficient of Variation (CV): ${m.cvPct}% | Consistency Index: ${m.consistencyIndex}/100`);
  lines.push(`- Latest Mock: ${m.latest.scaled720}/720 (${m.latest.pct}%) | Z-Score: ${m.zScoreLatest >= 0 ? "+" : ""}${m.zScoreLatest}σ`);
  lines.push(`- OLS Linear Regression Slope (β₁): ${m.ols720.slope >= 0 ? "+" : ""}${m.ols720.slope} marks/mock (R² = ${m.ols720.rSquared}, Next Projected: ${m.ols720.nextPredicted}/720)`);
  lines.push(`- Exponential Moving Average (EMA): ${m.ema720}/720 (Momentum Delta vs Mean: ${m.momentumDelta720 >= 0 ? "+" : ""}${m.momentumDelta720} marks)`);
  lines.push(`- Estimated NEET UG Standing: Mean ≈ ${m.avgStanding.rankBand} (${m.avgStanding.percentile}%ile · ${m.avgStanding.tier}) | Best ≈ ${m.bestStanding.rankBand} (${m.bestStanding.percentile}%ile)`);

  if (m.accuracyStats) {
    const a = m.accuracyStats;
    lines.push(`- +4/-1 Game-Theoretic Accuracy: Strike Rate = ${a.accuracyPct}% | Expected Value (EV) = +${a.evPerAttempt} marks/attempt | Avg Negative Marks Lost = -${a.avgNegativeMarksLost} marks/mock (${a.negativeDragPct}% drag)`);
    lines.push(`- Counterfactual (Skip 50% of wrong guesses): +${a.counterfactualSkipHalf.marksGained} marks -> ~${a.counterfactualSkipHalf.projectedScore720}/720 (AIR jump of ~${a.counterfactualSkipHalf.rankJump.toLocaleString("en-IN")} ranks)`);
    lines.push(`- Counterfactual (Fix 50% of errors via revision): +${a.counterfactualFixHalf.marksGained} marks -> ~${a.counterfactualFixHalf.projectedScore720}/720 (AIR jump of ~${a.counterfactualFixHalf.rankJump.toLocaleString("en-IN")} ranks)`);
  }

  lines.push(`- Subject Breakdown:`);
  lines.push(`  * Biology (out of 360): avg ${m.subjects.biology.avg}/360 (${m.subjects.biology.pctOfMax}%), headroom ${m.subjects.biology.headroom}m, slope ${m.subjects.biology.slope}/mock`);
  if (m.subjects.botany.hasAny || m.subjects.zoology.hasAny) {
    lines.push(`  * Botany (out of 180): avg ${m.subjects.botany.avg}/180 (${m.subjects.botany.pctOfMax}%), headroom ${m.subjects.botany.headroom}m`);
    lines.push(`  * Zoology (out of 180): avg ${m.subjects.zoology.avg}/180 (${m.subjects.zoology.pctOfMax}%), headroom ${m.subjects.zoology.headroom}m`);
  }
  lines.push(`  * Physics (out of 180): avg ${m.subjects.physics.avg}/180 (${m.subjects.physics.pctOfMax}%), headroom ${m.subjects.physics.headroom}m, slope ${m.subjects.physics.slope}/mock`);
  lines.push(`  * Chemistry (out of 180): avg ${m.subjects.chemistry.avg}/180 (${m.subjects.chemistry.pctOfMax}%), headroom ${m.subjects.chemistry.headroom}m, slope ${m.subjects.chemistry.slope}/mock`);
  if (m.subjects.math.hasAny) {
    lines.push(`  * Mathematics (out of 180): avg ${m.subjects.math.avg}/180 (${m.subjects.math.pctOfMax}%), slope ${m.subjects.math.slope}/mock`);
  }
  lines.push(`- Strongest Subject: ${m.strongestSubject} | Primary Bottleneck: ${m.bottleneckSubject}`);
  if (detReport) {
    lines.push(`- Baseline Deterministic Summary: ${detReport.summary}`);
  }
  lines.push(...real.caveats.map((c) => `CAVEAT: ${c}`));
  return lines.join("\n");
}

const NUMBERS_INSTRUCTION = `You are given PRECOMPUTED, MATHEMATICALLY EXACT benchmark and statistical numbers below
(NTA NEET UG marks-vs-rank interpolation out of 720, Ordinary Least Squares regression slope β₁ and R², Standard Deviation σ,
Consistency Index, Z-score, Expected Value per attempt EV = 5p - 1, and counterfactual negative-marking rank jumps).
You MUST use these exact numbers wherever you reference a percentile, rank, slope, accuracy, or score gap. NEVER invent
your own percentile/rank estimate or contradict the precomputed mathematical facts below.`;

function buildPrompt(neetMocks, customMocks, realFacts, detReport) {
  const bothTypes = neetMocks.length > 0 && customMocks.length > 0;
  return `You are the mathematical mock-test diagnostic & comparison engine inside StudyBun NEET, a productivity app for a NEET UG medical entrance (and PCB/PCMB) aspirant.

${NUMBERS_INSTRUCTION}

PRECOMPUTED MATHEMATICAL & STATISTICAL FACTS:
${realFacts}

NEET UG MOCKS (chronological, oldest first):
${JSON.stringify(neetMocks, null, 2)}

CUSTOM / PART MOCKS (chronological, oldest first):
${JSON.stringify(customMocks, null, 2)}

Return ONLY valid JSON (no markdown fences, no preamble) matching this exact shape:
{
  "mode": "${detReport?.mode || (bothTypes ? "compare" : "single")}",
  "exam_focus": ${bothTypes ? "null" : JSON.stringify(detReport?.exam_focus || "NEET UG")},
  "summary": "2-3 sentence rigorous comparison grounded in the exact mean, OLS slope β₁, Z-score, and NEET UG rank/percentile numbers above",
  "stronger_paper": ${JSON.stringify(detReport?.stronger_paper || "NEET UG")},
  "score_gap_pct": ${JSON.stringify(detReport?.score_gap_pct || "")},
  "subject_comparison": {
    "biology": "1-2 sentences analyzing total Biology (/360) plus Botany (/180) and Zoology (/180) performance, headroom, and trend",
    "botany": "1 sentence on Botany (/180) performance and NCERT high-yield focus",
    "zoology": "1 sentence on Zoology (/180) performance and Human Physiology/Biotech focus",
    "physics": "1 sentence on Physics (/180) performance, calculation/negative marking, and slope",
    "chemistry": "1 sentence on Chemistry (/180) performance, PC/IOC/OC balance, and slope",
    "math": "1 sentence on Mathematics performance if logged, or 'Not applicable for PCB stream'"
  },
  "benchmark_context": "1-2 sentences positioning these scores using ONLY the precomputed NEET UG rank band, percentile, Expected Value (EV), and negative-marking drag above",
  "percentile_estimate": ${JSON.stringify(detReport?.percentile_estimate || "")},
  "trend": "1-2 sentences citing the exact OLS slope β₁, R², EMA momentum, and projected next score",
  "recommendation": "2-3 concrete, mathematically grounded sentences on how to maximize marks next mock — cite the counterfactual rank jump from cutting negative marking and the bottleneck subject headroom"
}`;
}

function isValidMockArray(v) {
  return Array.isArray(v) && v.length <= MAX_MOCKS && v.every((m) => m && typeof m === "object" && !Array.isArray(m));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ success: false, error: authError || "Not signed in." });

  const rl = checkRateLimit(`mock-compare:${user.id}`, 10);
  if (!rl.ok) return res.status(429).json({ success: false, error: "Too many requests — please wait a moment and try again." });

  const body = req.body || {};
  const neetMocks = body.neetMocks || body.mainsMocks || [];
  const customMocks = body.customMocks || body.advancedMocks || [];

  if (!isValidMockArray(neetMocks) || !isValidMockArray(customMocks)) {
    return res.status(400).json({ success: false, error: "Invalid mock history payload." });
  }
  if (neetMocks.length === 0 && customMocks.length === 0) {
    return res.status(400).json({ success: false, error: "Log at least one mock before running a comparison.", code: "no_data" });
  }
  if (JSON.stringify({ neetMocks, customMocks }).length > MAX_PAYLOAD_CHARS) {
    return res.status(400).json({ success: false, error: "Mock history payload too large." });
  }

  const realBenchmark = buildRealComparison(neetMocks, customMocks);
  const detReport = buildDeterministicComparisonReport(neetMocks, customMocks);
  const realFacts = formatRealBenchmarkFacts(realBenchmark, detReport);
  const prompt = buildPrompt(neetMocks, customMocks, realFacts, detReport);

  try {
    const { content, model } = await groqComplete({ userPrompt: prompt, temperature: 0.35, jsonMode: true });

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(200).json({
        success: true,
        data: { ...detReport, model: "deterministic-math-engine" },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...detReport,
        ...parsed,
        subject_comparison: {
          ...(detReport?.subject_comparison || {}),
          ...(parsed?.subject_comparison || {}),
        },
        stronger_paper: detReport?.stronger_paper || parsed.stronger_paper,
        score_gap_pct: detReport?.score_gap_pct || parsed.score_gap_pct,
        percentile_estimate: detReport?.percentile_estimate || parsed.percentile_estimate,
        model,
        real_benchmark: realBenchmark,
        math_metrics: detReport?.math_metrics,
      },
    });
  } catch {
    // Graceful fallback to the deterministic mathematical engine if Groq is not configured or rate-limited
    return res.status(200).json({
      success: true,
      data: { ...detReport, model: "deterministic-math-engine" },
    });
  }
}
