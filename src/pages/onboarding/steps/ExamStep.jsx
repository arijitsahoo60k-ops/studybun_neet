import React, { useState } from "react";
import { CalendarDays, Clock, Plus, Trash2, Sparkles } from "lucide-react";
import { computeExamCountdown, NEET_PRESET_DATES, DEFAULT_NEET_DATE, DEFAULT_NEET_TIME } from "../../../lib/examTracker";
import { Btn } from "../../../components/ui";

export default function ExamStep({ form, setForm }) {
  const isCustomPrimary = form.exam_mode === "custom" || (form.exam && form.exam !== "NEET UG" && !form.exam.startsWith("NEET"));
  const [showAddTracker, setShowAddTracker] = useState(false);
  const [trackerName, setTrackerName] = useState("");
  const [trackerDate, setTrackerDate] = useState("");
  const [trackerTime, setTrackerTime] = useState("14:00");

  const countdown = computeExamCountdown(form.exam_date || DEFAULT_NEET_DATE, form.exam_time || DEFAULT_NEET_TIME);
  const customExams = Array.isArray(form.custom_exams) ? form.custom_exams : [];

  const selectPrimaryMode = (mode) => {
    if (mode === "neet") {
      setForm((f) => ({
        ...f,
        exam_mode: "neet",
        exam: "NEET UG",
        exam_date: f.exam_date || DEFAULT_NEET_DATE,
        exam_time: f.exam_time || DEFAULT_NEET_TIME,
      }));
    } else {
      setForm((f) => ({
        ...f,
        exam_mode: "custom",
        exam: f.exam === "NEET UG" ? "Custom Exam" : (f.exam || "Custom Exam"),
        exam_time: f.exam_time || "09:00",
      }));
    }
  };

  const addCustomTracker = () => {
    if (!trackerName.trim() || !trackerDate) return;
    const item = {
      id: `ce_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: trackerName.trim(),
      date: trackerDate,
      time: trackerTime || "14:00",
    };
    setForm((f) => ({
      ...f,
      custom_exams: [...(Array.isArray(f.custom_exams) ? f.custom_exams : []), item],
    }));
    setTrackerName("");
    setTrackerDate("");
    setTrackerTime("14:00");
    setShowAddTracker(false);
  };

  const removeCustomTracker = (id) => {
    setForm((f) => ({
      ...f,
      custom_exams: (f.custom_exams || []).filter((x) => x.id !== id),
    }));
  };

  return (
    <>
      <div className="sb-flow-step-head">
        <span className="sb-flow-step-icon">🎯</span>
        <label>Primary Exam Tracker</label>
      </div>
      <div className="sb-chip-row" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className={`sb-chip ${!isCustomPrimary ? "active" : ""}`}
          onClick={() => selectPrimaryMode("neet")}
        >
          🩺 NEET Date Tracker
        </button>
        <button
          type="button"
          className={`sb-chip ${isCustomPrimary ? "active" : ""}`}
          onClick={() => selectPrimaryMode("custom")}
        >
          ⏱️ Custom Exam Tracker
        </button>
      </div>

      {!isCustomPrimary ? (
        <div>
          <div className="sb-chip-row" style={{ marginBottom: 10 }}>
            {NEET_PRESET_DATES.map((p) => (
              <button
                key={p.label}
                type="button"
                className={`sb-chip small ${form.exam_date === p.date ? "active" : ""}`}
                onClick={() => setForm((f) => ({ ...f, exam: p.exam, exam_date: p.date, exam_time: p.time }))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--muted)", marginBottom: 5 }}>
            Custom exam name
          </label>
          <input
            className="sb-input"
            placeholder="e.g. AIIMS Paramedical, Allen Major Test, Boards..."
            value={form.exam}
            onChange={(e) => setForm((f) => ({ ...f, exam: e.target.value }))}
          />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 10, marginTop: 8 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--muted)", marginBottom: 5 }}>
            Exam date
          </label>
          <div className="sb-ob-input-icon-wrap">
            <CalendarDays size={15} />
            <input
              type="date"
              className="sb-input"
              value={form.exam_date}
              onChange={(e) => setForm((f) => ({ ...f, exam_date: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--muted)", marginBottom: 5 }}>
            Exam time (IST)
          </label>
          <div className="sb-ob-input-icon-wrap">
            <Clock size={15} />
            <input
              type="time"
              className="sb-input"
              value={form.exam_time || DEFAULT_NEET_TIME}
              onChange={(e) => setForm((f) => ({ ...f, exam_time: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {countdown.valid && (
        <div className="sb-ob-exam-days" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", width: "100%", marginTop: 10 }}>
          <span>🐾 <b>{countdown.calendarDays}d {countdown.hours}h {countdown.minutes}m</b> left</span>
          <span style={{ opacity: 0.8 }}>{countdown.formattedDate} · {countdown.formattedTime}</span>
        </div>
      )}

      {/* Additional Custom Exam / Test Time Trackers */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1.5px dashed var(--outline)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 5 }}>
            <Sparkles size={13} style={{ color: "var(--accent)" }} /> Additional Custom Exam Trackers ({customExams.length})
          </span>
          {!showAddTracker && (
            <button
              type="button"
              className="sb-chip small"
              onClick={() => setShowAddTracker(true)}
            >
              <Plus size={11} style={{ marginRight: 3, verticalAlign: -1 }} /> Add tracker
            </button>
          )}
        </div>

        {customExams.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
            {customExams.map((ce) => {
              const cd = computeExamCountdown(ce.date, ce.time);
              return (
                <div
                  key={ce.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 10px",
                    borderRadius: 12,
                    background: "var(--card)",
                    border: "1.5px solid var(--outline)",
                    fontSize: 11.5,
                  }}
                >
                  <div>
                    <b style={{ color: "var(--ink)" }}>{ce.name}</b>
                    <div style={{ color: "var(--muted)", fontSize: 10.5 }}>
                      {cd.formattedDate} · {cd.formattedTime} ({cd.calendarDays}d {cd.hours}h left)
                    </div>
                  </div>
                  <button
                    type="button"
                    className="sb-icon-btn danger"
                    onClick={() => removeCustomTracker(ce.id)}
                    title="Remove tracker"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {showAddTracker && (
          <div style={{ padding: 10, borderRadius: 14, background: "var(--soft)", border: "1.5px solid var(--outline)" }}>
            <input
              className="sb-input small"
              placeholder="Exam / Test name (e.g. AIATS Minor 2, Boards)"
              value={trackerName}
              onChange={(e) => setTrackerName(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 8, marginBottom: 8 }}>
              <input type="date" className="sb-input small" value={trackerDate} onChange={(e) => setTrackerDate(e.target.value)} />
              <input type="time" className="sb-input small" value={trackerTime} onChange={(e) => setTrackerTime(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setShowAddTracker(false)}>Cancel</Btn>
              <Btn onClick={addCustomTracker} disabled={!trackerName.trim() || !trackerDate}>Add</Btn>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
