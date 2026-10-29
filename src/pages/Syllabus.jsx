import React, { useMemo, useState } from "react";
import { Search, Star, Library, Sparkles, Lock, Atom, FlaskConical, Calculator, Dna, CheckCircle2, X, Flame, Info } from "lucide-react";
import { Card, ProgressBar, ProgressRing, SectionTitle, EmptyState } from "../components/ui";
import {
  SYLLABUS,
  CHEMISTRY_BRANCHES,
  BIOLOGY_BRANCHES,
  BIOLOGY_CHAPTER_META,
  BIOLOGY_HIGH_YIELD,
  getActiveSyllabus,
  getActiveChapters,
} from "../data/syllabus";
import { computeChapterPriority } from "../lib/priorityEngine";

const tierSlug = (tier) => tier.toLowerCase().replace(/\s+/g, "-");
const DONE_STATUSES = ["Completed", "Mastered"];
const SUBJECT_ICON = { Biology: Dna, Physics: Atom, Chemistry: FlaskConical, Mathematics: Calculator };

const questionsCountFor = (questions, subject, chapterName) =>
  (questions || [])
    .filter((q) => q.subject === subject && q.chapter === chapterName)
    .reduce((a, q) => a + Number(q.count || 0), 0);

const readinessMessage = (pct) => {
  if (pct >= 100) return "Full syllabus cleared — incredible work, future doctor! 🩺🎉";
  if (pct >= 80) return "So close now — finish the line!";
  if (pct >= 50) return "Past the halfway mark, keep the NCERT pace up.";
  if (pct >= 20) return "Good start — pick your next chapter below.";
  return "Every NEET topper started at 0% — let's begin.";
};

export default function SyllabusPage(p) {
  const activeSyllabus = useMemo(() => getActiveSyllabus(p.profile), [p.profile]);
  const activeChapters = useMemo(() => getActiveChapters(p.profile), [p.profile]);
  const activeSubjectKeys = useMemo(() => Object.keys(activeSyllabus), [activeSyllabus]);

  const [openSubject, setOpenSubject] = useState(() => (activeSyllabus.Biology ? "Biology" : activeSubjectKeys[0] || "Biology"));
  const safeOpenSubject = activeSyllabus[openSubject] ? openSubject : (activeSubjectKeys[0] || "Biology");

  const [filter, setFilter] = useState("All");
  const [chemBranch, setChemBranch] = useState("All");
  const [bioBranch, setBioBranch] = useState("All");
  const [bioClassFilter, setBioClassFilter] = useState("All");
  const [showBioGuide, setShowBioGuide] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [dismissedNudges, setDismissedNudges] = useState(() => new Set());

  const { totalChapters, completedChapters, masteredChapters, studyingChapters, overallPct } = useMemo(() => {
    const total = activeChapters.length;
    const completed = activeChapters.filter((c) => DONE_STATUSES.includes(p.getChStatus(c.key).status)).length;
    const mastered = activeChapters.filter((c) => p.getChStatus(c.key).status === "Mastered").length;
    const studying = activeChapters.filter((c) => p.getChStatus(c.key).status === "Studying").length;
    return {
      totalChapters: total,
      completedChapters: completed,
      masteredChapters: mastered,
      studyingChapters: studying,
      overallPct: total ? (completed / total) * 100 : 0,
    };
  }, [activeChapters, p.getChStatus]);

  const markCompleteNow = (subject, name, key) => p.completeChapter({ subject, name, key });
  const dismissNudge = (key) => setDismissedNudges((prev) => new Set(prev).add(key));

  const nudges = useMemo(() => activeChapters.filter((c) => {
    if (dismissedNudges.has(c.key)) return false;
    const st = p.getChStatus(c.key);
    if (DONE_STATUSES.includes(st.status)) return false;
    const lecturesFinished = Number(st.lectures_total) > 0 && Number(st.lectures_done) >= Number(st.lectures_total);
    const wellPracticed = questionsCountFor(p.questions, c.subject, c.name) >= 15;
    return lecturesFinished || wellPracticed;
  }).slice(0, 4), [activeChapters, p.getChStatus, p.questions, dismissedNudges]);

  const subjectSummaries = useMemo(() => Object.entries(activeSyllabus).map(([subject, data]) => {
    const chs = Object.values(data.groups).flat();
    const done = chs.filter((c) => DONE_STATUSES.includes(p.getChStatus(`${subject}::${c}`).status)).length;
    const mastered = chs.filter((c) => p.getChStatus(`${subject}::${c}`).status === "Mastered").length;
    const questionsSolved = p.questions.filter((q) => q.subject === subject).reduce((a, q) => a + Number(q.count || 0), 0);
    const criticalCount = chs.filter((c) => {
      const t = computeChapterPriority(
        { subject, chapter: c, ...p.getChStatus(`${subject}::${c}`) },
        { getChStatus: p.getChStatus, questions: p.questions }
      ).tier;
      return t === "Critical";
    }).length;
    return { subject, data, chs, done, mastered, questionsSolved, pct: (done / chs.length) * 100, criticalCount };
  }), [activeSyllabus, p.getChStatus, p.questions]);

  const openSubjectMetas = useMemo(() => {
    const map = {};
    const subjData = SYLLABUS[safeOpenSubject] || SYLLABUS.Biology;
    Object.values(subjData.groups).flat().forEach((c) => {
      const key = `${safeOpenSubject}::${c}`;
      const st = p.getChStatus(key);
      const auto = computeChapterPriority({ subject: safeOpenSubject, chapter: c, ...st }, { getChStatus: p.getChStatus, questions: p.questions });
      map[c] = { key, st, auto };
    });
    return map;
  }, [safeOpenSubject, p.getChStatus, p.questions]);

  return (
    <div className="sb-page">
      <Card className="sb-syllabus-hero">
        <ProgressRing pct={overallPct} size={92} stroke={10} />
        <div className="sb-syllabus-hero-body">
          <div className="sb-syllabus-hero-title">Syllabus progress ({activeSubjectKeys.length === 4 ? "PCMB" : "PCB"})</div>
          <div className="sb-syllabus-hero-msg">{readinessMessage(overallPct)}</div>
          <div className="sb-syllabus-hero-stats">
            <span><strong>{completedChapters}</strong>/{totalChapters} chapters done</span>
            <span>·</span>
            <span><Flame size={12} /> {studyingChapters} in progress</span>
            <span>·</span>
            <span>⭐ {masteredChapters} mastered</span>
          </div>
        </div>
      </Card>

      {nudges.length > 0 && (
        <Card className="sb-nudge-banner">
          <SectionTitle icon={CheckCircle2}>Looks finished — mark it complete?</SectionTitle>
          <div className="sb-nudge-list">
            {nudges.map((c) => {
              const st = p.getChStatus(c.key);
              const lecturesFinished = Number(st.lectures_total) > 0 && Number(st.lectures_done) >= Number(st.lectures_total);
              return (
                <div key={c.key} className="sb-nudge-card">
                  <div>
                    <div className="sb-nudge-card-name">{c.name}</div>
                    <div className="sb-nudge-card-reason">
                      {lecturesFinished ? `All ${st.lectures_total} lectures logged` : "Well-practiced with questions"} · {c.subject}
                    </div>
                  </div>
                  <div className="sb-nudge-card-actions">
                    <button className="sb-mini-action" onClick={() => markCompleteNow(c.subject, c.name, c.key)}>
                      <CheckCircle2 size={12} /> Mark complete
                    </button>
                    <button className="sb-nudge-dismiss" onClick={() => dismissNudge(c.key)} aria-label="Not yet, dismiss">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className={subjectSummaries.length === 4 ? "sb-grid-4" : "sb-grid-3"}>
        {subjectSummaries.map(({ subject, data, chs, done, mastered, questionsSolved, pct, criticalCount }) => {
          const Icon = SUBJECT_ICON[subject] || Library;
          const branchLookup = subject === "Biology" ? BIOLOGY_BRANCHES : subject === "Chemistry" ? CHEMISTRY_BRANCHES : null;
          return (
            <Card
              key={subject}
              className={`sb-clickable ${safeOpenSubject === subject ? "sb-card-active" : ""}`}
              style={{ borderLeft: `5px solid ${data.color}` }}
              onClick={() => setOpenSubject(subject)}
            >
              <div className="sb-subject-head">
                <span className="sb-subject-head-name" style={{ color: data.deepColor || data.color }}><Icon size={15} /> {subject}</span>
                <span className="sb-muted">{done}/{chs.length}</span>
              </div>
              <ProgressBar pct={pct} color={data.color} />
              {branchLookup && (
                <div className="sb-chem-mini-row">
                  {Object.entries(data.groups).map(([branch, branchChs]) => {
                    const meta = branchLookup[branch];
                    const branchDone = branchChs.filter((c) => DONE_STATUSES.includes(p.getChStatus(`${subject}::${c}`).status)).length;
                    return (
                      <span key={branch} className="sb-chem-mini-chip" style={{ color: meta?.color, borderColor: meta?.color }}>
                        {meta?.short} {branchDone}/{branchChs.length}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="sb-subject-meta">
                <span>{mastered} mastered</span><span>·</span><span>{questionsSolved} questions</span>
                {criticalCount > 0 && <><span>·</span><span className="sb-tag tier-critical" style={{ padding: "1px 6px" }}>{criticalCount} critical</span></>}
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <SectionTitle icon={Search} right={
          <div className="sb-chip-row">
            {["All", "Not Started", "Studying", "Completed", "Mastered", "Favorites"].map((f) => (
              <button key={f} className={`sb-chip small ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        }>
          {safeOpenSubject} chapters
        </SectionTitle>
        <input className="sb-input" placeholder="Search chapters..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 14 }} />

        {safeOpenSubject === "Biology" && (
          <>
            <div className="sb-chem-branch-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className={`sb-chem-branch-chip ${bioBranch === "All" ? "active" : ""}`} onClick={() => setBioBranch("All")}>
                  All Biology (32)
                </button>
                {Object.keys(SYLLABUS.Biology.groups).map((branch) => {
                  const meta = BIOLOGY_BRANCHES[branch];
                  const count = SYLLABUS.Biology.groups[branch].length;
                  return (
                    <button
                      key={branch}
                      className={`sb-chem-branch-chip ${bioBranch === branch ? "active" : ""}`}
                      style={{ "--branch-color": meta?.color }}
                      onClick={() => setBioBranch(branch)}
                    >
                      {branch === "Botany" ? "🌱" : "🧬"} {meta?.short} · {branch} ({count})
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {["All", "Class 11", "Class 12", "High-Yield ★"].map((cl) => (
                  <button
                    key={cl}
                    type="button"
                    className={`sb-chip small ${bioClassFilter === cl ? "active" : ""}`}
                    onClick={() => setBioClassFilter(cl)}
                  >
                    {cl === "All" ? "Class 11 & 12" : cl}
                  </button>
                ))}
                <button
                  type="button"
                  className={`sb-chip small ${showBioGuide ? "active" : ""}`}
                  onClick={() => setShowBioGuide((v) => !v)}
                  title="NEET UG Biology High-Yield Units & Exam Structure"
                >
                  <Info size={12} style={{ marginRight: 3, verticalAlign: -2 }} /> High-Yield Guide
                </button>
              </div>
            </div>

            {showBioGuide && (
              <div className="sb-review-info-box" style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: "var(--mascot-ink)" }}>
                  🩺 NEET UG Biology Master Index · 360 / 720 Marks (90 MCQs)
                </div>
                <div className="sb-grid-2" style={{ gap: 12, marginBottom: 8 }}>
                  <div style={{ padding: 10, borderRadius: 10, background: "var(--card)", border: "1.5px solid var(--mascot-outline)" }}>
                    <div style={{ fontWeight: 800, fontSize: 12, color: "#2E9955", marginBottom: 4 }}>
                      🌱 Section I: Botany High-Yield Units (~45 Qs · 180 Marks)
                    </div>
                    {BIOLOGY_HIGH_YIELD.botany.map((u) => (
                      <div key={u.unit} className="sb-review-info-line"><b>{u.unit}:</b> {u.questions}</div>
                    ))}
                  </div>
                  <div style={{ padding: 10, borderRadius: 10, background: "var(--card)", border: "1.5px solid var(--mascot-outline)" }}>
                    <div style={{ fontWeight: 800, fontSize: 12, color: "#C43668", marginBottom: 4 }}>
                      🧬 Section II: Zoology High-Yield Units (~45 Qs · 180 Marks)
                    </div>
                    {BIOLOGY_HIGH_YIELD.zoology.map((u) => (
                      <div key={u.unit} className="sb-review-info-line"><b>{u.unit}:</b> {u.questions}</div>
                    ))}
                  </div>
                </div>
                <div className="sb-review-info-line" style={{ fontSize: 11.5 }}>{BIOLOGY_HIGH_YIELD.structureNote}</div>
                <div className="sb-review-info-line" style={{ fontSize: 11, marginTop: 3, opacity: 0.85 }}>{BIOLOGY_HIGH_YIELD.curriculumNote}</div>
              </div>
            )}
          </>
        )}

        {safeOpenSubject === "Chemistry" && (
          <div className="sb-chem-branch-row">
            <button className={`sb-chem-branch-chip ${chemBranch === "All" ? "active" : ""}`} onClick={() => setChemBranch("All")}>All branches</button>
            {Object.keys(SYLLABUS.Chemistry.groups).map((branch) => {
              const meta = CHEMISTRY_BRANCHES[branch];
              return (
                <button
                  key={branch}
                  className={`sb-chem-branch-chip ${chemBranch === branch ? "active" : ""}`}
                  style={{ "--branch-color": meta?.color }}
                  onClick={() => setChemBranch(branch)}
                >
                  {meta?.short} · {branch}
                </button>
              );
            })}
          </div>
        )}

        {(() => {
          let anyVisible = false;
          const subjData = SYLLABUS[safeOpenSubject] || SYLLABUS.Biology;
          const groupNodes = Object.entries(subjData.groups).map(([group, chs]) => {
            if (safeOpenSubject === "Chemistry" && chemBranch !== "All" && group !== chemBranch) return null;
            if (safeOpenSubject === "Biology" && bioBranch !== "All" && group !== bioBranch) return null;

            const visible = chs.filter((c) => {
              const st = openSubjectMetas[c]?.st || p.getChStatus(`${safeOpenSubject}::${c}`);
              if (safeOpenSubject === "Biology" && bioClassFilter !== "All") {
                const meta = BIOLOGY_CHAPTER_META[c];
                if (bioClassFilter === "High-Yield ★") {
                  if (!meta?.highYield) return false;
                } else if (meta && meta.classLevel !== bioClassFilter) {
                  return false;
                }
              }
              if (filter === "Favorites" && !st.favorite) return false;
              if (filter !== "All" && filter !== "Favorites" && st.status !== filter) return false;
              if (query) {
                const qLower = query.toLowerCase();
                const bioMeta = safeOpenSubject === "Biology" ? BIOLOGY_CHAPTER_META[c] : null;
                const matchName = c.toLowerCase().includes(qLower);
                const matchUnit = bioMeta && (bioMeta.unit.toLowerCase().includes(qLower) || bioMeta.batchId.toLowerCase().includes(qLower));
                if (!matchName && !matchUnit) return false;
              }
              return true;
            });
            if (visible.length === 0) return null;
            anyVisible = true;
            const branchMeta = safeOpenSubject === "Biology" ? BIOLOGY_BRANCHES[group] : CHEMISTRY_BRANCHES[group];
            return (
              <div key={group} className="sb-chapter-group">
                <div className="sb-chapter-group-title" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  {branchMeta && <span className="sb-chem-branch-badge" style={{ background: branchMeta.color }}>{branchMeta.short}</span>}
                  <span>{group}</span>
                  {branchMeta?.subtitle && (
                    <span className="sb-muted" style={{ fontSize: 11.5, fontWeight: 600 }}>· {branchMeta.subtitle}</span>
                  )}
                </div>
                <div className="sb-chapter-grid">
                  {visible.map((c) => {
                    const { key, st, auto } = openSubjectMetas[c];
                    const isDone = DONE_STATUSES.includes(st.status);
                    const isOpen = expanded === key;
                    const bioMeta = safeOpenSubject === "Biology" ? BIOLOGY_CHAPTER_META[c] : null;
                    return (
                      <div key={c} className={`sb-chapter-card ${isOpen ? "sb-chapter-card-open" : ""} ${isDone ? "sb-chapter-card-done" : ""}`}>
                        <div className="sb-chapter-card-top" onClick={() => setExpanded(isOpen ? null : key)}>
                          <div>
                            <div className="sb-chapter-name">
                              {bioMeta && (
                                <span
                                  className="sb-tag"
                                  style={{
                                    marginRight: 6,
                                    background: bioMeta.branch === "Botany" ? "rgba(46,153,85,0.14)" : "rgba(196,54,104,0.14)",
                                    color: bioMeta.branch === "Botany" ? "#2E9955" : "#C43668",
                                    fontWeight: 900,
                                  }}
                                >
                                  {bioMeta.batchId}
                                </span>
                              )}
                              {c}
                            </div>
                            <div className="sb-chapter-tags">
                              {bioMeta && (
                                <>
                                  <span className="sb-tag" style={{ fontWeight: 800 }}>{bioMeta.classLevel}</span>
                                  <span className="sb-tag" title="NCERT Unit Correlation">{bioMeta.unit}</span>
                                  {bioMeta.highYield && (
                                    <span className="sb-tag" style={{ background: "rgba(232,162,58,0.18)", color: "#C87D12", fontWeight: 800 }}>
                                      ★ High-Yield
                                    </span>
                                  )}
                                </>
                              )}
                              <span className={`sb-tag tier-${tierSlug(auto.tier)}`} title="Auto-computed from weightage, accuracy, prerequisites & revision freshness">
                                {auto.tier === "Foundation" ? <Lock size={9} /> : <Sparkles size={9} />} {auto.tier}
                              </span>
                              <span className={`sb-tag priority-${st.priority?.toLowerCase()}`}>{st.priority}</span>
                              <span className="sb-tag">{st.difficulty}</span>
                              <span className="sb-tag">W:{st.weightage}/10</span>
                              {auto.accuracy !== null && <span className="sb-tag">Acc:{auto.accuracy}%</span>}
                              {st.personal_notes && <span className="sb-tag" title="Has quick-revision notes">📝 notes</span>}
                            </div>
                          </div>
                          <div className="sb-chapter-card-actions">
                            <button
                              className={`sb-chapter-check ${isDone ? "active" : ""}`}
                              title={isDone ? "Completed" : "Mark this chapter complete"}
                              onClick={(e) => { e.stopPropagation(); if (!isDone) markCompleteNow(safeOpenSubject, c, key); }}
                            >
                              <CheckCircle2 size={16} fill={isDone ? "currentColor" : "none"} />
                            </button>
                            <button className={`sb-star ${st.favorite ? "active" : ""}`} onClick={(e) => { e.stopPropagation(); p.setChapterField(safeOpenSubject, c, { favorite: !st.favorite }); }}>
                              <Star size={14} fill={st.favorite ? "currentColor" : "none"} />
                            </button>
                          </div>
                        </div>

                        <select className="sb-input small" value={st.status} onChange={(e) => {
                          if (e.target.value === "Completed") markCompleteNow(safeOpenSubject, c, key);
                          else p.setChapterField(safeOpenSubject, c, { status: e.target.value });
                        }}>
                          {["Not Started", "Studying", "Completed", "Mastered"].map((s) => <option key={s}>{s}</option>)}
                        </select>

                        <div className="sb-chapter-progress-row">
                          <span className="sb-muted small">Lectures {st.lectures_done}/{st.lectures_total}</span>
                          <ProgressBar pct={(st.lectures_done / (st.lectures_total || 1)) * 100} color={subjData.color} />
                        </div>

                        {isOpen && (
                          <div className="sb-chapter-detail">
                            <div className={`sb-next-action tier-${tierSlug(auto.tier)}`}>
                              <div className="sb-next-action-head">
                                <Sparkles size={13} /> Next action <span className="sb-muted small">· auto-computed, score {auto.score}/100</span>
                              </div>
                              <div>{auto.nextAction}</div>
                            </div>
                            <div className="sb-form-grid dense">
                              <div><label>Priority</label>
                                <select className="sb-input small" value={st.priority} onChange={(e) => p.setChapterField(safeOpenSubject, c, { priority: e.target.value })}>
                                  {["Low", "Medium", "High"].map((x) => <option key={x}>{x}</option>)}
                                </select>
                              </div>
                              <div><label>Difficulty</label>
                                <select className="sb-input small" value={st.difficulty} onChange={(e) => p.setChapterField(safeOpenSubject, c, { difficulty: e.target.value })}>
                                  {["Easy", "Medium", "Hard"].map((x) => <option key={x}>{x}</option>)}
                                </select>
                              </div>
                              <div><label>Weightage /10</label>
                                <input type="number" min="0" max="10" className="sb-input small" value={st.weightage} onChange={(e) => p.setChapterField(safeOpenSubject, c, { weightage: +e.target.value })} />
                              </div>
                              <div><label>Lectures done</label>
                                <input type="number" min="0" className="sb-input small" value={st.lectures_done} onChange={(e) => p.setChapterField(safeOpenSubject, c, { lectures_done: +e.target.value })} />
                              </div>
                              <div><label>Lectures total</label>
                                <input type="number" min="1" className="sb-input small" value={st.lectures_total} onChange={(e) => p.setChapterField(safeOpenSubject, c, { lectures_total: +e.target.value })} />
                              </div>
                              <div><label>DPP pending</label>
                                <input type="number" min="0" className="sb-input small" value={st.dpp_pending} onChange={(e) => p.setChapterField(safeOpenSubject, c, { dpp_pending: +e.target.value })} />
                              </div>
                              <div><label>PYQ pending</label>
                                <input type="number" min="0" className="sb-input small" value={st.pyq_pending} onChange={(e) => p.setChapterField(safeOpenSubject, c, { pyq_pending: +e.target.value })} />
                              </div>
                              <div><label>Notes pending</label>
                                <input type="number" min="0" className="sb-input small" value={st.notes_pending} onChange={(e) => p.setChapterField(safeOpenSubject, c, { notes_pending: +e.target.value })} />
                              </div>
                              <div><label>Deadline</label>
                                <input type="date" className="sb-input small" value={st.deadline || ""} onChange={(e) => p.setChapterField(safeOpenSubject, c, { deadline: e.target.value })} />
                              </div>
                            </div>
                            <label className="sb-muted small" style={{ display: "block", marginTop: 8 }}>Quick-revision notes / NCERT highlights</label>
                            <textarea
                              className="sb-input"
                              rows={4}
                              placeholder="NCERT page numbers, tricky examples, exceptions, or formulas you want the night before a mock..."
                              value={st.personal_notes || ""}
                              onChange={(e) => p.setChapterField(safeOpenSubject, c, { personal_notes: e.target.value })}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });
          return anyVisible ? groupNodes : (
            <EmptyState mascot={p.mascot} mood="idle" text="No chapters match that filter" sub="Try a different search, status, or branch tab." />
          );
        })()}
      </Card>
    </div>
  );
}
