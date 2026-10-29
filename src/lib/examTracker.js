import { todayIST, daysUntilIST, formatISTCalendarDate } from "./dateIST.js";
import { normalizeStream } from "../data/syllabus.js";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const EXT_STORAGE_KEY = "sb-neet-profile-ext-v1";

export const DEFAULT_NEET_EXAM = "NEET UG";
export const DEFAULT_NEET_DATE = "2027-05-02";
export const DEFAULT_NEET_TIME = "14:00"; // 2:00 PM IST (official NTA NEET UG exam start time)

export const NEET_PRESET_DATES = [
  { label: "NEET UG 2027 (May 2)", exam: "NEET UG", date: "2027-05-02", time: "14:00" },
  { label: "NEET UG 2028 (May 7)", exam: "NEET UG", date: "2028-05-07", time: "14:00" },
];

export function readLocalProfileExt() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(EXT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function writeLocalProfileExt(patch) {
  if (typeof window === "undefined") return {};
  try {
    const cur = readLocalProfileExt();
    const next = { ...cur, ...patch };
    window.localStorage.setItem(EXT_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return {};
  }
}

/**
 * Normalizes a profile row by merging Supabase profile fields with local
 * extended fields (subject_stream, exam_time, custom_exams, custom_exam_name).
 * Ensures legacy "JEE Main" / "JEE Advanced" defaults are upgraded to "NEET UG".
 */
export function resolveProfileConfig(profile = {}) {
  const local = readLocalProfileExt();
  const rawExam = profile?.exam || local?.exam || DEFAULT_NEET_EXAM;
  const exam = rawExam === "JEE Main" || rawExam === "JEE Advanced" ? DEFAULT_NEET_EXAM : rawExam;
  const isCustomPrimary = exam !== "NEET UG" && !exam.startsWith("NEET");
  const exam_date = profile?.exam_date || local?.exam_date || DEFAULT_NEET_DATE;
  const exam_time = profile?.exam_time || local?.exam_time || DEFAULT_NEET_TIME;
  const subject_stream = normalizeStream(profile?.subject_stream || local?.subject_stream || "PCB");
  const custom_exams = Array.isArray(profile?.custom_exams)
    ? profile.custom_exams
    : Array.isArray(local?.custom_exams)
      ? local.custom_exams
      : [];

  return {
    ...profile,
    exam,
    isCustomPrimary,
    exam_date,
    exam_time,
    subject_stream,
    custom_exams,
  };
}

/**
 * Formats an "HH:MM" 24-hour string into a readable 12-hour IST label, e.g. "2:00 PM IST".
 */
export function formatExamTimeIST(timeStr = DEFAULT_NEET_TIME) {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) return "2:00 PM IST";
  const [hRaw, mRaw] = timeStr.split(":").map(Number);
  const h = Number.isFinite(hRaw) ? ((hRaw % 24) + 24) % 24 : 14;
  const m = Number.isFinite(mRaw) ? Math.max(0, Math.min(59, mRaw)) : 0;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm} IST`;
}

/**
 * Converts a "YYYY-MM-DD" date and "HH:MM" time in IST (Asia/Kolkata, UTC+5:30)
 * into an exact UTC epoch timestamp in milliseconds.
 */
export function examDateTimeToUTCms(dateStr, timeStr = DEFAULT_NEET_TIME) {
  if (!dateStr || typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return NaN;
  const [y, m, d] = dateStr.trim().split("-").map(Number);
  if (!Number.isFinite(y) || m < 1 || m > 12 || d < 1 || d > 31) return NaN;
  const checkDate = new Date(Date.UTC(y, m - 1, d));
  if (checkDate.getUTCFullYear() !== y || checkDate.getUTCMonth() !== m - 1 || checkDate.getUTCDate() !== d) {
    return NaN;
  }

  let hh = 14, mm = 0;
  if (timeStr !== undefined && timeStr !== null && timeStr !== "") {
    if (typeof timeStr !== "string" || !/^\d{1,2}:\d{2}$/.test(timeStr.trim())) return NaN;
    const [hPart, mPart] = timeStr.trim().split(":").map(Number);
    if (!Number.isFinite(hPart) || !Number.isFinite(mPart)) return NaN;
    hh = hPart;
    mm = mPart;
  }
  if (!(hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59)) return NaN;
  return Date.UTC(y, m - 1, d, hh, mm, 0) - IST_OFFSET_MS;
}

/**
 * Computes exact countdown metrics in IST for any target exam (NEET UG or Custom Exam).
 */
export function computeExamCountdown(dateStr, timeStr = DEFAULT_NEET_TIME, nowMs = Date.now()) {
  const targetMs = examDateTimeToUTCms(dateStr, timeStr);
  if (Number.isNaN(targetMs)) {
    return {
      valid: false,
      calendarDays: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalHours: 0,
      weeks: 0,
      remDays: 0,
      isPast: false,
      isToday: false,
      urgency: "normal",
      formattedDate: "",
      formattedTime: formatExamTimeIST(timeStr),
    };
  }

  const diffMs = Math.max(0, targetMs - nowMs);
  const isPast = targetMs <= nowMs;
  const calendarDays = daysUntilIST(dateStr);
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  const totalHours = Math.floor(diffMs / 3600000);
  const weeks = Math.floor(calendarDays / 7);
  const remDays = calendarDays % 7;
  const isToday = dateStr === todayIST();

  let urgency = "normal";
  if (isPast) urgency = "completed";
  else if (isToday || calendarDays <= 1) urgency = "critical";
  else if (calendarDays <= 7) urgency = "this-week";
  else if (calendarDays <= 30) urgency = "soon";

  return {
    valid: true,
    calendarDays,
    days,
    hours,
    minutes,
    seconds,
    totalHours,
    weeks,
    remDays,
    isPast,
    isToday,
    urgency,
    formattedDate: formatISTCalendarDate(dateStr, { month: "short", day: "numeric", year: "numeric" }),
    formattedTime: formatExamTimeIST(timeStr),
  };
}
