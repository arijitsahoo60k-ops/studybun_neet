// StudyBun's "day" boundary is India Standard Time (UTC+5:30) — everything
// from "today's questions solved" to streaks to revision due dates is meant
// to roll over at midnight IST, since the app is built around the NEET UG exam
// calendar. That's true no matter what timezone a student's phone/laptop is
// actually set to.
//
// The bug this fixes: `new Date().toISOString().slice(0, 10)` gives the
// current UTC calendar date, not the IST one. UTC only rolls over at 5:30am
// IST, so for the ~5.5 hours after real midnight IST, that expression still
// returns *yesterday's* date — today's stats look frozen on the previous
// day for anyone studying between 12:00am and 5:30am IST.
//
// Fix: shift the absolute instant forward by the IST offset first, then read
// the UTC date parts of that shifted instant. This works correctly no matter
// what timezone the device itself is in, because we start from an absolute
// timestamp (Date.now() / a Date object / an ISO string), not from any
// locale-dependent local time.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Converts any timestamp (Date, ms epoch, or parseable ISO string) to its
// IST calendar date as "YYYY-MM-DD". No argument = right now.
export const toISTDateStr = (input) => {
  const d = input === undefined || input === null ? new Date() : new Date(input);
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
};

// "Today" in IST, right now — the one function every "what day is it for
// the purposes of this app" check should go through.
export const todayIST = () => toISTDateStr();

// Current hour in IST, 0-23. Used for mood logic that should feel different
// at 8am ("plenty of day left") vs 9pm ("today is nearly over") regardless
// of the device's own timezone.
export const istHour = () => new Date(Date.now() + IST_OFFSET_MS).getUTCHours();

// IST date string N days ago (0 = today, 1 = yesterday, ...).
export const daysAgoIST = (n) => toISTDateStr(Date.now() - n * 86400000);

// IST date string N days from now.
export const daysFromNowIST = (n) => toISTDateStr(Date.now() + n * 86400000);

// IST calendar date of a timestamp that might be missing/empty (e.g. an
// optional created_at) — returns "" instead of quietly defaulting to "now".
export const tsToISTDateStr = (input) => (input ? toISTDateStr(input) : "");

// Whole calendar-day difference between two "YYYY-MM-DD" strings (target
// minus from). Deliberately ignores time-of-day entirely — comparing
// `new Date(examDate) - new Date()` directly (as the app used to) drifts
// by up to a day depending what time it currently is, since one side has a
// midnight timestamp and the other doesn't. This just counts calendar days.
export const dateStrToUTCms = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
export const daysBetweenDateStrs = (targetStr, fromStr) =>
  Math.round((dateStrToUTCms(targetStr) - dateStrToUTCms(fromStr)) / 86400000);

// Days remaining until a "YYYY-MM-DD" target date, counted in IST calendar
// days (never negative).
export const daysUntilIST = (targetDateStr) => Math.max(0, daysBetweenDateStrs(targetDateStr, todayIST()));

// Formats a "YYYY-MM-DD" calendar-date string for display (e.g. session_date,
// due_date, mock_date, deadline). Deliberately does NOT go through
// `new Date("YYYY-MM-DD")` — the JS spec parses a bare date string as UTC
// midnight, so formatting it with the device's local timezone can render as
// the previous day. Parsing the Y/M/D parts directly and building a local
// Date from them sidesteps that entirely: what you typed/stored as the IST
// calendar date is what gets shown, full stop.
export const formatISTCalendarDate = (dateStr, opts) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
};

// Formats a real timestamp (e.g. an achievement's unlocked_at) pinned to the
// IST calendar day it actually happened on, regardless of the viewing
// device's timezone — StudyBun's day boundary is IST everywhere, including
// here.
export const formatISTTimestamp = (iso, opts) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { ...opts, timeZone: "Asia/Kolkata" });
};

// 3-letter weekday ("Sun".."Sat") for a "YYYY-MM-DD" calendar-date string,
// computed off the same UTC-midnight parse `dateStrToUTCms` uses internally
// so it lines up with every other date-string comparison in the app —
// never through `new Date("YYYY-MM-DD")` directly, which can shift a day
// depending on the device's local timezone.
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const weekdayShortIST = (dateStr) => WEEKDAY_SHORT[new Date(dateStrToUTCms(dateStr)).getUTCDay()];
