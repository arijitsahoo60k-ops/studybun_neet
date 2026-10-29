/**
 * Shared constants + small pure helpers for the Group Timer feature.
 * Everything here is dependency-free so it's trivially unit-testable.
 */

// ---------------------------------------------------------------------------
// Room GIFs. `src` lives in /public/group-timer (never precached -- the
// service worker's glob only covers js/css/html/svg/png/ico), `thumb` is a
// ~2 KB first-frame still so the settings picker doesn't have to download
// five animated GIFs just to show a menu.
// ---------------------------------------------------------------------------
export const GT_GIFS = [
  { id: "star", label: "Star ride", src: "/group-timer/star.gif", thumb: "/group-timer/thumbs/star.webp" },
  { id: "night-flowers", label: "Night bloom", src: "/group-timer/night-flowers.gif", thumb: "/group-timer/thumbs/night-flowers.webp" },
  { id: "sneakers", label: "Clover walk", src: "/group-timer/sneakers.gif", thumb: "/group-timer/thumbs/sneakers.webp" },
  { id: "rainy-hills", label: "Rainy hills", src: "/group-timer/rainy-hills.gif", thumb: "/group-timer/thumbs/rainy-hills.webp" },
  { id: "night-drive", label: "Night drive", src: "/group-timer/night-drive.gif", thumb: "/group-timer/thumbs/night-drive.webp" },
];
export const DEFAULT_GIF_ID = "star";
export const LOBBY_STATIC_SRC = "/group-timer/lobby-static.webp";

export function gifById(id) {
  return GT_GIFS.find((g) => g.id === id) || GT_GIFS[0];
}

// ---------------------------------------------------------------------------
// Timer colour presets (shown over the GIF, so all are light/bright).
// ---------------------------------------------------------------------------
export const GT_COLORS = [
  { id: "white", label: "Snow", hex: "#FFFFFF" },
  { id: "sakura", label: "Sakura", hex: "#FF9AAE" },
  { id: "mint", label: "Mint", hex: "#7BF1C0" },
  { id: "sun", label: "Sunny", hex: "#FFD66B" },
  { id: "sky", label: "Sky", hex: "#7CC8FF" },
  { id: "lavender", label: "Lavender", hex: "#C4A6FF" },
  { id: "coral", label: "Coral", hex: "#FF8A75" },
];
export const DEFAULT_TIMER_COLOR = "#FFFFFF";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export function isValidHex(v) {
  return typeof v === "string" && HEX_RE.test(v);
}

// Relative luminance (WCAG) of a #RRGGBB colour, 0 (black) .. 1 (white).
export function luminance(hex) {
  if (!isValidHex(hex)) return 1;
  const ch = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

// The digits sit on a translucent plate over the GIF. Bright digits get a
// dark plate; if someone picks a dark custom colour the plate flips to light
// so the time never becomes unreadable.
export function plateFor(hex) {
  return luminance(hex) < 0.3
    ? { background: "rgba(255,255,255,.78)", edge: "rgba(255,255,255,.9)" }
    : { background: "rgba(10,10,18,.58)", edge: "rgba(255,255,255,.14)" };
}

// ---------------------------------------------------------------------------
// Per-device room look (GIF + timer colour). Cosmetic only, so localStorage
// (guarded) rather than a table -- nothing here is worth a migration.
// ---------------------------------------------------------------------------
const SETTINGS_KEY = "sb.groupTimer.settings.v1";

export function loadGtSettings() {
  const fallback = { gif: DEFAULT_GIF_ID, color: DEFAULT_TIMER_COLOR };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      gif: GT_GIFS.some((g) => g.id === parsed?.gif) ? parsed.gif : fallback.gif,
      color: isValidHex(parsed?.color) ? parsed.color : fallback.color,
    };
  } catch {
    return fallback;
  }
}

export function saveGtSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* private mode etc. -- the choice still applies for this session */
  }
}

// ---------------------------------------------------------------------------
// Presence payload hygiene. Presence is client-supplied, so everything that
// comes off the wire is clamped before it's rendered.
// ---------------------------------------------------------------------------
export const PHASES = ["studying", "paused", "done", "idle"];
const MAX_ELAPSED = 600 * 60; // same 600-minute ceiling the DB enforces on sessions

const str = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const num = (v, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
};

export function sanitizeMeta(raw) {
  if (!raw || typeof raw !== "object") return null;
  const phase = PHASES.includes(raw.phase) ? raw.phase : (raw.studying ? "studying" : "idle");
  return {
    phase,
    subject: str(raw.subject, 24),
    topic: str(raw.topic, 60),
    mode: str(raw.mode, 20),
    elapsed: num(raw.elapsed, 0, MAX_ELAPSED) ?? 0,
    total: num(raw.total, 1, MAX_ELAPSED),
    // Server-clock ms at which this person's current focus "started" (already
    // net of pauses). Lets ANY viewer compute the true elapsed time at ANY
    // moment -- including right after joining -- with no extra messages.
    anchor: num(raw.anchor, 0, Number.MAX_SAFE_INTEGER),
    tab: str(raw.tab, 16),
    goal: str(raw.goal, 60),
    // server-clock ms when the current phase began (drives "paused for 7m")
    since: num(raw.since, 0, Number.MAX_SAFE_INTEGER),
    sentAt: num(raw.sentAt, 0, Number.MAX_SAFE_INTEGER) ?? 0,
  };
}

// One user can have several presence entries (two tabs, or phone + laptop).
// 1) Within ONE tab only its newest entry counts -- an old entry from the same
//    tab that lingers (missed leave diff, ghost socket) must never outvote the
//    fresh one; that is what made "paused" look like "still studying".
// 2) Across tabs, "studying" wins (studying anywhere = studying), then newest.
export function pickMeta(metas) {
  const clean = (metas || []).map(sanitizeMeta).filter(Boolean);
  if (!clean.length) return null;
  const perTab = new Map();
  clean.forEach((m, i) => {
    const k = m.tab || `#${i}`;
    const cur = perTab.get(k);
    if (!cur || m.sentAt >= cur.sentAt) perTab.set(k, m);
  });
  const pool0 = [...perTab.values()];
  const studying = pool0.filter((m) => m.phase === "studying");
  const pool = studying.length ? studying : pool0;
  return pool.reduce((best, m) => (m.sentAt >= best.sentAt ? m : best), pool[0]);
}

// Seconds a member has been studying, as of `nowMs` (pass SERVER-aligned time:
// Date.now() + clockOffset). With an anchor this is exact no matter when we
// joined; the receivedAt path is only a fallback for old clients.
export function liveElapsed(member, nowMs) {
  if (!member) return 0;
  if (member.phase !== "studying") return member.elapsed || 0;
  if (member.anchor) return Math.min(MAX_ELAPSED, Math.max(0, Math.floor((nowMs - member.anchor) / 1000)));
  const since = Math.max(0, (nowMs - (member.receivedAt || nowMs)) / 1000);
  return Math.min(MAX_ELAPSED, Math.floor((member.elapsed || 0) + since));
}

// Server-vs-device clock difference (ms), measured once via gt_server_time().
// Everyone converts through server time, so two phones whose clocks disagree
// by a minute still show the same number for the same person.
let cachedOffset = null;
export async function measureClockOffset(rpc) {
  if (cachedOffset && Date.now() - cachedOffset.at < 10 * 60 * 1000) return cachedOffset.value;
  // NTP-style: the sample with the SHORTEST round trip is the most trustworthy
  // (a slow/queued request can't tell us when the server read its clock). Up to
  // 3 tries; stop early once one is quick.
  let best = null;
  for (let i = 0; i < 3; i++) {
    try {
      const t0 = Date.now();
      const { data, error } = await rpc("gt_server_time");
      const t1 = Date.now();
      const server = Number(data);
      if (!error && Number.isFinite(server)) {
        const sample = { rtt: t1 - t0, value: Math.round(server - (t0 + t1) / 2) };
        if (!best || sample.rtt < best.rtt) best = sample;
        if (sample.rtt < 120) break;
      } else if (error) break;
    } catch { break; }
  }
  if (!best) return 0;
  cachedOffset = { value: best.value, at: Date.now() };
  return best.value;
}

export function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const PHASE_ORDER = { studying: 0, paused: 1, done: 2, idle: 3 };
export function comparePhase(a, b) {
  return (PHASE_ORDER[a] ?? 9) - (PHASE_ORDER[b] ?? 9);
}

// Join codes: accept "abc-123", "ABC 123", lowercase, stray spaces.
export function normalizeCode(input) {
  return String(input || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
}
export function prettyCode(code) {
  const c = String(code || "");
  return c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
}


// ---------------------------------------------------------------------------
// Room hours rule (v1). ONE source of truth for what the app tells people.
// Mirrors the header of supabase/migration_group_timer_v2.sql point for point
// (a test keeps the numbers in sync). Change both together.
// ---------------------------------------------------------------------------
export const GT_RULES_VERSION = "v1";
export const GT_LIMITS = { dailyCapMinutes: 780, maxSessionMinutes: 600, roomDayMinutes: 10 };
export const GT_RULES = [
  { title: "Only saved sessions count", body: "Room hours come from the Focus Timer sessions you save (the same records behind your study hours) — never from the live \"studying now\" cards, so they can't be faked." },
  { title: "Every minute counts", body: "A finished or early-saved session counts minute for minute, up to 600 min in one session. There's no minimum length, no bonus points and no multipliers." },
  { title: "From the moment you join", body: "A session counts for the room if you saved it while you were a member — whichever page you started it from. Minutes you've already earned stay in the room's totals if you leave or are removed; nothing is ever taken back. The leaderboard lists current members." },
  { title: "Days are IST", body: "Indian Standard Time, same as your streak. A session belongs to the day it was saved on — one day, one week, never two. Weeks run Monday to Sunday." },
  { title: "One daily ceiling", body: "At most 13 hours (780 min) per person per day count — the same ceiling as the global leaderboard. It's the only thing that can stop a saved minute from counting." },
  { title: "Ranking", body: "Ranked by exact minutes in the period you're viewing (rounded to the minute only when shown). Equal minutes share the same rank (1, 1, 3). On a tie the list shows more sessions first, then whoever joined earlier." },
  { title: "Room streak", body: "A day is a room day when at least one member studied 10+ minutes. The streak is the run of room days ending today — or yesterday if today has none yet, so it never shows broken before the day is over." },
  { title: "Weekly goal", body: "The host can set a weekly goal in hours. Progress is this week's room total (including members who've since left) divided by the goal. Last week's recap is measured against the goal as it's set now." },
];

export const GT_CHEERS = ["🔥", "👏", "💪", "🧠", "⚡", "❤️"];
export const NUDGE_AFTER_MS = 5 * 60 * 1000;      // paused this long before you can nudge
export const NUDGE_COOLDOWN_MS = 10 * 60 * 1000;  // per person you nudge
export const CHEER_COOLDOWN_MS = 4000;

export function sanitizeGoal(v) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 60) : "";
}

// Minutes -> "2h 05m" / "45m". Rounds ONCE, here, to the nearest minute.
export function fmtMinutes(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${String(r).padStart(2, "0")}m` : `${r}m`;
}

export function timeAgo(ts, nowMs = Date.now()) {
  if (!ts) return "Hasn't studied yet";
  const sec = Math.max(0, Math.floor((nowMs - new Date(ts).getTime()) / 1000));
  if (sec < 90) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}

// 7 ISO dates (Mon..Sun) starting at `fromISO` (the stats RPC's "from").
export function weekDates(fromISO) {
  if (!fromISO) return [];
  const [y, m, d] = String(fromISO).slice(0, 10).split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  return Array.from({ length: 7 }, (_, i) => new Date(base + i * 86400000).toISOString().slice(0, 10));
}
