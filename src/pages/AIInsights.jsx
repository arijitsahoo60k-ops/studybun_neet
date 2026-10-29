import React, { useState, useMemo } from "react";
import { Sparkles, RefreshCw, AlertTriangle, Lock, CheckCircle2, Target, TrendingUp, Flame, NotebookPen, RotateCcw, Lightbulb, BookOpen, Compass } from "lucide-react";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, SectionTitle, Btn, ProgressBar, EmptyState } from "../components/ui";
import Mascot from "../components/Mascot";
import { generateAIInsights } from "../services/gemini";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { buildStatsSnapshot } from "../lib/statsSnapshot";
import { pctOf, normalizeExamType } from "../lib/mockScore";
import { SYLLABUS, getActiveSubjects, normalizeStream } from "../data/syllabus";

export default function AIInsightsPage(p) {
  const { user } = useAuth();
  const subject_stream = normalizeStream(p.profile?.subject_stream || p.profile);
  const isPCMB = subject_stream === "PCMB";
  const activeSubjects = useMemo(() => p.activeSubjects || getActiveSubjects(p.profile), [p.activeSubjects, p.profile]);
  const mathChaptersSet = useMemo(() => new Set(Object.values(SYLLABUS.Mathematics?.groups || {}).flat()), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // The result itself lives in Supabase (p.aiInsights, saved via
  // p.saveAiInsights) so it survives leaving this page, refreshing, or
  // switching devices — not just local state that vanished the moment you
  // navigated away.
  const result = p.aiInsights?.result || null;
  const generatedAt = p.aiInsights?.generated_at ? new Date(p.aiInsights.generated_at) : null;

  const hasEnoughData = p.sessions.length > 0 || p.questions.length > 0 || p.mocks.length > 0;
  const unlockAt = p.featureUnlockStreak ?? 6;
  const streakLocked = (p.streak || 0) < unlockAt;

  // Same normalized scoring (../lib/mockScore) the Mocks page's own trend
  // chart uses, so this line reads exactly like the one there instead of an
  // older, separately-computed version.
  const trendData = useMemo(() => {
    const neetMocks = [...p.mocks].filter((m) => normalizeExamType(m.exam_type) === "NEET UG").reverse();
    const customMocks = [...p.mocks].filter((m) => normalizeExamType(m.exam_type) !== "NEET UG").reverse();
    const len = Math.max(neetMocks.length, customMocks.length);
    return Array.from({ length: len }, (_, i) => ({
      name: `#${i + 1}`,
      "NEET UG": neetMocks[i] ? pctOf(neetMocks[i]) : null,
      "Custom / Part": customMocks[i] ? pctOf(customMocks[i]) : null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.mocks]);
  const latestPct = p.mocks.length ? pctOf(p.mocks[0]) : null;
  const bestPct = p.mocks.length ? Math.max(...p.mocks.map(pctOf)) : null;

  if (streakLocked) {
    return (
      <div className="sb-page">
        <Card className="sb-hero">
          <div>
            <div className="sb-hero-greet">StudyBun AI · {subject_stream}</div>
            <div className="sb-hero-line">I analyzed your study data and found some interesting insights.</div>
          </div>
          <Mascot species={p.mascot} mood="idle" size={84} />
        </Card>
        <Card>
          <div className="sb-lock-screen">
            <Lock size={28} className="sb-lock-icon" />
            <div className="sb-lock-screen-title">AI Insights unlocks at a {unlockAt}-day streak</div>
            <p className="sb-lock-screen-sub">
              This calls a real AI model on your data, so it's reserved for people actually showing up daily —
              not a one-off peek. Keep logging a session every day and it'll unlock automatically.
            </p>
            <ProgressBar pct={((p.streak || 0) / unlockAt) * 100} />
            <div className="sb-lock-screen-count">Current streak: {p.streak || 0} / {unlockAt} days</div>
            <Btn variant="soft" onClick={() => p.setPage("study")}>Log today's session</Btn>
          </div>
        </Card>
      </div>
    );
  }

  const generate = async () => {
    setLoading(true);
    setError(null);
    const snapshot = buildStatsSnapshot(p);
    try {
      const output = await generateAIInsights(snapshot);
      const now = new Date();
      // Persist the current result to Supabase so it's still here next
      // time this page loads — on this device or any other — until it's
      // regenerated. A failed re-run below leaves this untouched.
      await p.saveAiInsights(output, now.toISOString());
      // Also append to the separate history log (unchanged behaviour) —
      // non-blocking, failure here shouldn't hide the result just saved.
      if (user?.id) {
        supabase.from("ai_insights_history").insert({ user_id: user.id, input_snapshot: snapshot, output }).then(({ error: err }) => {
          if (err) console.error("[StudyBun] failed to save AI insight history:", err.message);
        });
      }
    } catch (e) {
      setError(e.message || "Something went wrong generating insights.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sb-page sb-insights-page">
      <Card className="sb-hero">
        <div>
          <div className="sb-hero-greet">StudyBun AI · {subject_stream}</div>
          <div className="sb-hero-line">I analyzed your study data and found some interesting insights.</div>
          {generatedAt && <div className="sb-hero-meta">Generated {generatedAt.toLocaleString()}</div>}
        </div>
        <Mascot species={p.mascot} mood={loading ? "thinking" : "idle"} size={84} />
      </Card>

      {!hasEnoughData && !result && (
        <Card><EmptyState mascot={p.mascot} mood="idle" text="Not much data yet." sub="Log a few study sessions, questions, or a mock first — insights are only useful once there's something real to analyze." /></Card>
      )}

      <Card className="sb-insights-generate">
        <Btn onClick={generate} disabled={loading}>
          {loading ? <><RefreshCw size={16} className="sb-spin" /> Thinking...</> : <><Sparkles size={16} /> {result ? "Re-run AI Insights" : "Generate AI Insights"}</>}
        </Btn>
        <div className="sb-muted" style={{ marginTop: 8, fontSize: 12 }}>
          Only calls Gemini when you click this — never automatically, never in the background.
          {result && <> Saved to your account, so it stays here until you run it again — on this device or any other.</>}
        </div>
      </Card>

      {error && (
        <Card style={{ borderColor: "var(--accent)" }}>
          <SectionTitle icon={AlertTriangle}>Couldn't generate insights</SectionTitle>
          <p className="sb-muted">{error}</p>
        </Card>
      )}

      {result && (
        <>
          <div className="sb-insights-highlights">
            <Card className="sb-insights-highlight good">
              <div className="sb-insights-highlight-head">
                <span className="sb-insights-highlight-icon"><CheckCircle2 size={17} /></span>
                <h3>What's going well</h3>
              </div>
              <ul className="sb-suggestion-list">{(result.going_well || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
            </Card>
            <Card className="sb-insights-highlight warn">
              <div className="sb-insights-highlight-head">
                <span className="sb-insights-highlight-icon"><AlertTriangle size={16} /></span>
                <h3>Needs attention</h3>
              </div>
              <ul className="sb-suggestion-list">{(result.needs_attention || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
            </Card>
          </div>

          <Card className="sb-insights-priorities">
            <SectionTitle icon={Target}>Top priorities</SectionTitle>
            <ol className="sb-insights-priority-list">
              {(result.top_priorities || []).map((x, i) => (
                <li key={i}><span className="sb-insights-priority-num">{i + 1}</span><span>{x}</span></li>
              ))}
            </ol>
          </Card>

          <Card className="sb-insights-trend">
            <SectionTitle icon={TrendingUp}>Performance trend</SectionTitle>
            {trendData.length ? (
              <>
                {(latestPct !== null || bestPct !== null) && (
                  <div className="sb-insights-trend-stats">
                    <div className="sb-mini-stat"><div className="sb-mini-num">{latestPct}%</div><div className="sb-muted">Latest mock</div></div>
                    <div className="sb-mini-stat"><div className="sb-mini-num">{bestPct}%</div><div className="sb-muted">Best mock</div></div>
                    <div className="sb-mini-stat"><div className="sb-mini-num">{p.mocks.length}</div><div className="sb-muted">Mocks logged</div></div>
                  </div>
                )}
                <ResponsiveContainer width="100%" height={190}>
                  <LineChart data={trendData} margin={{ top: 6, right: 14, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--soft)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--muted)" fontSize={11.5} tickLine={false} axisLine={false} padding={{ left: 12, right: 12 }} />
                    <YAxis stroke="var(--muted)" fontSize={11.5} tickLine={false} axisLine={false} unit="%" width={40} />
                    <Tooltip
                      contentStyle={{ borderRadius: 14, border: "1.5px solid var(--mascot-outline)", background: "var(--card-bg, #fff)", fontSize: 12.5, boxShadow: "3px 3px 0 var(--mascot-outline)" }}
                      labelStyle={{ fontWeight: 800, marginBottom: 4 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                    <Line type="monotone" dataKey="NEET UG" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "var(--bg)" }} activeDot={{ r: 6 }} connectNulls />
                    <Line type="monotone" dataKey="Custom / Part" stroke="var(--p3, #8b5cf6)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "var(--bg)" }} activeDot={{ r: 6 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </>
            ) : (
              <EmptyState mascot={p.mascot} mood="idle" text="No mocks logged yet." sub="Log a mock to start tracking your score trend here." />
            )}
            {result.performance_trends && <p className="sb-insights-trend-note">{result.performance_trends}</p>}
          </Card>

          <div className="sb-grid-2">
            <Card><SectionTitle icon={Flame}>Backlog strategy</SectionTitle><p className="sb-insights-copy">{result.backlog_strategy}</p></Card>
            <Card><SectionTitle icon={NotebookPen}>Mock suggestions</SectionTitle><p className="sb-insights-copy">{result.mock_suggestions}</p></Card>
          </div>

          <div className="sb-grid-2">
            <Card><SectionTitle icon={RotateCcw}>Revision advice</SectionTitle><p className="sb-insights-copy">{result.revision_advice}</p></Card>
            <Card>
              <SectionTitle icon={Lightbulb}>Productivity tips</SectionTitle>
              <ul className="sb-suggestion-list">{(result.productivity_tips || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
            </Card>
          </div>

          <Card>
            <SectionTitle icon={BookOpen}>Recommended chapters</SectionTitle>
            <div className="sb-quick-actions">
              {(result.recommended_chapters || []).filter((c) => isPCMB || !mathChaptersSet.has(c)).map((c, i) => (
                <Btn key={i} variant="soft" onClick={() => p.setPage("syllabus")}>{c}</Btn>
              ))}
            </div>
          </Card>

          {result.predictions && (
            <Card>
              <SectionTitle icon={Compass}>Predictions <span className="sb-muted" style={{ fontSize: 11 }}>(estimates, not guarantees)</span></SectionTitle>
              <div className="sb-grid-3">
                <div className="sb-mini-stat"><div className="sb-mini-num" style={{ fontSize: 15 }}>{result.predictions.estimated_syllabus_completion}</div><div className="sb-muted">Syllabus completion</div></div>
                <div className="sb-mini-stat"><div className="sb-mini-num" style={{ fontSize: 15 }}>{result.predictions.estimated_backlog_completion}</div><div className="sb-muted">Backlog completion</div></div>
                <div className="sb-mini-stat"><div className="sb-mini-num" style={{ fontSize: 15, textTransform: "capitalize" }}>{result.predictions.confidence}</div><div className="sb-muted">Confidence</div></div>
              </div>
              <p className="sb-muted" style={{ marginTop: 10, fontSize: 12.5 }}>{result.predictions.reasoning}</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
