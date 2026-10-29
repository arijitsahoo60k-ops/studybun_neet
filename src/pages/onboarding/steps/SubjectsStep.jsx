import React from "react";
import { Dna, Atom, FlaskConical, Calculator, CheckCircle2 } from "lucide-react";

const STREAM_OPTIONS = [
  {
    id: "PCB",
    title: "PCB (Physics · Chemistry · Biology)",
    badge: "NEET Standard",
    desc: "Core medical stream — Biology classified into Botany (17 ch) & Zoology (15 ch), plus Physics & Chemistry.",
    subjects: [
      { name: "Biology (Botany + Zoology)", icon: Dna, color: "#C43668", detail: "32 chapters · 360 marks" },
      { name: "Physics", icon: Atom, color: "#2F62C7", detail: "31 chapters · 180 marks" },
      { name: "Chemistry (PC · IOC · OC)", icon: FlaskConical, color: "#2E9955", detail: "33 chapters · 180 marks" },
    ],
  },
  {
    id: "PCMB",
    title: "PCMB (Physics · Chemistry · Maths · Biology)",
    badge: "Dual Stream",
    desc: "For students taking both Biology and Mathematics — unlocks Maths across Syllabus, Tracker, Practice & Mocks.",
    subjects: [
      { name: "Biology (Botany + Zoology)", icon: Dna, color: "#C43668", detail: "32 chapters · 360 marks" },
      { name: "Physics", icon: Atom, color: "#2F62C7", detail: "31 chapters · 180 marks" },
      { name: "Chemistry (PC · IOC · OC)", icon: FlaskConical, color: "#2E9955", detail: "33 chapters · 180 marks" },
      { name: "Mathematics", icon: Calculator, color: "#7C3FD6", detail: "35 chapters · Full syllabus" },
    ],
  },
];

export default function SubjectsStep({ form, setForm }) {
  const current = form.subject_stream === "PCMB" ? "PCMB" : "PCB";

  return (
    <div>
      <div className="sb-flow-step-head">
        <span className="sb-flow-step-icon">🧬</span>
        <label>Subjects choice (PCB or PCMB)</label>
      </div>
      <p className="sb-ob-hint" style={{ marginTop: -6, marginBottom: 12 }}>
        Some NEET aspirants take PCB while others have PCMB — pick your stream so your syllabus, trackers, and mocks match your subjects.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {STREAM_OPTIONS.map((opt) => {
          const active = current === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setForm((f) => ({ ...f, subject_stream: opt.id }))}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: 18,
                border: `2.5px solid ${active ? "var(--accent)" : "var(--outline)"}`,
                background: active ? "var(--soft)" : "var(--card)",
                boxShadow: "3px 3px 0 var(--sticker-shadow, var(--outline))",
                cursor: "pointer",
                transition: "transform 0.15s ease, background 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                  {active && <CheckCircle2 size={15} style={{ color: "var(--accent)" }} />}
                  {opt.title}
                </span>
                <span className="sb-chip small" style={{ padding: "2px 8px", fontSize: 10.5, boxShadow: "none" }}>
                  {opt.badge}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, lineHeight: 1.4, marginBottom: 8 }}>
                {opt.desc}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {opt.subjects.map((s) => {
                  const Icon = s.icon;
                  return (
                    <span
                      key={s.name}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 10.5,
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: "var(--card)",
                        border: "1.5px solid var(--outline)",
                        color: s.color,
                      }}
                    >
                      <Icon size={11} /> {s.name}
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
