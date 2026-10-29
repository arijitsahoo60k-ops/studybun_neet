import React, { useMemo } from "react";
import { TrendingUp, Library, Dna } from "lucide-react";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { Card, SectionTitle, ProgressBar } from "../components/ui";
import { SYLLABUS, BIOLOGY_BRANCHES, getActiveSyllabus, getActiveSubjects, normalizeStream } from "../data/syllabus";

export default function AnalyticsPage(p) {
  const subject_stream = normalizeStream(p.profile?.subject_stream || p.profile);
  const isPCMB = subject_stream === "PCMB";
  const activeSubjects = useMemo(() => p.activeSubjects || getActiveSubjects(p.profile), [p.activeSubjects, p.profile]);
  const activeSyllabus = useMemo(() => getActiveSyllabus(p.profile), [p.profile]);

  const radarData = useMemo(() => activeSubjects.map((s) => {
    const subjObj = activeSyllabus[s] || SYLLABUS[s];
    const chs = subjObj ? Object.values(subjObj.groups).flat() : [];
    const done = chs.filter((c) => ["Completed", "Mastered"].includes(p.getChStatus(`${s}::${c}`).status)).length;
    return { subject: s, completion: chs.length ? Math.round((done / chs.length) * 100) : 0 };
  }), [activeSubjects, activeSyllabus, p.getChStatus]);

  const bioBranches = useMemo(() => {
    const groups = SYLLABUS.Biology.groups;
    return Object.entries(groups).map(([branch, chs]) => {
      const done = chs.filter((c) => ["Completed", "Mastered"].includes(p.getChStatus(`Biology::${c}`).status)).length;
      const pct = chs.length ? Math.round((done / chs.length) * 100) : 0;
      return { branch, total: chs.length, done, pct, meta: BIOLOGY_BRANCHES[branch] };
    });
  }, [p.getChStatus]);

  return (
    <div className="sb-page">
      <div className="sb-grid-2">
        <Card>
          <SectionTitle icon={TrendingUp}>Weekly study hours</SectionTitle>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={p.weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--soft)" />
              <XAxis dataKey="day" stroke="var(--muted)" fontSize={12} />
              <YAxis stroke="var(--muted)" fontSize={12} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none" }} />
              <Legend wrapperStyle={{ fontSize: 11.5 }} />
              <Line type="monotone" dataKey="hours" name="Logged" stroke="var(--accent)" strokeWidth={3} />
              <Line type="monotone" dataKey="timerHours" name="Focus Timer" stroke="var(--chart-secondary, var(--outline))" strokeWidth={3} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionTitle icon={Library}>Syllabus completion ({isPCMB ? "PCMB" : "PCB"})</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--soft)" />
              <PolarAngleAxis dataKey="subject" stroke="var(--muted)" fontSize={12} />
              <Radar dataKey="completion" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.35} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none" }} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <SectionTitle icon={Dna}>NEET Biology Sub-Discipline Split (Botany 180 · Zoology 180)</SectionTitle>
        <div className="sb-grid-2">
          {bioBranches.map((b) => (
            <div key={b.branch} style={{ padding: "10px 12px", borderRadius: 14, background: "var(--bg)", border: "1.5px solid var(--mascot-outline)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontWeight: 800, fontSize: 13 }}>
                <span style={{ color: b.meta?.color }}>{b.branch === "Botany" ? "🌱" : "🧬"} {b.branch} ({b.meta?.short})</span>
                <span className="sb-muted">{b.done}/{b.total} chapters ({b.pct}%)</span>
              </div>
              <ProgressBar pct={b.pct} color={b.meta?.color} />
            </div>
          ))}
        </div>
      </Card>

      <div className="sb-grid-3">
        <Card><div className="sb-mini-stat"><div className="sb-mini-num">{p.overallPct.toFixed(0)}%</div><div className="sb-muted">Overall completion ({subject_stream})</div></div></Card>
        <Card><div className="sb-mini-stat"><div className="sb-mini-num">{p.totalQuestions}</div><div className="sb-muted">Lifetime questions</div></div></Card>
        <Card><div className="sb-mini-stat"><div className="sb-mini-num">{p.mocks.length}</div><div className="sb-muted">Mocks attempted</div></div></Card>
      </div>
    </div>
  );
}
