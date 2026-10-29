import React, { useMemo, useRef, useState, useLayoutEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import {
  NotebookPen, Star, Flag, Pencil, Trash2, ChevronLeft, ChevronRight,
  ArrowLeft, Plus, RotateCcw, StickyNote, List, AlignLeft, X,
} from "lucide-react";
import Mascot from "../components/Mascot";
import { SparkleStar } from "../components/decor/Motifs";
import { formatISTCalendarDate, todayIST } from "../lib/dateIST";

const fmtDeadline = (d) => (d ? formatISTCalendarDate(d, { month: "short", day: "numeric", year: "numeric" }) : null);
const isOverdue = (goal) => goal.status !== "Completed" && !!goal.deadline && goal.deadline < todayIST();
const emptyDraft = () => ({ title: "", deadline: "", starred: false, notes: "" });

/* ------------------------------------------------------------------ *
 * Bullet-notes helpers. Bullets are stored as plain text on the
 * existing `notes` column ("• line one\n• line two"), so nothing in
 * the database or on old goals needs to change — this is purely a
 * richer way to write into the same field.
 * ------------------------------------------------------------------ */
const BULLET_PREFIX = "• ";
const isBulletNotes = (text) => {
  if (!text) return false;
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  return lines.length > 0 && lines.every((l) => l.trimStart().startsWith(BULLET_PREFIX));
};
const notesToBullets = (text) => {
  if (!text) return [""];
  const lines = text.split("\n").map((l) => l.trimStart().replace(/^•\s?/, ""));
  return lines.length ? lines : [""];
};
const bulletsToNotes = (bullets) => {
  const clean = bullets.map((b) => b.trim()).filter(Boolean);
  return clean.length ? clean.map((b) => `${BULLET_PREFIX}${b}`).join("\n") : "";
};
// Plain join for handing bullet content back to the paragraph textarea —
// deliberately drops the "• " markers so free-form mode stays free-form.
const bulletsToParagraph = (bullets) => bullets.map((b) => b.trim()).filter(Boolean).join("\n");
const paragraphToBullets = (text) => {
  const lines = (text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines : [""];
};

/* ------------------------------------------------------------------ *
 * Pencil-strike + celebration animation for marking a goal complete.
 * Pure GSAP: draws a hand-drawn strike-through line across the title
 * with a pencil "riding" the line, then pops a wax-stamp badge and a
 * small confetti of sparks. Runs once, driven off refs — no React
 * state churn mid-animation.
 * ------------------------------------------------------------------ */
function playCompleteAnimation(pageEl) {
  if (!pageEl) return Promise.resolve();
  const paths = Array.from(pageEl.querySelectorAll(".sb-strike-path"));
  const pencil = pageEl.querySelector(".sb-strike-pencil");
  const stamp = pageEl.querySelector(".sb-goal-stamp");
  const sparks = pageEl.querySelectorAll(".sb-goal-spark");

  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve });
    let t = 0;

    paths.forEach((path, i) => {
      const len = path.getTotalLength ? path.getTotalLength() : 200;
      const box = path.getBBox ? path.getBBox() : { x: 0, y: 0, width: 160, height: 10 };
      const dur = Math.max(0.3, Math.min(0.55, len / 360));

      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
      if (pencil) {
        gsap.set(pencil, { opacity: 1, x: box.x - 14, y: box.y + box.height / 2 - 11, rotate: -32 });
        tl.to(pencil, { x: box.x + box.width - 2, y: box.y + box.height / 2 - 11, duration: dur, ease: "power2.inOut" }, t);
      }
      tl.to(path, { strokeDashoffset: 0, duration: dur, ease: "power2.inOut" }, t);
      t += dur + (i < paths.length - 1 ? 0.14 : 0);
    });

    if (pencil) tl.to(pencil, { opacity: 0, duration: 0.18 }, Math.max(0, t - 0.05));

    if (stamp) {
      tl.fromTo(
        stamp,
        { opacity: 0, scale: 0.3, rotate: -18 },
        { opacity: 1, scale: 1, rotate: -9, duration: 0.5, ease: "back.out(3.2)" },
        t
      );
    }
    if (sparks.length) {
      tl.set(sparks, { opacity: 0, scale: 0.4, x: 0, y: 0 }, t)
        .to(
          sparks,
          {
            opacity: 1,
            scale: 1,
            duration: 0.22,
            stagger: 0.035,
            x: () => gsap.utils.random(-46, 46),
            y: () => gsap.utils.random(-52, -8),
            rotate: () => gsap.utils.random(-40, 40),
            ease: "back.out(2.4)",
          },
          t
        )
        .to(sparks, { opacity: 0, duration: 0.45, ease: "power1.in" }, t + 0.5);
    }
  });
}

/* ------------------------------------------------------------------ *
 * Measures the actual rendered line boxes of a (possibly wrapped)
 * text node, so the strike-through can draw one stroke per visual
 * line instead of assuming the title is a single line.
 * ------------------------------------------------------------------ */
function useLineRects(textRef, containerRef, deps) {
  const [state, setState] = useState({ rects: [], w: 0, h: 0 });

  useLayoutEffect(() => {
    const textEl = textRef.current;
    const containerEl = containerRef.current;
    if (!textEl || !containerEl) return undefined;

    const measure = () => {
      const range = document.createRange();
      range.selectNodeContents(textEl);
      const clientRects = Array.from(range.getClientRects());
      const containerBox = containerEl.getBoundingClientRect();
      setState({
        w: containerBox.width,
        h: containerBox.height,
        rects: clientRects.map((r) => ({
          left: r.left - containerBox.left,
          right: r.right - containerBox.left,
          top: r.top - containerBox.top,
          height: r.height,
        })),
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(containerEl);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

/** A gentle hand-drawn wobble across one line's rect. */
function strikePathForRect(r) {
  const y = r.top + r.height * 0.58;
  const w = r.right - r.left;
  const c1x = r.left + w * 0.3, c1y = y - Math.min(3.5, r.height * 0.1);
  const c2x = r.left + w * 0.66, c2y = y + Math.min(3.5, r.height * 0.1);
  const endY = y - Math.min(2, r.height * 0.05);
  return `M ${r.left - 2} ${y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${r.right + 2} ${endY}`;
}

/* ------------------------------------------------------------------ *
 * One written page — a single goal.
 * ------------------------------------------------------------------ */
function GoalPage({ goal, pageNumber, onComplete, onDelete, onToggleStar, animating }) {
  const pageRef = useRef(null);
  const titleWrapRef = useRef(null);
  const titleTextRef = useRef(null);
  const [firing, setFiring] = useState(false);
  const isDone = goal.status === "Completed";
  const busy = animating || firing;
  const { rects: lineRects, w: boxW, h: boxH } = useLineRects(titleTextRef, titleWrapRef, [goal.title]);

  const handleComplete = async () => {
    if (isDone || busy) return;
    setFiring(true);
    await playCompleteAnimation(pageRef.current);
    await onComplete(goal);
    setFiring(false);
  };

  return (
    <div className="sb-journal-page-inner" ref={pageRef}>
      <div className="sb-goal-page-head">
        <button
          className={`sb-goal-star-btn ${goal.starred ? "is-starred" : ""}`}
          onClick={() => onToggleStar(goal)}
          aria-label={goal.starred ? "Unstar this goal" : "Star this goal"}
          title={goal.starred ? "Unstar" : "Star this goal"}
        >
          <Star size={18} fill={goal.starred ? "currentColor" : "none"} />
        </button>
        <span className="sb-goal-page-num">page {pageNumber}</span>
      </div>

      <div className="sb-goal-title-wrap" ref={titleWrapRef}>
        <h2 className={`sb-goal-title ${isDone ? "is-done" : ""}`}>
          <span ref={titleTextRef}>{goal.title}</span>
        </h2>
        {lineRects.length > 0 && (
          <svg
            className="sb-strike-svg"
            width={boxW}
            height={boxH}
            viewBox={`0 0 ${boxW} ${boxH}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {lineRects.map((r, i) => (
              <path
                key={i}
                className="sb-strike-path"
                d={strikePathForRect(r)}
                style={{ opacity: isDone ? 1 : 0 }}
              />
            ))}
          </svg>
        )}
        <span className="sb-strike-pencil" aria-hidden="true">✏️</span>
      </div>

      {goal.deadline && (
        <span className={`sb-goal-deadline-chip ${isOverdue(goal) ? "is-overdue" : ""}`}>
          <Flag size={12} /> {fmtDeadline(goal.deadline)}
        </span>
      )}

      {goal.notes && (
        isBulletNotes(goal.notes) ? (
          <ul className="sb-goal-notes-list">
            {notesToBullets(goal.notes).map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        ) : (
          <p className="sb-goal-notes">{goal.notes}</p>
        )
      )}

      <div className="sb-goal-page-foot">
        {!isDone ? (
          <button className="sb-goal-complete-btn" onClick={handleComplete} disabled={busy}>
            <Pencil size={14} /> Mark complete
          </button>
        ) : (
          <button className="sb-goal-reopen-btn" onClick={() => onComplete(goal)} disabled={busy}>
            <RotateCcw size={13} /> Reopen
          </button>
        )}
        <button className="sb-goal-delete-btn" onClick={() => onDelete(goal.id)} aria-label="Tear out this page" title="Delete this page">
          <Trash2 size={14} />
        </button>
      </div>

      {isDone && (
        <span className="sb-goal-stamp" style={{ opacity: 1 }}>
          done <span>✓</span>
        </span>
      )}
      {Array.from({ length: 7 }).map((_, i) => (
        <span key={i} className="sb-goal-spark" style={{ left: `${30 + i * 6}%`, top: "38%" }}>✦</span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The blank "next page" — the add-goal form, styled like a page
 * waiting to be written on.
 * ------------------------------------------------------------------ */
function NewGoalPage({ pageNumber, onAdd }) {
  const [draft, setDraft] = useState(emptyDraft());
  const [notesMode, setNotesMode] = useState("paragraph"); // "paragraph" | "bullets"
  const [bullets, setBullets] = useState([""]);
  const bulletRefs = useRef([]);
  const set = (k) => (e) => setDraft((s) => ({ ...s, [k]: e.target.value }));

  const switchMode = (mode) => {
    if (mode === notesMode) return;
    if (mode === "bullets") {
      setBullets(paragraphToBullets(draft.notes));
    } else {
      setDraft((s) => ({ ...s, notes: bulletsToParagraph(bullets) }));
    }
    setNotesMode(mode);
  };

  const updateBullet = (i, value) => {
    setBullets((arr) => arr.map((b, idx) => (idx === i ? value : b)));
  };
  const addBulletAfter = (i) => {
    setBullets((arr) => {
      const next = [...arr];
      next.splice(i + 1, 0, "");
      return next;
    });
    requestAnimationFrame(() => bulletRefs.current[i + 1]?.focus());
  };
  const removeBullet = (i) => {
    if (bullets.length === 1) {
      setBullets([""]);
      return;
    }
    setBullets((arr) => arr.filter((_, idx) => idx !== i));
    requestAnimationFrame(() => bulletRefs.current[Math.max(0, i - 1)]?.focus());
  };
  const handleBulletKeyDown = (i) => (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addBulletAfter(i);
    } else if (e.key === "Backspace" && bullets[i] === "" && bullets.length > 1) {
      e.preventDefault();
      removeBullet(i);
    }
  };

  const submit = () => {
    if (!draft.title.trim()) return;
    const notes = notesMode === "bullets" ? bulletsToNotes(bullets) : draft.notes.trim();
    onAdd({
      title: draft.title.trim(),
      deadline: draft.deadline || null,
      starred: draft.starred,
      notes: notes || null,
    });
    setDraft(emptyDraft());
    setBullets([""]);
  };

  return (
    <div className="sb-journal-page-inner sb-journal-blank">
      <div className="sb-goal-page-head">
        <button
          className={`sb-goal-star-btn ${draft.starred ? "is-starred" : ""}`}
          onClick={() => setDraft((s) => ({ ...s, starred: !s.starred }))}
          aria-label="Star this goal"
        >
          <Star size={18} fill={draft.starred ? "currentColor" : "none"} />
        </button>
        <span className="sb-goal-page-num">page {pageNumber}</span>
      </div>

      <div className="sb-journal-blank-hint"><StickyNote size={16} /> Write your next goal</div>

      <input
        className="sb-goal-input-title"
        placeholder="I want to..."
        value={draft.title}
        onChange={set("title")}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        autoFocus={false}
      />

      <div className="sb-goal-form-row">
        <label>Deadline <span>(optional)</span></label>
        <input type="date" className="sb-goal-input-small" value={draft.deadline} onChange={set("deadline")} />
      </div>

      <div className="sb-notes-block">
        <div className="sb-notes-mode-toggle" role="tablist" aria-label="Notes style">
          <button
            type="button"
            role="tab"
            aria-selected={notesMode === "paragraph"}
            className={notesMode === "paragraph" ? "is-active" : ""}
            onClick={() => switchMode("paragraph")}
          >
            <AlignLeft size={13} /> Notes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={notesMode === "bullets"}
            className={notesMode === "bullets" ? "is-active" : ""}
            onClick={() => switchMode("bullets")}
          >
            <List size={13} /> Bullets
          </button>
        </div>

        {notesMode === "paragraph" ? (
          <textarea
            className="sb-goal-input-notes"
            placeholder="Any notes? (optional)"
            rows={3}
            value={draft.notes}
            onChange={set("notes")}
          />
        ) : (
          <div className="sb-bullet-editor">
            {bullets.map((b, i) => (
              <div className="sb-bullet-row" key={i}>
                <span className="sb-bullet-dot" aria-hidden="true">•</span>
                <input
                  ref={(el) => { bulletRefs.current[i] = el; }}
                  className="sb-bullet-input"
                  placeholder={i === 0 ? "First point..." : "Next point..."}
                  value={b}
                  onChange={(e) => updateBullet(i, e.target.value)}
                  onKeyDown={handleBulletKeyDown(i)}
                />
                <button
                  type="button"
                  className="sb-bullet-remove"
                  onClick={() => removeBullet(i)}
                  aria-label="Remove this point"
                  tabIndex={-1}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            <button type="button" className="sb-bullet-add" onClick={() => addBulletAfter(bullets.length - 1)}>
              <Plus size={13} /> Add point
            </button>
          </div>
        )}
      </div>

      <button className="sb-goal-complete-btn" onClick={submit} disabled={!draft.title.trim()}>
        <Pencil size={14} /> Write this page
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The cover — tap to open the journal.
 * ------------------------------------------------------------------ */
function JournalCover({ mascot, activeCount, doneCount, onOpen }) {
  return (
    <motion.div
      className="sb-goal-cover"
      onClick={onOpen}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: 18, rotate: -1.5 }}
      animate={{ opacity: 1, y: 0, rotate: -1.5 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="sb-spiral" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => <span key={i} />)}
      </div>
      <div className="sb-goal-cover-face">
        <span className="sb-goal-cover-sparkle sb-goal-cover-sparkle-1"><SparkleStar /></span>
        <span className="sb-goal-cover-sparkle sb-goal-cover-sparkle-2"><SparkleStar /></span>
        <div className="sb-goal-cover-mascot"><Mascot species={mascot} mood="happy" size={78} peek /></div>
        <h1 className="sb-goal-cover-title">My Goals</h1>
        <p className="sb-goal-cover-sub">tap to open your journal</p>
        <div className="sb-goal-cover-stats">
          <span>{activeCount} in progress</span>
          <span>·</span>
          <span>{doneCount} done</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Main page.
 * ------------------------------------------------------------------ */
export default function GoalsPage(p) {
  const goals = useMemo(
    () => [...(p.goals || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [p.goals]
  );
  const reduceMotion = useReducedMotion();
  const [opened, setOpened] = useState(false);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [animatingId, setAnimatingId] = useState(null);

  const pageCount = goals.length + 1; // last "page" is always the blank add-goal page
  const safeIndex = Math.min(index, pageCount - 1);
  const current = safeIndex < goals.length ? goals[safeIndex] : null;
  const activeCount = goals.filter((g) => g.status !== "Completed").length;
  const doneCount = goals.length - activeCount;

  const goTo = (next) => {
    if (next < 0 || next > pageCount - 1) return;
    setDirection(next > safeIndex ? 1 : -1);
    setIndex(next);
  };

  const handleAdd = async (item) => {
    await p.addGoal(item);
    // the new page slides in right where the blank page was
    setDirection(1);
  };

  const handleComplete = async (goal) => {
    setAnimatingId(goal.id);
    await p.completeGoal(goal);
    setAnimatingId(null);
  };

  const handleDelete = async (id) => {
    await p.deleteGoal(id);
    setIndex((i) => Math.max(0, Math.min(i, goals.length - 2)));
  };

  const handleToggleStar = (goal) => p.updateGoal(goal.id, { starred: !goal.starred });

  const pageVariants = {
    enter: (dir) => ({ rotateY: dir > 0 ? 96 : -96, opacity: 0.55 }),
    center: { rotateY: 0, opacity: 1 },
    exit: (dir) => ({ rotateY: dir > 0 ? -96 : 96, opacity: 0 }),
  };
  const transition = reduceMotion
    ? { duration: 0.01 }
    : { duration: 0.55, ease: [0.45, 0, 0.2, 1] };

  return (
    <div className="sb-page sb-goal-journal-page">
      <AnimatePresence mode="wait">
        {!opened ? (
          <motion.div
            key="cover"
            exit={{ rotateY: -90, opacity: 0, transition: { duration: reduceMotion ? 0.01 : 0.45, ease: "easeIn" } }}
            style={{ transformOrigin: "0% 50%", transformStyle: "preserve-3d" }}
          >
            <JournalCover mascot={p.mascot} activeCount={activeCount} doneCount={doneCount} onOpen={() => setOpened(true)} />
          </motion.div>
        ) : (
          <motion.div
            key="book"
            initial={{ opacity: 0, rotateY: 90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.5, ease: "easeOut" }}
            style={{ transformOrigin: "0% 50%", transformStyle: "preserve-3d" }}
            className="sb-journal-shell"
          >
            <button className="sb-journal-close" onClick={() => setOpened(false)} aria-label="Close journal">
              <ArrowLeft size={16} /> Close
            </button>

            <div className="sb-journal-stage-wrap">
              <div className="sb-spiral sb-spiral-book" aria-hidden="true">
                {Array.from({ length: 16 }).map((_, i) => <span key={i} />)}
              </div>

              <div className="sb-journal-stage">
                <AnimatePresence custom={direction} initial={false} mode="popLayout">
                  <motion.div
                    key={safeIndex}
                    custom={direction}
                    variants={pageVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={transition}
                    className="sb-journal-page"
                  >
                    {current ? (
                      <GoalPage
                        goal={current}
                        pageNumber={safeIndex + 1}
                        onComplete={handleComplete}
                        onDelete={handleDelete}
                        onToggleStar={handleToggleStar}
                        animating={animatingId === current.id}
                      />
                    ) : (
                      <NewGoalPage pageNumber={pageCount} onAdd={handleAdd} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="sb-journal-nav">
              <button className="sb-journal-arrow" onClick={() => goTo(safeIndex - 1)} disabled={safeIndex === 0} aria-label="Previous page">
                <ChevronLeft size={18} />
              </button>
              <span className="sb-journal-ribbon">{safeIndex + 1} / {pageCount}</span>
              <button className="sb-journal-arrow" onClick={() => goTo(safeIndex + 1)} disabled={safeIndex === pageCount - 1} aria-label="Next page">
                <ChevronRight size={18} />
              </button>
            </div>

            {goals.length > 0 && safeIndex !== pageCount - 1 && (
              <button className="sb-journal-jump-new" onClick={() => goTo(pageCount - 1)}>
                <Plus size={14} /> New goal
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
