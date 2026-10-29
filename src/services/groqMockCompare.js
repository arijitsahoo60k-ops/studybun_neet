import { authedApiPost } from "../lib/apiClient";
import { buildDeterministicComparisonReport } from "../lib/examBenchmarks";

/**
 * Compares NEET UG and Custom/Part mock performance using StudyBun NEET's
 * Mathematical & Statistical Engine + server-side Smart AI Comparison
 * endpoint (api/ai/mock-compare.js).
 *
 * If the server AI endpoint is unreachable or has no Groq API key configured,
 * falls back automatically to the deterministic mathematical & statistical
 * comparison report so the student always gets accurate, data-grounded analysis.
 */
export async function generateMockComparison(neetMocks = [], customMocks = []) {
  if (neetMocks.length === 0 && customMocks.length === 0) {
    const e = new Error("Log at least one mock test before running a comparison.");
    e.code = "no_data";
    throw e;
  }
  const deterministic = buildDeterministicComparisonReport(neetMocks, customMocks);
  try {
    const res = await authedApiPost("/api/ai/mock-compare", {
      mainsMocks: neetMocks,
      advancedMocks: customMocks,
      neetMocks,
      customMocks,
    });
    return {
      ...deterministic,
      ...res,
      subject_comparison: {
        ...(deterministic?.subject_comparison || {}),
        ...(res?.subject_comparison || {}),
      },
      real_benchmark: res?.real_benchmark || deterministic?.real_benchmark,
      math_metrics: res?.math_metrics || deterministic?.math_metrics,
    };
  } catch (err) {
    if (deterministic) {
      return {
        ...deterministic,
        model: "deterministic-math-engine",
      };
    }
    throw err;
  }
}
