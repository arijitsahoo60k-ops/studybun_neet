import React, { useMemo, useState, useEffect, useLayoutEffect, useRef, startTransition, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, BookOpen, Timer, Library, FolderClock, HelpCircle, ClipboardList,
  RotateCcw, CheckSquare, BarChart3, Sparkles, Trophy, Crown, User, Settings, Menu,
  NotebookPen, ChevronsLeft, ChevronsRight, Users, Layers, Camera, UsersRound,
} from "lucide-react";

import { THEMES, themeVars, timeWash, readStoredDarkMode, writeStoredDarkMode } from "./data/themes";
import { ALL_CHAPTERS, getActiveSubjects, getActiveChapters, DEFAULT_CHAPTER_PROGRESS, defaultChapterProgressFor } from "./data/syllabus";
import { useDeviceRow, useRealtimeTable, useChapterProgress, useMockAnalysis } from "./hooks/useRealtimeTable";
import { useFocusTimer } from "./hooks/useFocusTimer";
import { createTimerSessionTracker } from "./lib/timerSessionTracker";
import { useStudyPresence } from "./hooks/useStudyPresence";
import { useGroupTimerRoom } from "./hooks/useGroupTimerRoom";
import { useLeaderboardReconciliation } from "./hooks/useLeaderboardReconciliation";
import { useFocusMusic } from "./hooks/useFocusMusic";
import FocusMusicStage from "./components/FocusMusicStage";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import { useAuth } from "./lib/AuthContext";
import { buildExportPayload, downloadJSON, readFileAsJSON, importPayload, totalImported } from "./lib/dataPortability";
import { todayIST, toISTDateStr, tsToISTDateStr, daysFromNowIST, daysUntilIST, formatISTCalendarDate, istHour, weekdayShortIST } from "./lib/dateIST";
import { parseRecurringSkipDates, recurringParentId, createRecurringDeleters } from "./lib/recurring";

import Mascot from "./components/Mascot";
import TopNav from "./components/TopNav";
import BuddyGuide from "./components/BuddyGuide";
import { reactionMood, mascotEnergy, mascotTheme, MASCOTS } from "./data/mascots";
import PWAPrompt from "./components/PWAPrompt";
import { Confetti, LoadingScreen, DecorLayer } from "./components/ui";
import GlobalStyle from "./styles/GlobalStyle";
import CustomBackgroundLayer from "./components/CustomBackgroundLayer";
import ThemePhotoLayer from "./components/ThemePhotoLayer";

// Every page below is its own JS chunk, fetched only the moment it's
// actually navigated to instead of all being parsed/executed up front --
// that up-front cost (16 pages' worth of code, several pulling in recharts)
// was the real source of the "everything loads at once" lag, not anything
// about the nav itself. Mascot/BuddyGuide/TopNav/PWAPrompt/ui/GlobalStyle
// stay eager above since literally every screen needs them immediately.
const Onboarding = lazy(() => import("./pages/onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DailyOverview = lazy(() => import("./pages/DailyOverview"));
const StudyTracker = lazy(() => import("./pages/StudyTracker"));
const FocusTimer = lazy(() => import("./pages/FocusTimer"));
const GroupTimerPage = lazy(() => import("./pages/GroupTimer"));
const SyllabusPage = lazy(() => import("./pages/Syllabus"));
const BacklogPage = lazy(() => import("./pages/Backlog"));
const GoalsPage = lazy(() => import("./pages/Goals"));
const QuestionsPage = lazy(() => import("./pages/Questions"));
const MocksPage = lazy(() => import("./pages/Mocks"));
const RevisionPage = lazy(() => import("./pages/Revision"));
const PlannerPage = lazy(() => import("./pages/Planner"));
const AnalyticsPage = lazy(() => import("./pages/Analytics"));
const StudyStuffsPage = lazy(() => import("./pages/StudyStuffs"));
const AchievementsPage = lazy(() => import("./pages/Achievements"));
const LeaderboardPage = lazy(() => import("./pages/Leaderboard"));
const CommunityPage = lazy(() => import("./pages/Community"));
const ProfilePage = lazy(() => import("./pages/Profile"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const AIInsightsPage = lazy(() => import("./pages/AIInsights"));

// Map used both to prefetch a page's chunk the instant its nav pill is
// hovered/focused (see TopNav's onHoverItem below) and, further down, as
// the Suspense fallback while a chunk that wasn't prefetched in time is
// still being fetched.
const PAGE_LOADERS = {
  dashboard: () => import("./pages/Dashboard"),
  recap: () => import("./pages/DailyOverview"),
  study: () => import("./pages/StudyTracker"),
  timer: () => import("./pages/FocusTimer"),
  grouptimer: () => import("./pages/GroupTimer"),
  syllabus: () => import("./pages/Syllabus"),
  backlog: () => import("./pages/Backlog"),
  goals: () => import("./pages/Goals"),
  questions: () => import("./pages/Questions"),
  mocks: () => import("./pages/Mocks"),
  revision: () => import("./pages/Revision"),
  planner: () => import("./pages/Planner"),
  analytics: () => import("./pages/Analytics"),
  studystuffs: () => import("./pages/StudyStuffs"),
  ai: () => import("./pages/AIInsights"),
  achievements: () => import("./pages/Achievements"),
  leaderboard: () => import("./pages/Leaderboard"),
  community: () => import("./pages/Community"),
  profile: () => import("./pages/Profile"),
  settings: () => import("./pages/Settings"),
};

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "recap", label: "Daily Recap", icon: Camera },
  { id: "study", label: "Study Tracker", icon: BookOpen },
  { id: "timer", label: "Focus Timer", icon: Timer },
  { id: "grouptimer", label: "Group Timer", icon: UsersRound },
  { id: "syllabus", label: "Syllabus", icon: Library },
  { id: "backlog", label: "Backlog", icon: FolderClock },
  { id: "goals", label: "Goals", icon: NotebookPen },
  { id: "questions", label: "Question Practice", icon: HelpCircle },
  { id: "mocks", label: "Mock Tests", icon: ClipboardList },
  { id: "revision", label: "Revision Planner", icon: RotateCcw },
  { id: "planner", label: "Daily Planner", icon: CheckSquare },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "studystuffs", label: "Study Stuffs", icon: Layers },
  { id: "ai", label: "AI Insights", icon: Sparkles },
  { id: "achievements", label: "Achievements", icon: Trophy },
  { id: "leaderboard", label: "Leaderboard", icon: Crown },
  { id: "community", label: "Community", icon: Users },
  { id: "profile", label: "Profile", icon: User },
  { id: "settings", label: "Settings", icon: Settings },
];

// Suspense fallback for a lazy page chunk that's still being fetched.
// Deliberately not the full-screen LoadingScreen (that one assumes it owns
// the whole viewport, pre-nav) -- this sits inside the already-mounted page
// area so the nav bar and everything around it stays put while just the
// content underneath shows a small "still loading" beat.
function PageLoading({ mascot }) {
  return (
    <div className="sb-page-loading">
      <Mascot species={mascot} mood="studying" size={52} />
      <p>Loading...</p>
    </div>
  );
}

// Mirrors the same check Mascot.jsx makes independently -- kept local here
// too rather than shared, since it's a one-line read of the media query and
// both call sites want it available at mount without an extra import.
function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// "Today" for the whole app is IST, not the device's local/UTC date — see
// src/lib/dateIST.js for why the naive version silently broke around midnight.
const todayStr = todayIST;

// Study streak needed before the AI-powered features unlock. Keeps Smart
// Buddy chat / AI Insights (both of which spend real Gemini quota) tied to
// actual, sustained use of the app rather than being available from minute one.
export const FEATURE_UNLOCK_STREAK = 6;

export default function App() {
  const { user } = useAuth();
  const [page, setPageRaw] = useState("dashboard");
  const { row: profile, loading: profileLoading, save: saveProfile, refetch: refetchProfile } = useDeviceRow("profiles", {
    name: "", exam: "NEET UG", exam_date: "2027-05-02", exam_time: "14:00", subject_stream: "PCB", custom_exams: [], daily_goal: 6, daily_question_target: 50, theme: "Sakura Bloom", mascot: "bunny",
    dark_mode: readStoredDarkMode(false), streak_freeze_tokens: 1, streak_freeze_granted_days: 0,
  });
  // Appearance. `localDarkMode` is the single source of truth for what's on
  // screen, so flipping the switch in Settings repaints instantly (optimistic)
  // instead of waiting for the profiles round-trip. A value that arrives from
  // the server (first load, or changed on another device) is adopted below.
  const [localDarkMode, setLocalDarkMode] = useState(() => readStoredDarkMode(false));
  const darkMode = localDarkMode;
  useEffect(() => {
    if (typeof profile?.dark_mode === "boolean") setLocalDarkMode(profile.dark_mode);
  }, [profile?.dark_mode]);
  useEffect(() => { writeStoredDarkMode(darkMode); }, [darkMode]);
  const setDarkMode = (next) => {
    const val = typeof next === "function" ? Boolean(next(darkMode)) : Boolean(next);
    if (val === darkMode) return;
    setLocalDarkMode(val);
    saveProfile({ dark_mode: val });
  };
  const toggleDarkMode = () => setDarkMode((d) => !d);

  // Keep only genuinely global data live. Page-specific datasets/subscriptions
  // are activated when their page is visible, preventing navigation from
  // waking every table, realtime channel and derived list at once.
  const pageData = {
    dashboard: true, recap: true, study: true, timer: true, grouptimer: true, syllabus: true, backlog: true,
    goals: true, questions: true, mocks: true, revision: true, planner: true,
    analytics: true, ai: true, achievements: true, leaderboard: true, profile: true, settings: true,
  };
  const isPage = (...ids) => pageData[page] && ids.includes(page);
  // "recap" (Daily Recap) needs the same live tables Dashboard does — it's
  // the same today-stats data, just presented as a screenshot-friendly page
  // — so it rides along on every one of these `enabled` flags rather than
  // getting its own separate fetch.
  const sessionsQ = useRealtimeTable("study_sessions", { orderBy: "session_date", enabled: page === "dashboard" || page === "recap" || isPage("study", "backlog", "analytics", "ai", "leaderboard", "profile") });
  const timerSessionsQ = useRealtimeTable("timer_sessions", { orderBy: "created_at", enabled: page === "dashboard" || page === "recap" || isPage("timer", "analytics", "leaderboard", "profile") });
  const chapters = useChapterProgress({ enabled: page === "dashboard" || isPage("study", "timer", "syllabus", "mocks", "revision", "backlog", "ai", "leaderboard") });
  const questionsQ = useRealtimeTable("question_logs", { orderBy: "log_date", enabled: page === "dashboard" || page === "recap" || isPage("questions", "syllabus", "mocks", "backlog", "analytics", "ai", "leaderboard", "profile") });
  const mocksQ = useRealtimeTable("mock_tests", { orderBy: "mock_date", enabled: page === "dashboard" || page === "recap" || isPage("syllabus", "mocks", "backlog", "analytics", "ai", "leaderboard", "profile") });
  // Backlog's recovery engine reads mock mistake tags directly, so it needs
  // mock_analysis live too — not just on the Mocks page itself. Not needed
  // on Dashboard: no dashboard card or the achievement-unlock engine below
  // reads mockAnalysis, only mocks.length (mocksQ) does.
  const mockAnalysis = useMockAnalysis({ enabled: page === "mocks" || page === "backlog" });
  // Single-row cache of the last Smart AI Comparison result (Mock Tests
  // page) — lives in Supabase, not localStorage, so it survives switching
  // devices/browsers on the same account. Only relevant on the Mocks page
  // itself — no other page or background effect reads it — so it's gated
  // like everything else instead of staying open for the whole session.
  const mockAiCompareRow = useDeviceRow("mock_ai_comparison", { result: null }, { enabled: page === "mocks" });
  // Single-row cache of the last StudyBun AI (AI Insights page) result —
  // same reasoning as mockAiCompareRow above, gated to the AI Insights
  // page. Previously this lived only in that page's local useState, so it
  // disappeared the instant you left the page or refreshed; now it
  // survives nav/refresh/devices while still only staying open when needed.
  const aiInsightsRow = useDeviceRow("ai_insights", { result: null, generated_at: null }, { enabled: page === "ai" });
  // Focus Mode's last-picked ambient scene (see supabase/migration_focus_mode_settings.sql).
  // Only the Focus Timer page ever opens Focus Mode, so it's gated to that page
  // like the other page-scoped single-row caches above.
  const focusModeRow = useDeviceRow("focus_mode_settings", { scene: "rain" }, { enabled: page === "timer" });
  const revisionsQ = useRealtimeTable("revision_plans", { orderBy: "due_date", ascending: true, enabled: page === "dashboard" || page === "recap" || isPage("syllabus", "mocks", "backlog", "revision", "ai", "profile") });
  const tasksQ = useRealtimeTable("tasks", { orderBy: "due_date", enabled: page === "dashboard" || page === "recap" || isPage("backlog", "planner", "profile") });
  const backlogItemsQ = useRealtimeTable("backlog_items", { orderBy: "created_at", enabled: page === "dashboard" || isPage("backlog", "ai") });
  const goalsQ = useRealtimeTable("goals", { orderBy: "created_at", ascending: true, enabled: isPage("goals", "achievements") });
  const achievementsQ = useRealtimeTable("achievements", { orderBy: "unlocked_at", enabled: page === "dashboard" || page === "achievements" });
  // Streak-freeze tokens: see supabase/migration_streak_freeze.sql. A frozen
  // date is treated exactly like a genuine study day (folded into
  // streakDays below), so a missed day doesn't reset the streak to 0.
  const streakFreezesQ = useRealtimeTable("streak_freezes", { orderBy: "frozen_date", enabled: page === "dashboard" || page === "planner" || page === "profile" });

  // Lives here (not inside FocusTimer) so switching pages never resets it.
  // Every session — whether it runs to the end naturally, is ended early via
  // the timer's manual Save button, or is a Stopwatch session stopped by the
  // user — is logged to timer_sessions automatically here, which is what
  // lets focus-timer time count toward study hours even if the user never
  // fills in the "what did you study" card afterward. `completed` is always
  // true for anything the hook reports here (see useFocusTimer.js's finish/
  // saveEarly) — the leaderboard's own anti-cheat check in
  // supabase/migration_leaderboard.sql (lb_recompute's planned-vs-actual
  // tolerance) is what fairly distinguishes a full completion from an early
  // save, not this flag.
  // Fire-and-forget here would mean a failed insert (bad network, expired
  // session, etc.) silently drops the entire completed session — no
  // console.error is visible to the user, and this is the single biggest
  // point-earning action in the app. So this awaits the insert and, on
  // failure, surfaces a toast with a Retry button that re-attempts the same
  // payload rather than losing it. clientToken is minted once per attempt
  // (not per network call) and reused by the retry closure, so if the
  // original insert actually committed and only the response was lost, the
  // retry upserts onto that same row (see insert()'s idempotencyKey +
  // migration_retry_idempotency.sql) instead of creating a duplicate.
  //
  // The row is logged the instant the timer ends, but the person can still
  // hit "Discard" (or Reset) on the "What did you study?" card afterwards.
  // lib/timerSessionTracker remembers the just-logged row and deletes it on
  // discard (the DB's delete trigger re-runs the leaderboard recompute, so
  // points/streak roll back too). Created once; it reads the latest
  // insert/remove/user through trackerDepsRef so it never goes stale.
  const trackerDepsRef = useRef({});
  trackerDepsRef.current = { user, insert: timerSessionsQ.insert, remove: timerSessionsQ.remove };
  const timerTrackerRef = useRef(null);
  if (!timerTrackerRef.current) {
    timerTrackerRef.current = createTimerSessionTracker({
      getUserId: () => trackerDepsRef.current.user?.id,
      insert: (payload, opts) => trackerDepsRef.current.insert(payload, opts),
      remove: (id) => trackerDepsRef.current.remove(id),
      onInsertFailed: (retry) => showToast("Couldn't save your session — check your connection.", retry, "Retry"),
      onRemoveFailed: (retry) => showToast("Couldn't remove that session — check your connection.", retry, "Retry"),
    });
  }
  const focusTimer = useFocusTimer({
    onComplete: ({ mode, plannedMinutes, actualMinutes, completed, endedAt }) => {
      // endedAt is only set for a late finish (app reopened after the timer
      // already ran out): date the row when it really ended so it lands on
      // the right day (e.g. a session ending 23:50 isn't pushed to the next
      // day). Normal finishes omit it and keep the DB's default now().
      timerTrackerRef.current.log({
        mode, planned_minutes: plannedMinutes, actual_minutes: actualMinutes, completed,
        ...(endedAt ? { created_at: endedAt } : {}),
      });
    },
    onSessionSettled: (info) => timerTrackerRef.current.settle(info),
  });
  // Focus music lives up here for the same reason the timer does: the one
  // real player must survive page navigation and the settings dialog
  // closing. It only ever makes sound while the timer is running (see
  // useFocusMusic) -- never just because the app was opened.
  const focusMusic = useFocusMusic({ timerRunning: focusTimer.running, page });

  // Lifted to the root (not inside the Leaderboard page) so presence stays
  // accurate — and other users can see it — even while running the timer
  // from a completely different page.
  const studyingIds = useStudyPresence(focusTimer.running);
  // Group Timer rooms: which room I'm in + telling that room what my timer
  // is doing. Root-level for the same reason as presence above.
  const groupRoom = useGroupTimerRoom({ timer: focusTimer, userId: user?.id, notify: (m) => showToast(m) });

  // Aggressive Focus Mode: an opt-in Focus Timer setting (see useFocusTimer)
  // that blocks switching to any other page while a session is actively
  // running, so a stray/distracted tap can't pull someone out of it. This
  // is the single place every navigation path in the app funnels through
  // (sidebar, mobile nav, dashboard shortcuts, buddy tips, recovery-item
  // shortcuts, push-notification deep links) — wrapping it here means none
  // of those call sites need their own guard. Deliberately never blocks
  // returning to the timer itself, and clears the instant the session is
  // paused, finished, or reset (sessionActive/running goes false), so no
  // one can ever get stuck on one page.
  const setPage = (id) => {
    if (id !== "timer" && id !== "grouptimer" && focusTimer.running && focusTimer.aggressiveMode) {
      showToast("Aggressive mode is on — pause or finish your session to leave 🐰");
      return;
    }
    setPageRaw(id);
  };
  // The push-notification listener below is registered once (mount-only
  // effect, see its own comment) and could otherwise keep calling a stale
  // setPage closure -- one that was still holding whatever
  // running/aggressiveMode looked like at mount -- for as long as the tab
  // stays open. Routing every call through a ref instead means it always
  // uses this render's guard logic, no matter how long the app has been open.
  const setPageRef = useRef(setPage);
  useEffect(() => { setPageRef.current = setPage; });

  const reducedMotion = useMemo(prefersReducedMotion, []);
  // <main> is the app's only scroll container, so without this a nav switch
  // could land you mid-scroll on the new page if the old one had you scrolled
  // down -- jarring on its own, and doubly so once page switches animate.
  const mainRef = useRef(null);
  useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [page]);

  // StudyBun's push notifications deep-link to a page id (dashboard,
  // planner, revision, backlog, analytics, goals) via the service worker
  // (src/sw.js). Two delivery paths land here:
  //  1. Cold start / new tab: the SW opens "<origin>/?page=revision".
  //  2. App already open: the SW postMessages the existing tab instead of
  //     force-navigating it (see notificationclick in sw.js).
  useEffect(() => {
    const validPages = new Set(NAV.map((n) => n.id));
    const applyPage = (id) => { if (validPages.has(id)) setPageRef.current(id); };

    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("page");
    if (fromUrl) {
      applyPage(fromUrl);
      params.delete("page");
      const rest = params.toString();
      window.history.replaceState({}, "", rest ? `?${rest}` : window.location.pathname);
    }

    const onMessage = (event) => {
      if (event.data?.type === "studybun-notification-click") applyPage(event.data.page);
    };
    navigator.serviceWorker?.addEventListener?.("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener?.("message", onMessage);
  }, []);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Desktop/tablet sidebar collapse (icons-only rail) -- persisted so it
  // survives reloads, same guarded-localStorage pattern as
  // useCustomBackground.js. Doesn't touch the phone hamburger dropdown at
  // all, since .sb-sidebar is display:none below 720px regardless.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("sb-sidebar-collapsed-v1") === "1";
    } catch {
      return false;
    }
  });
  // Tracks whether the sidebar is mid collapse/expand transition, so the
  // .sb-sidebar-animating class (will-change: width/flex-basis) is only
  // applied for the ~260ms of the transition itself rather than left on
  // permanently -- a lingering will-change keeps the element on its own
  // compositor layer at all times, which costs memory/GPU for no benefit
  // once the animation has finished.
  const [sidebarAnimating, setSidebarAnimating] = useState(false);
  const sidebarAnimTimeoutRef = useRef(null);
  const toggleSidebarCollapsed = () => {
    setSidebarAnimating(true);
    if (sidebarAnimTimeoutRef.current) clearTimeout(sidebarAnimTimeoutRef.current);
    sidebarAnimTimeoutRef.current = setTimeout(() => setSidebarAnimating(false), 300);
    setSidebarCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem("sb-sidebar-collapsed-v1", next ? "1" : "0");
      } catch {
        // localStorage unavailable (private mode etc.) -- collapse still
        // works for this session, it just won't persist across reloads.
      }
      return next;
    });
  };
  useEffect(() => {
    return () => {
      if (sidebarAnimTimeoutRef.current) clearTimeout(sidebarAnimTimeoutRef.current);
    };
  }, []);

  const [toast, setToast] = useState(null); // { message, undo? }
  const [celebrateType, setCelebrateType] = useState(null); // null | "confetti" | "petals"
  const [hopping, setHopping] = useState(false);
  const toastTimer = useRef(null);

  // Mobile dropdown's nav highlight: a single pill sliding between nav
  // items, moved with a plain CSS transform transition via refs rather than
  // a re-measuring approach (e.g. framer-motion's layoutId), so the browser
  // only does layout math once per page change and the slide itself is a
  // compositor-only transform animation -- no per-frame stutter at high
  // refresh rates. (The tablet/desktop top nav has its own independent
  // implementation inside TopNav.jsx.)
  const mobileNavItemRefs = useRef({});
  const mobileNavPillRef = useRef(null);

  const positionNavPill = (pillEl, itemEl, instant) => {
    if (!pillEl || !itemEl) return;
    const targetW = itemEl.offsetWidth;
    const targetH = itemEl.offsetHeight;
    const targetX = itemEl.offsetLeft;
    const targetY = itemEl.offsetTop;

    if (instant) {
      pillEl.style.transition = "none";
      pillEl.style.width = `${targetW}px`;
      pillEl.style.height = `${targetH}px`;
      pillEl.style.transform = `translate(${targetX}px, ${targetY}px)`;
      // Force a reflow so the "transition: none" above actually applies
      // before we hand control back to the stylesheet's transition on the
      // next frame (otherwise the browser can coalesce both style writes
      // into one frame and animate from the old position anyway).
      void pillEl.offsetHeight;
      requestAnimationFrame(() => { pillEl.style.transition = ""; });
      pillEl.__sbW = targetW; pillEl.__sbH = targetH; pillEl.__sbX = targetX; pillEl.__sbY = targetY;
      return;
    }

    // Animate purely via `transform` (translate + scale) instead of
    // transitioning width/height directly. Transitioning width/height forces
    // a real layout+paint pass on the main thread every frame -- cheap
    // enough to hide at 60Hz but enough to drop frames at 120Hz+ once
    // anything else is competing for the main thread. `transform` alone can
    // run entirely on the compositor thread, so it stays smooth regardless
    // of refresh rate. This is the standard FLIP technique: snap the box to
    // its FINAL width/height instantly (cheap, done once, not animated),
    // start its transform at a scaled-down stand-in for the OLD box, then
    // let the transition animate the scale/translate back to identity --
    // same visual slide-and-resize, GPU-only.
    const prevW = pillEl.__sbW || targetW;
    const prevH = pillEl.__sbH || targetH;
    const prevX = pillEl.__sbX ?? targetX;
    const prevY = pillEl.__sbY ?? targetY;

    pillEl.style.transition = "none";
    pillEl.style.width = `${targetW}px`;
    pillEl.style.height = `${targetH}px`;
    const scaleX = targetW ? prevW / targetW : 1;
    const scaleY = targetH ? prevH / targetH : 1;
    pillEl.style.transform = `translate(${prevX}px, ${prevY}px) scale(${scaleX}, ${scaleY})`;
    void pillEl.offsetHeight; // force the "from" state to actually paint first
    pillEl.style.transition = "";
    requestAnimationFrame(() => {
      pillEl.style.transform = `translate(${targetX}px, ${targetY}px) scale(1, 1)`;
    });

    pillEl.__sbW = targetW; pillEl.__sbH = targetH; pillEl.__sbX = targetX; pillEl.__sbY = targetY;
  };

  // GlobalStyle's @font-face (Baloo 2 / Nunito) loads async and swaps in
  // after first paint (display: swap). The pill above is measured from the
  // nav button's live DOM rect, so if that swap changes button width/height
  // even slightly, the pill is left sized and positioned for the old
  // fallback-font metrics until the next page change or resize repositions
  // it. Repositioning once fonts finish loading closes that gap. Reading
  // page/mobileNavOpen via refs (instead of closing over the values at
  // effect-creation time) keeps this correct even if the user has already
  // navigated by the time the fonts.ready promise resolves.
  const pageRef = useRef(page);
  pageRef.current = page;
  const mobileNavOpenRef = useRef(mobileNavOpen);
  mobileNavOpenRef.current = mobileNavOpen;
  useEffect(() => {
    if (!document.fonts?.ready) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      if (mobileNavOpenRef.current) {
        positionNavPill(mobileNavPillRef.current, mobileNavItemRefs.current[pageRef.current], true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useLayoutEffect(() => {
    if (mobileNavOpen) positionNavPill(mobileNavPillRef.current, mobileNavItemRefs.current[page], true);
  }, [page, mobileNavOpen]);

  // Pre-fetches a lazy page's JS chunk the moment its nav item is
  // hovered/focused, so by the time the click actually lands the chunk is
  // usually already sitting in the browser's cache and Suspense never has
  // to show PageLoading at all -- the switch just feels instant. Each id is
  // only ever fetched once per session.
  const prefetchedPages = useRef(new Set());
  const prefetchPage = (id) => {
    if (prefetchedPages.current.has(id)) return;
    const loader = PAGE_LOADERS[id];
    if (!loader) return;
    prefetchedPages.current.add(id);
    loader().catch(() => { prefetchedPages.current.delete(id); });
  };

  // Pass an `undo` callback for any action that can't otherwise be reversed —
  // the toast then stays up longer and shows a button, labeled "Undo" by
  // default. Pass `undoLabel` to relabel that button for a different
  // purpose — e.g. "Retry" when the callback re-attempts a failed save
  // rather than reversing a successful one.
  const showToast = (msg, undo, undoLabel) => {
    setToast({ message: msg, undo: undo || null, undoLabel: undoLabel || "Undo" });
    setHopping(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), undo ? 5200 : 2600);
    setTimeout(() => setHopping(false), 650);
  };
  const runUndo = () => {
    if (toast?.undo) toast.undo();
    clearTimeout(toastTimer.current);
    setToast(null);
  };
  const fireCelebrate = (type = "confetti") => {
    setCelebrateType(type);
    setTimeout(() => setCelebrateType(null), type === "petals" ? 1900 : 1400);
  };

  // Self-heals the leaderboard/points system: forces a fresh, race-free
  // server recompute on app open and on tab/app refocus (see
  // useLeaderboardReconciliation.js + supabase/migration_leaderboard_integrity.sql),
  // and surfaces a toast if it finds points that had gone missing from an
  // earlier, since-fixed race and just got added back.
  useLeaderboardReconciliation(user?.id, (delta) => {
    const rounded = Math.round(delta).toLocaleString();
    showToast(`✨ Found and added ${rounded} pts that were missing — you're all caught up!`);
  });

  const theme = THEMES[profile?.theme] || THEMES["Sakura Bloom"];
  const mascot = profile?.mascot || "bunny";
  const mTheme = mascotTheme(mascot);
  // Memoised: App re-renders every second while the focus timer runs, and an
  // unchanged style object lets React skip re-applying ~70 custom properties.
  // `hour` keeps the time-of-day wash moving like it always did.
  const washHour = new Date().getHours();
  const cssVars = useMemo(
    () => ({ ...themeVars(theme, darkMode), "--time-wash": timeWash(darkMode) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, darkMode, washHour]
  );

  /* ---------- derived stats (shared by Dashboard / Analytics / AI Insights) ---------- */
  const sessions = sessionsQ.rows;
  const timerSessions = timerSessionsQ.rows;
  const questions = questionsQ.rows;
  const mocks = mocksQ.rows;
  const revisions = revisionsQ.rows;
  const tasks = tasksQ.rows;
  const backlogItems = backlogItemsQ.rows;
  const goals = goalsQ.rows;

  const getChStatus = useCallback((key) => {
    const [subject, chapter] = key.split("::");
    return chapters.map[key] || { ...defaultChapterProgressFor(chapter), subject, chapter };
  }, [chapters.map]);

  // A study_sessions row logged from the "what did you study?" card after a
  // focus-timer session is tagged platform: "Focus Timer" so its minutes
  // aren't double counted — the real minutes for that session already live
  // in timer_sessions, logged automatically the moment the timer finishes.
  // Memoised so downstream streakDays / weeklyData don't recompute on every
  // 1-second tick of the Focus Timer.
  const manualSessions = useMemo(
    () => sessions.filter((s) => s.platform !== "Focus Timer"),
    [sessions]
  );

  const todaySessions = sessions.filter((s) => s.session_date === todayStr());
  const todayManualMinutes = manualSessions.filter((s) => s.session_date === todayStr()).reduce((a, s) => a + Number(s.minutes || 0), 0);
  const todayTimerMinutes = timerSessions.filter((ts) => tsToISTDateStr(ts.created_at) === todayStr()).reduce((a, ts) => a + Number(ts.actual_minutes || 0), 0);
  const todayMinutes = todayManualMinutes + todayTimerMinutes;
  const todayHours = +(todayMinutes / 60).toFixed(1);
  const todayLoggedHours = +(todayManualMinutes / 60).toFixed(1);
  const todayTimerHours = +(todayTimerMinutes / 60).toFixed(1);

  // A day also qualifies if the user planned tasks for it (Daily Planner)
  // and cleared every single one — finishing your whole plan for the day is
  // just as real a signal of "showing up" as logging minutes, and it means
  // someone who plans light but finishes everything isn't locked out of a
  // streak just because they didn't hit a timer. Requires at least one task
  // due that day (an empty day doesn't vacuously count), and every task due
  // that day — not just the one just toggled — has to be Completed.
  const taskDayCompletion = useMemo(() => {
    const byDay = new Map();
    tasks.forEach((t) => {
      if (!t.due_date) return;
      const bucket = byDay.get(t.due_date) || { total: 0, completed: 0 };
      bucket.total += 1;
      if (t.status === "Completed") bucket.completed += 1;
      byDay.set(t.due_date, bucket);
    });
    const days = new Set();
    byDay.forEach((v, day) => { if (v.total > 0 && v.completed === v.total) days.add(day); });
    return days;
  }, [tasks]);

  // What counts as a "genuine study day" here must exactly match the
  // server-side rule in lb_calc_streak() — the canonical definition lives in
  // supabase/migration_streak_uniform_v2.sql. If you change any threshold
  // or add a new signal, update BOTH lb_calc_streak AND this block or the
  // Dashboard/Profile streak will diverge from the Leaderboard again.
  //
  // THE RULE (5 signals — identical client and server):
  //   1. Manual study session >= 5 min  (platform !== 'Focus Timer')
  //   2. Completed focus-timer session >= 10 min actual elapsed
  //   3. At least one question logged (count >= 1)
  //   4. Every task planned for the day completed (non-empty day only)
  //   5. Streak-freeze token spent on that date
  //
  // Signal 1 intentionally EXCLUDES platform='Focus Timer' rows. Those rows
  // have `minutes` = the planned timer duration (not actual elapsed time) and
  // the real signal for timer work is signal 2 (timer_sessions). Including
  // them here would let a 3-second timer run count as a 25-min study day.
  // The server lb_calc_streak now has the same filter — this is what caused
  // the leaderboard showing a higher streak than the dashboard (server was
  // counting those rows, client wasn't). Keep these in sync if any of
  // them ever changes.
  const streakDays = useMemo(() => {
    const days = new Set();
    // Signal 1: manual sessions only (manualSessions excludes platform='Focus Timer').
    // Server lb_calc_streak applies the same filter — see migration_streak_uniform_v2.sql.
    manualSessions.forEach((s) => { if (Number(s.minutes || 0) >= 5) days.add(s.session_date); });
    timerSessions.forEach((ts) => {
      if (ts.completed && Number(ts.actual_minutes || 0) >= 10) days.add(tsToISTDateStr(ts.created_at));
    });
    questions.forEach((q) => { if (Number(q.count || 0) >= 1) days.add(q.log_date); });
    taskDayCompletion.forEach((d) => days.add(d));
    streakFreezesQ.rows.forEach((r) => days.add(r.frozen_date));
    return days;
  }, [manualSessions, timerSessions, questions, taskDayCompletion, streakFreezesQ.rows]);

  // A streak only breaks after a full missed day, not the instant "today"
  // hasn't been logged yet (it might still be 9am!). So: if today has no
  // qualifying day yet, start counting from yesterday instead of returning
  // 0 outright. That means the number only drops to 0 once *both* today and
  // yesterday have gone by with nothing logged — i.e. a real 2-day gap.
  const streakActiveToday = useMemo(() => streakDays.has(todayStr()), [streakDays]);

  const streak = useMemo(() => {
    const days = streakDays;
    let d = todayStr();
    if (!days.has(d)) d = toISTDateStr(new Date(d).getTime() - 86400000);
    let n = 0;
    while (days.has(d)) { n++; d = toISTDateStr(new Date(d).getTime() - 86400000); }
    return n;
  }, [streakDays]);

  const activeSubjects = useMemo(() => getActiveSubjects(profile), [profile?.subject_stream]);
  const activeChapters = useMemo(() => getActiveChapters(profile), [profile?.subject_stream]);
  const backlogChapters = useMemo(
    () => activeChapters.filter((c) => !["Completed", "Mastered"].includes(getChStatus(c.key).status)),
    [activeChapters, getChStatus]
  );
  const completedCount = activeChapters.length - backlogChapters.length;
  const overallPct = activeChapters.length ? (completedCount / activeChapters.length) * 100 : 0;
  const masteredCount = useMemo(
    () => activeChapters.filter((c) => getChStatus(c.key).status === "Mastered").length,
    [activeChapters, getChStatus]
  );

  // All-time history stats — these power the long-haul achievements. They're
  // deliberately based on *lifetime* records (longest streak ever hit, total
  // days logged) rather than the live `streak` above, so a badge earned once
  // stays earned even after a day gets missed and the current streak resets.
  const sortedStudyDays = useMemo(() => Array.from(streakDays).sort(), [streakDays]);
  const totalStudyDays = sortedStudyDays.length;
  const totalManualMinutes = manualSessions.reduce((a, s) => a + Number(s.minutes || 0), 0);
  const totalTimerMinutes = timerSessions.reduce((a, ts) => a + Number(ts.actual_minutes || 0), 0);
  const totalHours = +((totalManualMinutes + totalTimerMinutes) / 60).toFixed(1);
  const totalLoggedHours = +(totalManualMinutes / 60).toFixed(1);
  const totalTimerHours = +(totalTimerMinutes / 60).toFixed(1);
  const { longestStreak, hadComeback } = useMemo(() => {
    let longest = 0, run = 0, prev = null, comeback = false;
    sortedStudyDays.forEach((d) => {
      if (prev) {
        const gap = Math.round((new Date(d) - new Date(prev)) / 86400000);
        if (gap === 1) run += 1;
        else { if (gap >= 14) comeback = true; run = 1; }
      } else run = 1;
      longest = Math.max(longest, run);
      prev = d;
    });
    return { longestStreak: longest, hadComeback: comeback };
  }, [sortedStudyDays]);
  const revisionsCompletedCount = revisions.filter((r) => r.status === "Completed").length;
  const completedTasksCount = tasks.filter((t) => t.status === "Completed").length;
  const backlogClearedCount = backlogItems.filter((b) => b.status === "Completed").length;

  const weeklyData = useMemo(() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = toISTDateStr(Date.now() - i * 86400000);
      const loggedMins = manualSessions.filter((s) => s.session_date === d).reduce((a, s) => a + Number(s.minutes || 0), 0);
      const timerMins = timerSessions.filter((ts) => tsToISTDateStr(ts.created_at) === d).reduce((a, ts) => a + Number(ts.actual_minutes || 0), 0);
      arr.push({
        day: formatISTCalendarDate(d, { weekday: "short" }),
        hours: +(loggedMins / 60).toFixed(1),
        timerHours: +(timerMins / 60).toFixed(1),
      });
    }
    return arr;
  }, [manualSessions, timerSessions]);

  const subjectPie = useMemo(() => {
    const allowed = new Set(activeSubjects);
    const map = {};
    sessions.forEach((s) => {
      const subj = s.subject === "Maths" ? "Mathematics" : s.subject;
      if (!allowed.has(subj)) return;
      map[subj] = (map[subj] || 0) + Number(s.minutes || 0);
    });
    return Object.entries(map).map(([name, mins]) => ({ name, value: +(mins / 60).toFixed(2) }));
  }, [sessions, activeSubjects]);

  const totalQuestions = questions.reduce((a, q) => a + Number(q.count || 0), 0);
  const todayQuestions = questions.filter((q) => q.log_date === todayStr()).reduce((a, q) => a + Number(q.count || 0), 0);
  const dailyQuestionTarget = profile?.daily_question_target || 50;
  const questionTargetPct = Math.min(100, (todayQuestions / dailyQuestionTarget) * 100);
  const questionTargetMet = todayQuestions >= dailyQuestionTarget;

  const daysToExam = profile ? daysUntilIST(profile.exam_date) : 0;

  // useMemo here (matching weeklyData/subjectPie/streakActiveToday above)
  // isn't just tidiness: Dashboard.jsx now does a shallow-compare React.memo
  // to skip re-rendering (and re-running its two Recharts charts) on
  // renders that don't concern it -- e.g. the Focus Timer's once-a-second
  // tick, which lives in this same component and re-renders everything
  // downstream regardless of page. A plain `.filter()` call here would
  // hand Dashboard a brand-new array every single render even when nothing
  // about revisions changed, which defeats that memo before it can help.
  const dueRevisions = useMemo(() => revisions.filter((r) => r.status === "Pending" && r.due_date <= todayStr()), [revisions]);
  const upcomingRevisions = useMemo(() => revisions.filter((r) => r.status === "Pending" && r.due_date > todayStr()), [revisions]);
  const overdueRevisions = useMemo(() => revisions.filter((r) => r.status === "Pending" && r.due_date < todayStr()), [revisions]);

  const buddyMood = reactionMood({
    finishedGoal: todayHours >= (profile?.daily_goal || 6),
    streak: streak >= 3,
    revisionOverdue: overdueRevisions.length > 0,
    noStudyToday: todayHours === 0,
    hour: istHour(),
  });
  // Shared "how alive should the mascot look" value -- same numbers that
  // picked the mood also pick how energetically it plays that mood, so a
  // mascot at 5.9/6h feels visibly more energetic than one at 0.5/6h even
  // though both are technically "happy".
  const buddyEnergy = mascotEnergy({ mood: buddyMood, todayHours, dailyGoal: profile?.daily_goal || 6 });

  const lectureSessions = sessions.filter((s) => s.session_type === "Lecture").length;
  const finishedGoalToday = todayHours >= (profile?.daily_goal || 6);

  // Full achievement roster, grouped loosely by how hard it is to earn.
  // `current` / `target` drive the progress bar on the Achievements page;
  // `goal` is the plain-language "what to achieve" and `howTo` is the
  // explicit "how you unlock it" instruction shown on that page too.
  const achievementDefs = [
    // ---- Bronze: first steps ----
    { id: "first_hop", tier: "Bronze", label: `First ${mTheme.verbing}`, emoji: MASCOTS[mascot]?.emoji || "🐰",
      goal: "Log your very first study session.", howTo: "Add one session in Study Tracker.",
      current: sessions.length, target: 1, cond: sessions.length >= 1 },
    { id: "lecture_bunny", tier: "Bronze", label: `Lecture ${MASCOTS[mascot]?.label || "Bunny"}`, emoji: "📚",
      goal: "Log 5 Lecture-type sessions.", howTo: "Set Session Type to \"Lecture\" 5 times in Study Tracker.",
      current: lectureSessions, target: 5, cond: lectureSessions >= 5 },
    { id: "carrot_collector", tier: "Bronze", label: `${mTheme.collectible.name[0].toUpperCase()}${mTheme.collectible.name.slice(1)} Collector`, emoji: mTheme.collectible.emoji,
      goal: "Solve 100 questions in total.", howTo: "Log question counts in Question Practice until your lifetime total passes 100.",
      current: totalQuestions, target: 100, cond: totalQuestions >= 100 },
    { id: "mock_warrior", tier: "Bronze", label: "Mock Warrior", emoji: "🎯",
      goal: "Log your first mock test.", howTo: "Add a mock in Mock Tests after you take one.",
      current: mocks.length, target: 1, cond: mocks.length >= 1 },
    { id: "sakura_scholar", tier: "Bronze", label: "Sakura Scholar", emoji: "🌸",
      goal: "Complete 10 chapters.", howTo: "Mark 10 chapters Completed or Mastered in Syllabus.",
      current: completedCount, target: 10, cond: completedCount >= 10 },
    { id: "productivity_wizard", tier: "Bronze", label: "Productivity Wizard", emoji: "✨",
      goal: "Hit your daily study goal on any single day.", howTo: `Log ${profile?.daily_goal || 6}+ hours in one day (check Settings for your goal).`,
      current: finishedGoalToday ? 1 : 0, target: 1, cond: finishedGoalToday },
    { id: "task_tackler", tier: "Bronze", label: "Task Tackler", emoji: "✅",
      goal: "Complete 10 tasks from your Daily Planner.", howTo: "Check off tasks in Daily Planner until 10 are marked Completed.",
      current: completedTasksCount, target: 10, cond: completedTasksCount >= 10 },
    { id: "backlog_breaker", tier: "Bronze", label: "Backlog Breaker", emoji: "🧹",
      goal: "Clear 5 items from your backlog.", howTo: "Mark 5 Backlog entries as Completed.",
      current: backlogClearedCount, target: 5, cond: backlogClearedCount >= 5 },

    // ---- Silver: a couple of real weeks ----
    { id: "consistency", tier: "Silver", label: "Consistency Champion", emoji: "🔥",
      goal: "Reach a 3-day study streak.", howTo: "Log at least one session on 3 days in a row.",
      current: longestStreak, target: 3, cond: longestStreak >= 3 },
    { id: "week_warrior", tier: "Silver", label: "Week Warrior", emoji: "🗓️",
      goal: "Reach a 7-day study streak.", howTo: "Study every day for a full week without a gap.",
      current: longestStreak, target: 7, cond: longestStreak >= 7 },
    { id: "question_machine", tier: "Silver", label: "Question Machine", emoji: "💯",
      goal: "Solve 500 questions in total.", howTo: "Keep logging Question Practice sessions.",
      current: totalQuestions, target: 500, cond: totalQuestions >= 500 },
    { id: "revision_hero", tier: "Silver", label: "Revision Hero", emoji: "📖",
      goal: "Complete 10 revisions.", howTo: "Mark 10 entries Completed in Revision Planner.",
      current: revisionsCompletedCount, target: 10, cond: revisionsCompletedCount >= 10 },
    { id: "chapter_crusher", tier: "Silver", label: "Chapter Crusher", emoji: "⚔️",
      goal: "Complete 25 chapters.", howTo: "Push 25 chapters to Completed or Mastered in Syllabus.",
      current: completedCount, target: 25, cond: completedCount >= 25 },
    { id: "mock_marathoner", tier: "Silver", label: "Mock Marathoner", emoji: "🏃",
      goal: "Log 5 mock tests.", howTo: "Add 5 mocks over time in Mock Tests.",
      current: mocks.length, target: 5, cond: mocks.length >= 5 },
    { id: "century_club", tier: "Silver", label: "Century Club", emoji: "⏳",
      goal: "Rack up 100 total study hours.", howTo: "Keep logging sessions — hours add up across all time, not just today.",
      current: totalHours, target: 100, cond: totalHours >= 100 },

    // ---- Gold: weeks of real discipline ----
    { id: "monthly_master", tier: "Gold", label: "Monthly Master", emoji: "🌕",
      goal: "Reach a 30-day study streak.", howTo: "Study every single day for a full month, no exceptions.",
      current: longestStreak, target: 30, cond: longestStreak >= 30 },
    { id: "half_century", tier: "Gold", label: "Half Century", emoji: "🏏",
      goal: "Complete 50 chapters.", howTo: "Keep clearing Syllabus chapters to Completed or Mastered.",
      current: completedCount, target: 50, cond: completedCount >= 50 },
    { id: "thousand_carrots", tier: "Gold", label: `Thousand ${mTheme.collectible.plural}`, emoji: mTheme.collectible.emoji,
      goal: "Solve 1,000 questions in total.", howTo: "Consistent daily Question Practice logging.",
      current: totalQuestions, target: 1000, cond: totalQuestions >= 1000 },
    { id: "mock_titan", tier: "Gold", label: "Mock Titan", emoji: "🛡️",
      goal: "Log 20 mock tests.", howTo: "Sit and log 20 mocks over your prep.",
      current: mocks.length, target: 20, cond: mocks.length >= 20 },
    { id: "syllabus_slayer", tier: "Gold", label: "Syllabus Slayer", emoji: "📘",
      goal: "Finish 100% of the syllabus.", howTo: "Every chapter marked Completed or Mastered in Syllabus.",
      current: Math.round(overallPct), target: 100, cond: overallPct >= 100 },
    { id: "three_hundred_club", tier: "Gold", label: "300 Hour Club", emoji: "⌛",
      goal: "Rack up 300 total study hours.", howTo: "Keep logging sessions across months of prep.",
      current: totalHours, target: 300, cond: totalHours >= 300 },

    // ---- Platinum: months of grind ----
    { id: "quarter_champion", tier: "Platinum", label: "Quarter Champion", emoji: "🏆",
      goal: "Reach a 90-day (3-month) study streak.", howTo: "Study daily, without a single missed day, for 3 months straight.",
      current: longestStreak, target: 90, cond: longestStreak >= 90 },
    { id: "question_overlord", tier: "Platinum", label: "Question Overlord", emoji: "🔱",
      goal: "Solve 2,500 questions in total.", howTo: "Long-term Question Practice grind.",
      current: totalQuestions, target: 2500, cond: totalQuestions >= 2500 },
    { id: "mastermind", tier: "Platinum", label: "Mastermind", emoji: "🧠",
      goal: "Get 30 chapters to Mastered status.", howTo: "In Syllabus, take 30 chapters all the way to \"Mastered\" (not just Completed).",
      current: masteredCount, target: 30, cond: masteredCount >= 30 },
    { id: "five_hundred_vault", tier: "Platinum", label: "500 Hour Vault", emoji: "🗝️",
      goal: "Rack up 500 total study hours.", howTo: "Keep logging sessions — this is roughly 3 hrs/day for 6 months.",
      current: totalHours, target: 500, cond: totalHours >= 500 },

    // ---- Legendary: the ones that actually take 6 months of daily use ----
    { id: "six_month_sage", tier: "Legendary", label: "Six-Month Sage", emoji: "🐉",
      goal: "Study every single day for 6 months straight.", howTo: "Log at least one session on 180 consecutive days — miss one day and the streak restarts.",
      current: longestStreak, target: 180, cond: longestStreak >= 180 },
    { id: "half_year_hustle", tier: "Legendary", label: "Half-Year Hustle", emoji: "🌾",
      goal: "Log study sessions on 180 different days.", howTo: "These don't need to be back-to-back — rack up 180 total distinct study days over your prep.",
      current: totalStudyDays, target: 180, cond: totalStudyDays >= 180 },
    { id: "year_of_grit", tier: "Legendary", label: "Year of Grit", emoji: "💎",
      goal: "Reach an unbroken 365-day study streak.", howTo: "A full year of daily study, zero gaps. The hardest badge in StudyBun.",
      current: longestStreak, target: 365, cond: longestStreak >= 365 },

    // ---- Special: earned by a specific moment, not a running total ----
    { id: "comeback_kid", tier: "Special", label: "Comeback Kid", emoji: "🌱",
      goal: "Fall off for 14+ days, then come back and rebuild a streak.", howTo: "Life happens — this unlocks the first time you resume studying after a 2+ week gap.",
      current: hadComeback ? 1 : 0, target: 1, cond: hadComeback },
    { id: "perfectionist", tier: "Special", label: "Perfectionist", emoji: "💮",
      goal: "Hold a 30-day streak with zero overdue revisions.", howTo: "Reach a 30-day streak while keeping your Revision Planner completely caught up.",
      current: (longestStreak >= 30 && overdueRevisions.length === 0) ? 1 : 0, target: 1,
      cond: longestStreak >= 30 && overdueRevisions.length === 0 },
  ];
  const unlockedAchievements = achievementDefs.filter((a) => a.cond);

  // achievements table is the permanent record of what's ever been earned
  // (see the insert effect just below) — used here to make "unlocked" status
  // sticky even after the live condition stops being true again. Two of the
  // conditions above are NOT monotonic: finishedGoalToday resets every
  // midnight, and perfectionist's overdueRevisions.length === 0 can flip back
  // true the moment a new revision goes overdue. Without this, a badge the
  // user genuinely earned would flip back to "Locked" the next time its live
  // condition lapses — contradicting the app's own promise (see Achievements
  // page copy: "once you've earned one it's yours for good") — the visible
  // count/progress bar could shrink, and re-triggering the condition later
  // would fire the "Achievement unlocked!" celebration a second time for
  // something already earned. persistedUnlockedIds only ever grows (nothing
  // ever deletes from the achievements table), so unioning it in makes
  // unlockedAchievements monotonic like every other badge already is.
  const persistedUnlockedIds = new Set(achievementsQ.rows.map((r) => r.achievement_key));
  const stickyUnlockedAchievements = achievementDefs.filter((a) => a.cond || persistedUnlockedIds.has(a.id));

  // All the queries that feed achievementDefs' conditions (streaks, totals,
  // overdue counts, etc.) start empty and load in async on every reload.
  // Reading unlockedAchievements before they've all settled makes it look
  // like achievements just got unlocked, when really the data just caught
  // up — that's what was causing the celebration to fire on every reload.
  const dataReady = !sessionsQ.loading && !timerSessionsQ.loading && !questionsQ.loading &&
    !mocksQ.loading && !revisionsQ.loading && !tasksQ.loading && !backlogItemsQ.loading && !achievementsQ.loading &&
    !streakFreezesQ.loading;

  // Persist newly unlocked achievements once data has actually settled —
  // inserting against a still-loading (empty) achievementsQ.rows would just
  // try to re-insert everything the user already has, every reload. Deliberately
  // still keyed off the live-cond list (unlockedAchievements, not the sticky
  // one) — a persisted id is already in achievementsQ.rows by definition, so
  // looping the sticky list here would just be redundant work every render.
  useEffect(() => {
    if (!dataReady) return;
    unlockedAchievements.forEach((a) => {
      if (!achievementsQ.rows.some((r) => r.achievement_key === a.id)) {
        achievementsQ.insert({ achievement_key: a.id });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady, unlockedAchievements.length]);

  // null (not 0) means "no real baseline yet" — the first time dataReady
  // flips true, whatever count we see becomes the baseline silently; it's
  // never treated as a new unlock, even on a fresh page load where the
  // count is already >0 from past sessions. Tracks the STICKY count (not the
  // raw live-cond one) so a non-monotonic condition lapsing and re-triggering
  // later can never re-fire this celebration for something already earned.
  const prevUnlockedCount = useRef(null);
  useEffect(() => {
    if (!dataReady) return;
    if (prevUnlockedCount.current === null) {
      prevUnlockedCount.current = stickyUnlockedAchievements.length;
      return;
    }
    if (stickyUnlockedAchievements.length > prevUnlockedCount.current) {
      fireCelebrate("petals");
      showToast("Achievement unlocked! 🏆");
    }
    prevUnlockedCount.current = stickyUnlockedAchievements.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady, stickyUnlockedAchievements.length]);

  // Streak-freeze tokens (supabase/migration_streak_freeze.sql). Two jobs:
  //
  // 1. Earn: every time lifetime study days changes, ask the server to
  //    check whether a new 7-day chunk has been crossed and hand out a
  //    token if so (capped at 2 held). Cheap and idempotent — no-ops most
  //    of the time.
  useEffect(() => {
    if (!dataReady || !user) return;
    supabase.rpc("sb_recompute_streak_freeze_grants").then(({ error }) => {
      if (!error) refetchProfile();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady, user?.id, totalStudyDays]);

  // 2. Spend: the streak only actually breaks once *two* consecutive days
  //    (today + yesterday) have nothing logged — see streakDays/streak
  //    above. So the moment to step in is when yesterday is the lone gap:
  //    the day before it still qualifies, meaning a real streak is at risk
  //    of dying tomorrow. Auto-spend a token now to cover yesterday, before
  //    that happens, rather than asking the person to notice and act.
  //    appliedFreezeDates just prevents firing the RPC repeatedly for the
  //    same date within one session; the unique constraint in the DB is
  //    what actually stops a date from ever being frozen (and charged)
  //    twice, even across reloads or tabs.
  const appliedFreezeDates = useRef(new Set());
  useEffect(() => {
    if (!dataReady || !user || !profile) return;
    const tokens = profile.streak_freeze_tokens || 0;
    if (tokens <= 0) return;
    const y = toISTDateStr(Date.now() - 86400000);
    const dayBefore = toISTDateStr(Date.now() - 2 * 86400000);
    if (streakDays.has(y) || !streakDays.has(dayBefore)) return;
    if (appliedFreezeDates.current.has(y)) return;
    appliedFreezeDates.current.add(y);
    supabase.rpc("sb_apply_streak_freeze", { p_frozen_date: y }).then(({ data, error }) => {
      if (error || !data) { appliedFreezeDates.current.delete(y); return; }
      refetchProfile();
      showToast("❄️ Streak freeze used — yesterday's gap is covered, your streak lives on.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady, user?.id, profile?.streak_freeze_tokens, streakDays]);

  // Recurring planner tasks (`tasks.recurring` — an existing-but-unused
  // schema column, see supabase/schema.sql). A "template" task with
  // `recurring` set to "Daily" or "Weekly:<Sun..Sat>" spawns one ordinary
  // child row for "today" when due; the template row itself never moves,
  // so completion history and streak logic for spawned instances behave
  // exactly like any other task. `description` doubles as a lightweight
  // parent-link marker ("__recurring_from:<template_id>") since it's
  // otherwise unused in the UI — this avoids a migration for the 105
  // users already in production. Existing rows all have `recurring: null`,
  // so this is a no-op until a user creates a new recurring task.
  //
  // Runs once per IST calendar day per session (guarded by
  // materializedForDate) rather than on every render/reload; there's no
  // backfill for missed days, matching how most habit trackers behave.
  //
  // Deleting a single day's spawned child (see deleteTask below) removes
  // that row from the DB, but on its own that's indistinguishable from
  // "never materialized yet" — a same-day reload would see no row for
  // today and recreate it right back. To keep a deleted occurrence
  // deleted, the template's own (otherwise-unused) `description` also
  // doubles as a skip list: "__recurring_skip:2026-01-05,2026-01-07".
  // deleteTask writes to it; this effect reads it before spawning.
  // (Deleting the template's OWN due-day row — before any child has ever
  // spawned — is handled separately in deleteTask by advancing its
  // due_date instead; that path never touches this skip list.)
  const materializedForDate = useRef(null);
  useEffect(() => {
    if (!dataReady || !user) return;
    const today = todayStr();
    if (materializedForDate.current === today) return;

    const templates = tasks.filter((t) => t.recurring && !(t.description || "").startsWith("__recurring_from:"));
    // Bail BEFORE burning today's one-shot guard when there's nothing to
    // spawn from. The tasks table only loads on Dashboard/Recap/Backlog/
    // Planner/Profile, so opening the app on any other page reports
    // dataReady with an empty tasks list; setting the guard on that empty
    // pass meant today's repeating tasks never spawned until a full reload.
    if (!templates.length) return;
    materializedForDate.current = today;

    templates.forEach((t) => {
      if (today <= t.due_date) return; // template's own day already represents that occurrence
      const isDue = t.recurring === "Daily" || t.recurring === `Weekly:${weekdayShortIST(today)}`;
      if (!isDue) return;
      if (parseRecurringSkipDates(t.description).includes(today)) return; // user deleted today's occurrence
      const alreadyExists = t.due_date === today ||
        tasks.some((x) => x.due_date === today && x.description === `__recurring_from:${t.id}`);
      if (alreadyExists) return;
      tasksQ.insert({
        title: t.title, subject: t.subject, priority: t.priority, category: t.category,
        due_date: today, status: "Pending", recurring: null,
        description: `__recurring_from:${t.id}`,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady, user?.id, tasks]);

  /* ---------- actions ---------- */
  const addSession = async (payload, clientToken = crypto.randomUUID()) => {
    const row = await sessionsQ.insert({ session_date: todayStr(), ...payload }, { idempotencyKey: clientToken });
    if (!row) {
      showToast("Couldn't log that session — check your connection.", () => addSession(payload, clientToken), "Retry");
      return;
    }
    let chapterBumped = false;
    if (payload.subject && payload.chapter) {
      const cur = getChStatus(`${payload.subject}::${payload.chapter}`);
      if (cur.status === "Not Started") {
        await chapters.upsert(payload.subject, payload.chapter, { status: "Studying" });
        chapterBumped = true;
      }
    }
    showToast("Session logged — nice work! ✨", () => {
      sessionsQ.remove(row.id);
      if (chapterBumped) chapters.upsert(payload.subject, payload.chapter, { status: "Not Started" });
    });
  };

  const setChapterField = (subject, chapter, patch) => chapters.upsert(subject, chapter, patch);

  const completeChapter = async (c) => {
    const prior = getChStatus(c.key);
    const priorSnapshot = { status: prior.status, last_revised: prior.last_revised, next_revision: prior.next_revision };
    const updated = await chapters.upsert(c.subject, c.name, { status: "Completed", last_revised: null, next_revision: null });
    if (!updated) {
      showToast("Couldn't mark that complete — check your connection.", () => completeChapter(c), "Retry");
      return;
    }
    const due = daysFromNowIST(3);
    const newRevision = await revisionsQ.insert({ subject: c.subject, chapter: c.name, due_date: due, revision_number: 1, status: "Pending" });
    fireCelebrate();
    showToast(`${c.name} completed! First revision scheduled 🌸`, () => {
      chapters.upsert(c.subject, c.name, priorSnapshot);
      if (newRevision) revisionsQ.remove(newRevision.id);
    });
  };

  const addQuestions = async (payload, clientToken = crypto.randomUUID()) => {
    const row = await questionsQ.insert({ log_date: todayStr(), ...payload }, { idempotencyKey: clientToken });
    if (!row) {
      showToast("Couldn't log those questions — check your connection.", () => addQuestions(payload, clientToken), "Retry");
      return;
    }
    showToast(`+${payload.count} questions logged 🥕`, () => questionsQ.remove(row.id));
  };
  const addMock = async (m, clientToken = crypto.randomUUID()) => {
    const row = await mocksQ.insert({ mock_date: todayStr(), ...m }, { idempotencyKey: clientToken });
    if (!row) {
      showToast("Couldn't save that mock — check your connection.", () => addMock(m, clientToken), "Retry");
      return;
    }
    fireCelebrate();
    showToast("Mock added — great effort showing up for it.", () => mocksQ.remove(row.id));
  };
  const updateMock = async (id, patch) => {
    const prior = mocks.find((m) => m.id === id);
    if (!prior) return;
    await mocksQ.update(id, patch);
    const { id: _oldId, user_id: _userId, created_at: _createdAt, ...rest } = prior;
    showToast("Mock updated ✏️", () => mocksQ.update(id, rest));
  };
  const deleteMock = async (id) => {
    const row = mocks.find((m) => m.id === id);
    if (!row) return;
    await mocksQ.remove(id);
    const { id: _oldId, user_id: _userId, created_at: _createdAt, ...rest } = row;
    showToast("Mock deleted", () => mocksQ.insert(rest));
  };

  // Mistake-tagging on mock review — this is what turns "how many did I get
  // wrong" into "why did I get them wrong", which is what actually drives
  // Backlog/AI Insights priority instead of just session counts.
  const saveMockAnalysis = async (mockId, patch) => {
    const row = await mockAnalysis.upsert(mockId, patch);
    if (row) showToast("Mistake breakdown saved 🔍");
    return row;
  };

  // Persists the Smart AI Comparison's last result to Supabase (not just
  // localStorage) so it survives switching devices/browsers on the same
  // account. Only called on a successful generation — a failed re-run
  // leaves whatever's already saved untouched.
  const saveMockAiComparison = async (result) => mockAiCompareRow.save({ result });

  // Persists the StudyBun AI (AI Insights page) last result to Supabase —
  // same reasoning as saveMockAiComparison above. Only called on a
  // successful generation; a failed re-run leaves the last good result.
  const saveAiInsights = async (result, generatedAt) => aiInsightsRow.save({ result, generated_at: generatedAt });

  const completeRevision = async (id) => {
    const priorStatus = revisions.find((r) => r.id === id)?.status || "Pending";
    await revisionsQ.update(id, { status: "Completed", completed_at: new Date().toISOString() });
    fireCelebrate("petals");
    showToast("Revision complete — that chapter just got stickier 🌷", () => revisionsQ.update(id, { status: priorStatus, completed_at: null }));
  };
  const addRevision = async (payload) => {
    const row = await revisionsQ.insert({ status: "Pending", revision_number: 1, ...payload });
    showToast("Revision planned 🗓️", row && (() => revisionsQ.remove(row.id)));
  };
  const deleteRevision = async (id) => {
    const row = revisions.find((r) => r.id === id);
    if (!row) return;
    await revisionsQ.remove(id);
    const { id: _oldId, user_id: _userId, created_at: _createdAt, ...rest } = row;
    showToast("Revision entry deleted", () => revisionsQ.insert(rest));
  };
  const addTask = async (t) => {
    const row = await tasksQ.insert({ due_date: todayStr(), status: "Pending", ...t });
    showToast("Task added 📝", row && (() => tasksQ.remove(row.id)));
  };
  const toggleTask = async (t) => {
    const nextStatus = t.status === "Pending" ? "Completed" : "Pending";

    // Finishing the last pending task of the day can, on its own, complete
    // today's streak day (see taskDayCompletion in the derived-stats block
    // above) even with zero minutes logged. That's worth a bigger reaction
    // than a routine checkbox — but only the first time it happens today,
    // so ticking off tasks after the streak is already locked in doesn't
    // spam confetti on every click.
    const todaysTasks = tasks.filter((x) => x.due_date === todayStr());
    const completesTodaysPlan = nextStatus === "Completed" && todaysTasks.length > 0 &&
      todaysTasks.every((x) => x.id === t.id || x.status === "Completed");

    await tasksQ.update(t.id, { status: nextStatus });

    if (completesTodaysPlan && !streakActiveToday) {
      fireCelebrate();
      showToast("Whole day's plan cleared — streak day locked in! 🔥", () => tasksQ.update(t.id, { status: t.status }));
    } else {
      showToast(nextStatus === "Completed" ? "Task done ✅" : "Task reopened", () => tasksQ.update(t.id, { status: t.status }));
    }
  };
  const updateTask = async (id, patch) => {
    const row = tasks.find((t) => t.id === id);
    if (!row) return;
    const updated = await tasksQ.update(id, patch);
    if (!updated) {
      // Don't claim success. Besides a dropped connection, moving a spawned
      // copy onto a day that already has a copy of the same repeating task is
      // rejected by the unique index in migration_recurring_unique.sql.
      const clash = recurringParentId(row) && patch.due_date && patch.due_date !== row.due_date;
      showToast(
        clash ? "Couldn't move that task — that day may already have a copy of it, or your connection dropped."
              : "Couldn't save that change — check your connection.",
        clash ? undefined : () => updateTask(id, patch),
        clash ? undefined : "Retry"
      );
      return;
    }
    showToast("Task updated ✏️", () => tasksQ.update(id, { title: row.title, subject: row.subject, priority: row.priority, category: row.category, due_date: row.due_date, recurring: row.recurring }));
  };
  // Delete logic for plain AND repeating tasks lives in lib/recurring.js
  // (pure + unit-tested in __tests__/recurring.test.js). deleteTask(id, scope):
  // scope "occurrence" (default) skips just that day of a repeating task,
  // "series" ends the whole pattern; plain tasks just get deleted.
  const { deleteTask, deleteRecurringSeries } = createRecurringDeleters({ tasks, tasksQ, showToast, today: todayStr });

  const addBacklogItem = async (item) => {
    const row = await backlogItemsQ.insert({ status: "Not Started", in_session: false, ...item });
    showToast("Added to backlog 📚", row && (() => backlogItemsQ.remove(row.id)));
  };
  const updateBacklogItem = async (id, patch) => {
    await backlogItemsQ.update(id, { ...patch, updated_at: new Date().toISOString() });
    showToast("Backlog item updated");
  };
  const setBacklogStatus = async (item, status) => {
    const patch = { status, updated_at: new Date().toISOString() };
    if (status === "Completed") { patch.completed_at = new Date().toISOString(); patch.in_session = false; }
    if (item.status === "Completed" && status !== "Completed") patch.completed_at = null;
    await backlogItemsQ.update(item.id, patch);
    if (status === "Completed") fireCelebrate();
    showToast(
      status === "Completed" ? `${item.title} cleared! 🌸` : `Marked ${status.toLowerCase()}`,
      () => backlogItemsQ.update(item.id, { status: item.status, completed_at: item.completed_at || null })
    );
  };
  const toggleSessionItem = async (item) => {
    await backlogItemsQ.update(item.id, { in_session: !item.in_session });
  };
  const deleteBacklogItem = async (id) => {
    const row = backlogItems.find((b) => b.id === id);
    if (!row) return;
    await backlogItemsQ.remove(id);
    const { id: _oldId, user_id: _userId, created_at: _createdAt, ...rest } = row;
    showToast("Backlog item deleted", () => backlogItemsQ.insert(rest));
  };

  // ---------- NEET Recovery Engine ----------
  // Generated recovery cards live in backlog_items too (source_type !=
  // "manual"), keyed by the deterministic source_key from
  // src/lib/recoveryEngine.js. They only get a real row once the user acts
  // on one — until then a card is "Open" purely in memory. Acting on it
  // upserts by source_key, so re-tagging a mock never creates a duplicate.
  const upsertRecoveryItem = async (signal, patch = {}) => {
    const existing = backlogItems.find((b) => b.source_key === signal.sourceKey);
    const base = {
      title: signal.title,
      subject: signal.subject,
      category: "Recovery",
      source_type: signal.sourceType,
      source_key: signal.sourceKey,
      chapter: signal.chapter,
      problem_type: signal.problemType,
      priority_score: signal.priorityScore,
      evidence_count: signal.evidenceCount,
      last_evidence_at: signal.lastEvidenceAt,
      recommended_action: signal.recommendedAction,
      notes: signal.why,
    };
    if (existing) return backlogItemsQ.update(existing.id, { ...base, ...patch, updated_at: new Date().toISOString() });
    return backlogItemsQ.insert({ status: "Not Started", in_session: false, ...base, ...patch });
  };

  const RECOVERY_TARGET_PAGE = {
    concept_gap: "revision", revision_overdue: "revision",
    silly_mistake: "questions", calculation_error: "questions", guesswork: "questions",
    time_management: "timer", pacing: "mocks",
  };
  const RECOVERY_TARGET_LABEL = { revision: "Revision Planner", questions: "Question Practice", timer: "Focus Timer", mocks: "Mock Tests" };

  const startRecoveryItem = async (signal) => {
    await upsertRecoveryItem(signal, { status: "In Progress" });
    const target = RECOVERY_TARGET_PAGE[signal.problemType] || "backlog";
    if (target !== "backlog") {
      showToast(`Off to ${RECOVERY_TARGET_LABEL[target]} — ${signal.chapter || signal.subject}`);
      setPage(target);
    }
  };
  const addRecoveryToToday = async (signal) => {
    await upsertRecoveryItem(signal, { in_session: true });
    showToast("Added to today's recovery plan 🎯");
  };
  const dismissRecoveryItem = async (signal) => {
    await upsertRecoveryItem(signal, { status: "Paused", dismissed_until: daysFromNowIST(14), in_session: false });
    showToast("Dismissed for now — it'll resurface if the evidence grows.");
  };
  const completeRecoveryItem = async (signal) => {
    await upsertRecoveryItem(signal, { status: "Completed", completed_at: new Date().toISOString(), in_session: false });
    fireCelebrate();
    showToast(`${signal.chapter || signal.subject} recovered! 🌸`);
  };
  const reopenRecoveryRow = async (id, signal) => {
    await backlogItemsQ.update(id, {
      status: "Not Started", dismissed_until: null,
      priority_score: signal.priorityScore, evidence_count: signal.evidenceCount, last_evidence_at: signal.lastEvidenceAt,
      updated_at: new Date().toISOString(),
    });
  };

  const addGoal = async (item) => {
    const row = await goalsQ.insert({ status: "Active", starred: false, ...item });
    showToast("New page written 📝", row && (() => goalsQ.remove(row.id)));
  };
  const updateGoal = async (id, patch) => {
    await goalsQ.update(id, { ...patch, updated_at: new Date().toISOString() });
  };
  const completeGoal = async (goal) => {
    const wasCompleted = goal.status === "Completed";
    const patch = wasCompleted
      ? { status: "Active", completed_at: null }
      : { status: "Completed", completed_at: new Date().toISOString() };
    await goalsQ.update(goal.id, { ...patch, updated_at: new Date().toISOString() });
    if (!wasCompleted) fireCelebrate();
    showToast(
      wasCompleted ? "Goal reopened" : `${goal.title} — done! ✂️`,
      () => goalsQ.update(goal.id, { status: goal.status, completed_at: goal.completed_at || null })
    );
  };
  const deleteGoal = async (id) => {
    const row = goals.find((g) => g.id === id);
    if (!row) return;
    await goalsQ.remove(id);
    const { id: _oldId, user_id: _userId, created_at: _createdAt, ...rest } = row;
    showToast("Page torn out", () => goalsQ.insert(rest));
  };

  /* ---------- lifetime data backup (Settings → Import/Export) ---------- */
  const exportBackup = () => {
    const payload = buildExportPayload(
      {
        study_sessions: sessions,
        timer_sessions: timerSessions,
        chapter_progress: chapters.rows,
        question_logs: questions,
        mock_tests: mocks,
        revision_plans: revisions,
        tasks,
        backlog_items: backlogItems,
        goals,
        achievements: achievementsQ.rows,
      },
      profile
    );
    downloadJSON(payload, `studybun-neet-backup-${todayStr()}.json`);
    showToast("Backup downloaded 💾");
  };

  const importBackup = async (file, { applyProfile = true } = {}) => {
    if (!user) { showToast("Sign in first, then import your backup"); return { ok: false }; }
    try {
      const payload = await readFileAsJSON(file);
      const summary = await importPayload(supabase, user.id, payload, { applyProfile, saveProfile });
      // Bulk writes above go straight through the Supabase client, bypassing
      // each hook's own insert() (and thus its optimistic local update) — so
      // pull fresh rows for every table that might have changed.
      sessionsQ.refetch(); timerSessionsQ.refetch(); questionsQ.refetch(); mocksQ.refetch();
      revisionsQ.refetch(); tasksQ.refetch(); backlogItemsQ.refetch(); goalsQ.refetch(); achievementsQ.refetch();
      chapters.refetch(); refetchProfile();
      const total = totalImported(summary);
      if (summary.errors.length) {
        showToast(`Imported ${total} records, ${summary.errors.length} table(s) had issues`);
        console.error("[StudyBun] import errors:", summary.errors);
      } else {
        showToast(`Imported ${total} records 🎉`);
      }
      return { ok: true, summary };
    } catch (e) {
      showToast(e.message || "Import failed");
      return { ok: false, error: e.message };
    }
  };

  if (profileLoading || !profile) {
    return (
      <div style={cssVars} data-dark={darkMode ? "true" : "false"}>
        <GlobalStyle />
        <DecorLayer theme={theme} />
        <LoadingScreen message="Preparing your study desk..." />
      </div>
    );
  }

  if (!profile.name) {
    return (
      <div style={cssVars} data-dark={darkMode ? "true" : "false"}>
        <GlobalStyle />
        <DecorLayer theme={theme} />
        <Suspense fallback={<LoadingScreen message="Preparing your study desk..." />}>
          <Onboarding profile={profile} onSave={async (form) => { await saveProfile(form); }} />
        </Suspense>
      </div>
    );
  }

  const pageProps = {
    profile, saveProfile, mascot, darkMode, setDarkMode, toggleDarkMode,
    userId: user?.id, studyingIds,
    sessions, timerSessions, addSession, deleteSession: sessionsQ.remove, activeSubjects, allChapters: activeChapters, getChStatus, setChapterField, completeChapter,
    questions, addQuestions, deleteQuestion: questionsQ.remove, mocks, addMock, updateMock, deleteMock,
    mockAnalysisMap: mockAnalysis.map, saveMockAnalysis,
    mockAiComparison: mockAiCompareRow.row, saveMockAiComparison,
    aiInsights: aiInsightsRow.row, saveAiInsights,
    revisions, completeRevision, addRevision, deleteRevision,
    tasks, addTask, toggleTask, updateTask, deleteTask, deleteRecurringSeries, backlogChapters, todayHours, todayMinutes,
    todayLoggedHours, todayTimerHours, totalLoggedHours, totalTimerHours,
    backlogItems, addBacklogItem, updateBacklogItem, setBacklogStatus, toggleSessionItem, deleteBacklogItem,
    upsertRecoveryItem, startRecoveryItem, addRecoveryToToday, dismissRecoveryItem, completeRecoveryItem, reopenRecoveryRow,
    goals, addGoal, updateGoal, completeGoal, deleteGoal,
    streak, streakActiveToday, weeklyData, subjectPie, totalQuestions, todayQuestions,
    dailyQuestionTarget, questionTargetPct, questionTargetMet, daysToExam,
    dueRevisions, upcomingRevisions, overdueRevisions, overallPct, completedCount,
    unlockedAchievements: stickyUnlockedAchievements, achievementDefs, achievementRows: achievementsQ.rows, setPage, showToast, fireCelebrate,
    longestStreak, totalStudyDays, totalHours, masteredCount,
    featureUnlockStreak: FEATURE_UNLOCK_STREAK,
    mascotMood: buddyMood, mascotEnergy: buddyEnergy,
    focusTimer, groupRoom, music: focusMusic,
    focusModeScene: focusModeRow.row?.scene, saveFocusModeScene: (scene) => focusModeRow.save({ scene }),
    exportBackup, importBackup,
  };


  return (
    // WARNING: `cssVars` below is the ONLY place theme colors (--card,
    // --mascot-outline, --mascot-ink, --bg, --muted, --soft, --accent2,
    // etc.) get defined -- they live as inline custom properties on THIS
    // element, not on <body> or :root. Any component that portals UI out
    // of .sb-main (e.g. createPortal for a themed dialog -- see
    // MessageInfoModal.jsx) must target this .sb-app node, not
    // document.body: portaling to body escapes this variable scope and
    // the portaled content renders with no theme colors at all
    // (transparent surfaces, invisible borders).
    <div className="sb-app" style={cssVars} data-dark={darkMode ? "true" : "false"} data-stitched={theme.stitched ? "true" : "false"} data-blocky={theme.blocky ? "true" : "false"} data-y2k={theme.y2k ? "true" : "false"} data-paper={theme.paper ? "true" : "false"} data-photo-bg={theme.photoBg ? "true" : "false"}>
      <GlobalStyle />
      <ThemePhotoLayer theme={theme} />
      <CustomBackgroundLayer />
      {darkMode && <div className="sb-dark-glow-mesh" aria-hidden="true" />}
      <DecorLayer theme={theme} />
      <PWAPrompt />
      {celebrateType && <Confetti type={celebrateType} theme={theme} />}
      {/* The one YouTube player behind Focus Music. Lives here, not inside the
          Focus Timer page, so switching pages or closing the timer's settings
          dialog never unmounts (and thus never silences) it. */}
      <FocusMusicStage music={focusMusic} />
      {toast && (
        <div className="sb-toast">
          <Mascot species={mascot} mood="celebrate" size={28} hop={hopping} />
          <span className="sb-quote">{toast.message}</span>
          {toast.undo && <button className="sb-toast-undo" onClick={runUndo}>{toast.undoLabel}</button>}
        </div>
      )}
      {!isSupabaseConfigured && (
        <div className="sb-env-banner">
          Supabase isn't configured yet — copy <code>.env.example</code> to <code>.env</code> and add your project URL + anon key. Data won't save until then.
        </div>
      )}

      <aside
        className={`sb-sidebar ${sidebarCollapsed ? "sb-sidebar-collapsed" : ""} ${sidebarAnimating ? "sb-sidebar-animating" : ""}`}
        aria-label="StudyBun navigation"
      >
        <div className="sb-sidebar-brand">
          <div className="sb-sidebar-brand-mark">
            <Mascot species={mascot} mood="happy" size={38} hop={hopping} peek />
          </div>
          <div className="sb-sidebar-brand-copy">
            <span className="sb-brand-title">StudyBun NEET</span>
            <span className="sb-sidebar-brand-sub">NEET study companion</span>
          </div>
        </div>

        <TopNav
          nav={NAV}
          page={page}
          setPage={setPage}
          reducedMotion={reducedMotion}
          onHoverItem={prefetchPage}
          collapsed={sidebarCollapsed}
        />

        <div className="sb-sidebar-footer">
          <button
            type="button"
            className="sb-sidebar-toggle-btn"
            onClick={toggleSidebarCollapsed}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronsRight size={18} strokeWidth={2.4} /> : <ChevronsLeft size={18} strokeWidth={2.4} />}
          </button>
        </div>
      </aside>

      {/* Phone: unchanged hamburger + dropdown, full NAV list including
          Settings/Profile since there's no separate icon row to hold them
          at this width. */}
      <button className="sb-mobile-toggle" onClick={() => setMobileNavOpen((v) => !v)}><Menu size={20} /></button>
      {mobileNavOpen && (
        <div className="sb-mobile-nav">
          <span ref={mobileNavPillRef} className="sb-nav-pill" aria-hidden="true" />
          {NAV.map((n) => (
            <button
              key={n.id}
              ref={(el) => { mobileNavItemRefs.current[n.id] = el; }}
              className={`sb-nav-item ${page === n.id ? "active" : ""}`}
              onClick={() => { startTransition(() => setPage(n.id)); setMobileNavOpen(false); }}
              onTouchStart={() => prefetchPage(n.id)}
            >
              <n.icon size={18} /><span>{n.label}</span>
            </button>
          ))}
        </div>
      )}

      <main className="sb-main" ref={mainRef}>
        <div className={`sb-page-transition sb-route-${page}`} key={page}>
          <Suspense fallback={<PageLoading mascot={mascot} />}>
            {page === "dashboard" && <Dashboard {...pageProps} />}
            {page === "recap" && <DailyOverview {...pageProps} />}
            {page === "study" && <StudyTracker {...pageProps} />}
            {page === "timer" && <FocusTimer {...pageProps} />}
            {page === "grouptimer" && <GroupTimerPage {...pageProps} />}
            {page === "syllabus" && <SyllabusPage {...pageProps} />}
            {page === "backlog" && <BacklogPage {...pageProps} />}
            {page === "goals" && <GoalsPage {...pageProps} />}
            {page === "questions" && <QuestionsPage {...pageProps} />}
            {page === "mocks" && <MocksPage {...pageProps} />}
            {page === "revision" && <RevisionPage {...pageProps} />}
            {page === "planner" && <PlannerPage {...pageProps} />}
            {page === "analytics" && <AnalyticsPage {...pageProps} />}
            {page === "studystuffs" && <StudyStuffsPage {...pageProps} />}
            {page === "ai" && <AIInsightsPage {...pageProps} />}
            {page === "achievements" && <AchievementsPage {...pageProps} />}
            {page === "leaderboard" && <LeaderboardPage {...pageProps} />}
            {page === "community" && <CommunityPage {...pageProps} />}
            {page === "profile" && <ProfilePage {...pageProps} />}
            {page === "settings" && <SettingsPage {...pageProps} />}
          </Suspense>
        </div>
      </main>

      <BuddyGuide {...pageProps} page={page} mood={buddyMood} energy={buddyEnergy} hopping={hopping} />
    </div>
  );
}
