// Single source of truth for mock test scoring, NEET UG (+4/-1, 720 total)
// section calculations, and backward-compatible metadata packing.
const num = (v) => Number(v) || 0;

export const NEET_TOTAL_MARKS = 720;
export const NEET_SECTION_QUESTIONS = 45; // 45 scored questions per section (Botany, Zoology, Physics, Chemistry)
export const NEET_SECTION_MARKS = 180;    // 45 * 4 = 180 marks per section
export const NEET_BIOLOGY_MARKS = 360;    // Botany (180) + Zoology (180) = 360 marks

// Legacy alias kept so any older test or import still resolves cleanly
export const MAINS_TOTAL_MARKS = NEET_TOTAL_MARKS;

export const NEET_MARKS_FOR = (correct, incorrect) => num(correct) * 4 - num(incorrect) * 1;

const META_PREFIX = "__sb_neet_meta:";

/**
 * Packs extended NEET fields (botany/zoology/biology marks, counts, minutes,
 * custom exam settings) into a JSON string that can be stored in `notes` as a
 * fallback when a database only has the original mock_tests columns.
 */
export function packMockMeta(ext = {}, userNotes = "") {
  const payload = { ...ext, userNotes: userNotes || "" };
  return `${META_PREFIX}${JSON.stringify(payload)}`;
}

/**
 * Unpacks a mock_tests row so `botany_marks`, `zoology_marks`, `biology_marks`,
 * per-section correct/incorrect counts, per-section minutes, and clean `notes`
 * are always present on the returned object whether they came from native DB
 * columns or from the packed `notes` fallback.
 */
export function unpackMockRow(m) {
  if (!m || typeof m !== "object") return {};
  let parsedMeta = null;
  if (typeof m.notes === "string" && m.notes.startsWith(META_PREFIX)) {
    try {
      parsedMeta = JSON.parse(m.notes.slice(META_PREFIX.length));
    } catch {
      parsedMeta = null;
    }
  }
  const merged = parsedMeta ? { ...parsedMeta, ...m } : { ...m };
  if (parsedMeta) {
    const metaKeys = [
      "exam_type", "input_mode",
      "biology_marks", "botany_marks", "zoology_marks",
      "biology_correct", "biology_incorrect",
      "botany_correct", "botany_incorrect",
      "zoology_correct", "zoology_incorrect",
      "physics_correct", "physics_incorrect",
      "chemistry_correct", "chemistry_incorrect",
      "math_correct", "math_incorrect",
      "biology_minutes", "botany_minutes", "zoology_minutes",
      "physics_minutes", "chemistry_minutes", "math_minutes",
      "attempted", "correct", "incorrect", "negative_marks",
    ];
    metaKeys.forEach((k) => {
      if (parsedMeta[k] !== undefined && parsedMeta[k] !== null) {
        if (m[k] === undefined || m[k] === null || m[k] === 0 || k === "exam_type") {
          merged[k] = parsedMeta[k];
        }
      }
    });
    if (parsedMeta.real_exam_type) {
      merged.exam_type = parsedMeta.real_exam_type;
    }
    const cleanNotes = parsedMeta.userNotes || "";
    merged.notes = cleanNotes;
    merged.user_notes = cleanNotes;
    delete merged.real_exam_type;
    delete merged.userNotes;
  } else {
    merged.user_notes = typeof m.notes === "string" ? m.notes : "";
  }
  return merged;
}

export const botanyMarksOf = (m) => {
  const u = unpackMockRow(m);
  return num(u.botany_marks);
};

export const zoologyMarksOf = (m) => {
  const u = unpackMockRow(m);
  return num(u.zoology_marks);
};

export const biologyMarksOf = (m) => {
  const u = unpackMockRow(m);
  const bot = num(u.botany_marks);
  const zoo = num(u.zoology_marks);
  if (bot !== 0 || zoo !== 0) return bot + zoo;
  return num(u.biology_marks);
};

export const PART_DEFAULT_TOTAL_MARKS = 180;

export const normalizeExamType = (examType) => {
  if (!examType || examType === "JEE Main") return "NEET UG";
  if (examType === "JEE Advanced") return "Custom Exam";
  return examType;
};

export const totalOf = (m) => {
  const u = unpackMockRow(m);
  const isNeet = normalizeExamType(u.exam_type) === "NEET UG";
  const math = isNeet ? 0 : num(u.math_marks);
  return biologyMarksOf(u) + num(u.physics_marks) + num(u.chemistry_marks) + math;
};

export const defaultTotalFor = (m) => {
  if (!m) return NEET_TOTAL_MARKS;
  const u = unpackMockRow(m);
  const explicit = num(u.total_marks);
  if (explicit > 0) return explicit;
  const et = normalizeExamType(u.exam_type);
  if (et === "NEET UG") return NEET_TOTAL_MARKS;
  let activeSections = 0;
  if (num(u.botany_marks) !== 0 || num(u.zoology_marks) !== 0) {
    if (num(u.botany_marks) !== 0) activeSections += 1;
    if (num(u.zoology_marks) !== 0) activeSections += 1;
  } else if (num(u.biology_marks) !== 0) {
    activeSections += num(u.biology_marks) > 180 ? 2 : 1;
  }
  if (num(u.physics_marks) !== 0) activeSections += 1;
  if (num(u.chemistry_marks) !== 0) activeSections += 1;
  if (num(u.math_marks) !== 0) activeSections += 1;
  return activeSections > 0 ? activeSections * NEET_SECTION_MARKS : PART_DEFAULT_TOTAL_MARKS;
};

// 0-100 scale (integer rounded), normalized against each mock's real total marks
export const pctOf = (m) => {
  const u = unpackMockRow(m);
  const denom = num(u.total_marks) || defaultTotalFor(u);
  if (denom <= 0) return 0;
  return Math.round((totalOf(u) / denom) * 100);
};

export const pctExactOf = (m) => {
  const u = unpackMockRow(m);
  const denom = num(u.total_marks) || defaultTotalFor(u);
  if (denom <= 0) return 0;
  return Math.round((totalOf(u) / denom) * 1000) / 10;
};
