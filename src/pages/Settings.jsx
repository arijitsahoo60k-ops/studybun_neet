import React, { useEffect, useRef, useState } from "react";
import { Settings, Sparkles, Rabbit, LogOut, UserCircle, GraduationCap, CheckCircle2, Circle, Download, Upload, DatabaseBackup, BookOpen, Moon, Sun, CalendarClock, Plus, Trash2 } from "lucide-react";
import { Card, SectionTitle, Btn } from "../components/ui";
import Mascot from "../components/Mascot";
import { THEMES, readStoredDarkMode, writeStoredDarkMode } from "../data/themes";
import { pickableMascots, exclusiveMascotLabel } from "../data/mascots";
import { useIsFounder } from "../hooks/useIsFounder";
import { useIsModerator } from "../hooks/useIsModerator";
import { useAuth } from "../lib/AuthContext";
import { getCachedAIStatus, fetchAIStatus, getModelPreference, setModelPreference } from "../services/buddyKeyManager";
import { MODEL_FAMILIES } from "../services/geminiModels";
import { resolveProfileConfig, computeExamCountdown, NEET_PRESET_DATES, DEFAULT_NEET_TIME } from "../lib/examTracker";
import FeatureGuideGrid from "./settings/FeatureGuideGrid";
import SmartNotificationsCard from "../components/SmartNotificationsCard";
import BackgroundCard from "./settings/BackgroundCard";

function SmartBuddyCard() {
  const [ready, setReady] = useState(() => getCachedAIStatus().geminiReady);
  const [modelPref, setModelPrefState] = useState(getModelPreference());

  useEffect(() => {
    fetchAIStatus().then((s) => setReady(s.geminiReady));
  }, []);

  const onModelPref = (val) => { setModelPreference(val); setModelPrefState(val); };

  return (
    <Card>
      <SectionTitle icon={GraduationCap}>Smart Study Buddy (AI)</SectionTitle>
      <div className="sb-buddy-status-row">
        {ready ? <CheckCircle2 size={16} color="#6fcf8f" /> : <Circle size={16} className="sb-muted" />}
        <span>{ready ? "Smart chat is ready" : "Smart chat isn't set up yet"}</span>
      </div>
      <p className="sb-muted" style={{ fontSize: 12.5, marginTop: 6, marginBottom: 16 }}>
        {ready
          ? "Your buddy can chat as your NEET instructor, grounded in your real study data."
          : "The app owner needs to configure this — it's not something you set up here."}
      </p>

      <div>
        <label>Model preference</label>
        <select className="sb-input" value={modelPref} onChange={(e) => onModelPref(e.target.value)}>
          {Object.entries(MODEL_FAMILIES).map(([id, f]) => <option key={id} value={id}>{f.label}</option>)}
        </select>
        <div className="sb-muted" style={{ fontSize: 11.5, marginTop: 4 }}>
          Auto tries the newest Gemini models first, falling back automatically if one isn't available.
        </div>
      </div>
    </Card>
  );
}

function DataBackupCard({ exportBackup, importBackup }) {
  const fileInputRef = useRef(null);
  const [applyProfile, setApplyProfile] = useState(true);
  const [importing, setImporting] = useState(false);

  const pickFile = () => fileInputRef.current?.click();

  const onFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ok = window.confirm(
      "Import this backup? Records in the file will be added to your account (existing data stays put — nothing gets deleted)."
    );
    if (!ok) return;
    setImporting(true);
    await importBackup(file, { applyProfile });
    setImporting(false);
  };

  return (
    <Card>
      <SectionTitle icon={DatabaseBackup}>Data backup</SectionTitle>
      <p className="sb-muted" style={{ fontSize: 12.5, marginTop: 2, marginBottom: 14 }}>
        Export your entire study history — sessions, questions, mocks, tasks, revisions, backlog, and badges — as one
        JSON file. Import it later to restore, or move it to another account. Importing only adds records; it never
        deletes anything.
      </p>
      <div className="sb-backup-actions">
        <Btn onClick={exportBackup}><Download size={15} style={{ marginRight: 6, verticalAlign: "-2px" }} />Export as JSON</Btn>
        <Btn variant="ghost" onClick={pickFile} disabled={importing}>
          <Upload size={15} style={{ marginRight: 6, verticalAlign: "-2px" }} />{importing ? "Importing…" : "Import JSON"}
        </Btn>
        <input ref={fileInputRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={onFileChosen} />
      </div>
      <label className="sb-backup-checkbox">
        <input type="checkbox" checked={applyProfile} onChange={(e) => setApplyProfile(e.target.checked)} />
        Also restore name, exam date, subject stream, theme & mascot from the file
      </label>
    </Card>
  );
}

const TABS = [
  { id: "profile", emoji: "👤", label: "Profile & exam tracker", sub: "Subjects, NEET & custom exams" },
  { id: "look", emoji: "🎀", label: "Mascot & theme", sub: "Make it yours" },
  { id: "background", emoji: "🖼️", label: "Custom background", sub: "Paste your own image" },
  { id: "buddy", emoji: "🧠", label: "AI study buddy", sub: "Smart chat setup" },
  { id: "notify", emoji: "🔔", label: "Smart notifications", sub: "3x/day AI pushes" },
  { id: "data", emoji: "💾", label: "Data & backup", sub: "Export / import" },
  { id: "guide", emoji: "📖", label: "How it works", sub: "Every feature, explained" },
];

export default function SettingsPage(p) {
  const { profile, saveProfile, exportBackup, importBackup, darkMode: darkModeProp, setDarkMode } = p;
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState("profile");
  const isFounder = useIsFounder();
  const isModerator = useIsModerator();

  const cfg = resolveProfileConfig(profile);
  const [customExamInput, setCustomExamInput] = useState(cfg.isCustomPrimary ? cfg.exam : "");
  const [newTrackerName, setNewTrackerName] = useState("");
  const [newTrackerDate, setNewTrackerDate] = useState("");
  const [newTrackerTime, setNewTrackerTime] = useState("14:00");

  const isDark = typeof darkModeProp === "boolean"
    ? darkModeProp
    : (typeof profile?.dark_mode === "boolean" ? profile.dark_mode : readStoredDarkMode(false));

  const chooseDarkMode = (nextDark) => {
    const val = Boolean(nextDark);
    writeStoredDarkMode(val);
    if (typeof setDarkMode === "function") {
      setDarkMode(val);
    } else {
      saveProfile({ dark_mode: val });
    }
  };

  const addCustomTracker = () => {
    if (!newTrackerName.trim() || !newTrackerDate) return;
    const item = {
      id: `ce_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: newTrackerName.trim(),
      date: newTrackerDate,
      time: newTrackerTime || "14:00",
    };
    saveProfile({ custom_exams: [...(cfg.custom_exams || []), item] });
    setNewTrackerName("");
    setNewTrackerDate("");
    setNewTrackerTime("14:00");
  };

  const removeCustomTracker = (id) => {
    saveProfile({ custom_exams: (cfg.custom_exams || []).filter((x) => x.id !== id) });
  };

  return (
    <div className="sb-page">
      <div className="sb-settings-shell">
        <nav className="sb-settings-nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`sb-settings-nav-item ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="sb-settings-nav-icon">{t.emoji}</span>
              <span className="sb-settings-nav-text">
                <span className="sb-settings-nav-label">{t.label}</span>
                <span className="sb-settings-nav-sub">{t.sub}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="sb-settings-content" key={tab}>
          {tab === "profile" && (
            <>
              {user && (
                <Card>
                  <SectionTitle icon={UserCircle}>Account</SectionTitle>
                  <div className="sb-form-grid">
                    <div><label>Signed in as</label><input className="sb-input" value={user.email || ""} disabled /></div>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <Btn variant="ghost" onClick={signOut}><LogOut size={15} style={{ marginRight: 6, verticalAlign: "-2px" }} />Sign out</Btn>
                  </div>
                </Card>
              )}

              <Card>
                <SectionTitle icon={Settings}>Profile & Subject Stream</SectionTitle>
                <div className="sb-form-grid">
                  <div><label>Name</label><input className="sb-input" defaultValue={profile.name} onBlur={(e) => saveProfile({ name: e.target.value })} /></div>
                  <div><label>Daily goal (hours)</label><input type="number" className="sb-input" defaultValue={profile.daily_goal} onBlur={(e) => saveProfile({ daily_goal: +e.target.value })} /></div>
                  <div><label>Daily question target</label><input type="number" min="1" className="sb-input" defaultValue={profile.daily_question_target} onBlur={(e) => saveProfile({ daily_question_target: Math.max(1, +e.target.value || 1) })} /></div>
                  <div>
                    <label>Subjects choice (Stream)</label>
                    <select
                      className="sb-input"
                      value={cfg.subject_stream}
                      onChange={(e) => saveProfile({ subject_stream: e.target.value })}
                    >
                      <option value="PCB">PCB (Physics · Chemistry · Biology)</option>
                      <option value="PCMB">PCMB (Physics · Chemistry · Maths · Biology)</option>
                    </select>
                  </div>
                </div>
              </Card>

              <Card>
                <SectionTitle icon={CalendarClock}>NEET & Custom Exam Time Tracker</SectionTitle>
                <p className="sb-muted" style={{ fontSize: 12.5, marginTop: -4, marginBottom: 12 }}>
                  Configure your primary target exam countdown (NEET UG or a Custom Exam) with exact date and IST time, plus track additional coaching or board exams.
                </p>

                <div className="sb-chip-row" style={{ marginBottom: 12 }}>
                  <button
                    type="button"
                    className={`sb-chip ${!cfg.isCustomPrimary ? "active" : ""}`}
                    onClick={() => saveProfile({ exam: "NEET UG" })}
                  >
                    🩺 NEET UG Tracker
                  </button>
                  <button
                    type="button"
                    className={`sb-chip ${cfg.isCustomPrimary ? "active" : ""}`}
                    onClick={() => {
                      const nextName = customExamInput.trim() || "Custom Exam";
                      setCustomExamInput(nextName);
                      saveProfile({ exam: nextName });
                    }}
                  >
                    ⏱️ Custom Primary Exam
                  </button>
                  {NEET_PRESET_DATES.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className={`sb-chip small ${cfg.exam === preset.exam && cfg.exam_date === preset.date ? "active" : ""}`}
                      onClick={() => saveProfile({ exam: preset.exam, exam_date: preset.date, exam_time: preset.time })}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="sb-form-grid">
                  {cfg.isCustomPrimary && (
                    <div>
                      <label>Custom Exam Name</label>
                      <input
                        className="sb-input"
                        value={customExamInput}
                        onChange={(e) => setCustomExamInput(e.target.value)}
                        onBlur={(e) => {
                          if (e.target.value.trim()) saveProfile({ exam: e.target.value.trim() });
                        }}
                        placeholder="e.g. AIIMS Paramedical, CUET UG..."
                      />
                    </div>
                  )}
                  <div>
                    <label>Exam date</label>
                    <input
                      type="date"
                      className="sb-input"
                      value={cfg.exam_date}
                      onChange={(e) => saveProfile({ exam_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label>Exam start time (IST)</label>
                    <input
                      type="time"
                      className="sb-input"
                      value={cfg.exam_time || DEFAULT_NEET_TIME}
                      onChange={(e) => saveProfile({ exam_time: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1.5px dashed var(--mascot-outline)" }}>
                  <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Additional Custom Exam Trackers</div>
                  <div className="sb-form-grid dense">
                    <div>
                      <label>Exam / Test name</label>
                      <input
                        className="sb-input small"
                        placeholder="e.g. NEET Full Syllabus Mock 4 / AIATS"
                        value={newTrackerName}
                        onChange={(e) => setNewTrackerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label>Date</label>
                      <input
                        type="date"
                        className="sb-input small"
                        value={newTrackerDate}
                        onChange={(e) => setNewTrackerDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label>Time (IST)</label>
                      <input
                        type="time"
                        className="sb-input small"
                        value={newTrackerTime}
                        onChange={(e) => setNewTrackerTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <Btn onClick={addCustomTracker} disabled={!newTrackerName.trim() || !newTrackerDate}>
                    <Plus size={15} /> Add custom exam tracker
                  </Btn>

                  {(cfg.custom_exams || []).length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                      {cfg.custom_exams.map((ce) => {
                        const cd = computeExamCountdown(ce.date, ce.time);
                        return (
                          <div
                            key={ce.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 12px",
                              borderRadius: 12,
                              background: "var(--bg)",
                              border: "1.5px solid var(--mascot-outline)",
                            }}
                          >
                            <div>
                              <b>{ce.name}</b>
                              <div className="sb-muted small">{cd.formattedDate} · {cd.formattedTime}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className="sb-chip small" style={{ boxShadow: "none", cursor: "default" }}>
                                {cd.isPast ? "Completed" : `${cd.calendarDays}d ${cd.hours}h left`}
                              </span>
                              <button
                                type="button"
                                className="sb-icon-btn danger"
                                onClick={() => removeCustomTracker(ce.id)}
                                title="Delete tracker"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}

          {tab === "look" && (
            <>
              <Card>
                <SectionTitle icon={isDark ? Moon : Sun}>Appearance</SectionTitle>
                <p className="sb-muted" style={{ fontSize: 12.5, marginTop: -2, marginBottom: 14 }}>
                  Switch between warm daylight paper and sculpted dark claymorphism. Your active theme palette adapts automatically.
                </p>
                <div className="sb-appearance-mode-grid" role="radiogroup" aria-label="Appearance mode">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!isDark}
                    className={`sb-appearance-mode-option ${!isDark ? "active" : ""}`}
                    onClick={() => chooseDarkMode(false)}
                  >
                    <span className="sb-appearance-mode-icon"><Sun size={18} /></span>
                    <span className="sb-appearance-mode-copy">
                      <span className="sb-appearance-mode-title">Light mode</span>
                      <span className="sb-appearance-mode-sub">Warm cream canvas & playful sticker outlines</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isDark}
                    className={`sb-appearance-mode-option ${isDark ? "active" : ""}`}
                    onClick={() => chooseDarkMode(true)}
                  >
                    <span className="sb-appearance-mode-icon"><Moon size={18} /></span>
                    <span className="sb-appearance-mode-copy">
                      <span className="sb-appearance-mode-title">Dark mode</span>
                      <span className="sb-appearance-mode-sub">Deep charcoal canvas & tactile clay surfaces</span>
                    </span>
                  </button>
                </div>
              </Card>

              <Card>
                <SectionTitle icon={Rabbit}>Mascot</SectionTitle>
                <div className="sb-mascot-grid">
                  {pickableMascots({ isFounder, isModerator }, profile.mascot).map(([id, m]) => (
                    <button key={id} className={`sb-mascot-pick ${profile.mascot === id ? "active" : ""} ${m.exclusive ? "exclusive" : ""}`} onClick={() => saveProfile({ mascot: id })}>
                      {m.exclusive && <span className="sb-mascot-crown" title={exclusiveMascotLabel(id)}>👑</span>}
                      <Mascot species={id} mood="happy" size={54} />
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <SectionTitle icon={Sparkles}>Theme</SectionTitle>
                <div className="sb-theme-grid">
                  {Object.entries(THEMES).map(([name, val]) => (
                    <button key={name} className={`sb-theme-swatch ${profile.theme === name ? "active" : ""}`}
                      style={{ background: val.soft, borderColor: val.accent, "--swatch-accent": val.accent, "--swatch-soft": val.soft, "--swatch-ink": val.ink }}
                      onClick={() => saveProfile({ theme: name })}>
                      <span style={{ background: val.accent }} className="sb-theme-dot" />{val.emoji} {name}
                    </button>
                  ))}
                </div>
              </Card>
            </>
          )}

          {tab === "background" && <BackgroundCard currentTheme={THEMES[profile.theme]} />}

          {tab === "buddy" && <SmartBuddyCard />}

          {tab === "notify" && <SmartNotificationsCard />}

          {tab === "data" && <DataBackupCard exportBackup={exportBackup} importBackup={importBackup} />}

          {tab === "guide" && (
            <Card>
              <SectionTitle icon={BookOpen}>How StudyBun NEET works</SectionTitle>
              <p className="sb-muted" style={{ fontSize: 12.5, marginTop: -4, marginBottom: 14 }}>
                Tap any feature to see exactly what it does and how it syncs.
              </p>
              <FeatureGuideGrid />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
