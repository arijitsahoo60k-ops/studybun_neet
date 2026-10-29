/**
 * Full feature guide shown in Settings → "How it works". Unlike the short
 * sign-in-page FEATURES list (pages/auth/info/features.js), each entry here
 * gets a real explanation of the mechanics — what data it reads/writes,
 * how it syncs, and any rule that isn't obvious from just using it (streak
 * grace period, the IST day boundary, the AI unlock requirement, etc).
 */
export const FEATURE_GUIDE = [
  {
    emoji: "🏠",
    label: "Dashboard",
    blurb: "Your daily home base — today's numbers, streak, and countdown.",
    details: [
      "Today's goal ring and the streak card both reset at midnight IST specifically, not your device's local midnight — so the numbers stay correct even if your phone's timezone is set wrong.",
      "The exam countdown is a whole-calendar-day count in IST, not a raw time difference, so it won't flicker between two numbers depending on what time of day you check it.",
    ],
  },
  {
    emoji: "🔥",
    label: "Streak system",
    blurb: "Tracks consecutive study days, with a grace period so it doesn't punish you for not having studied yet today.",
    details: [
      "A day counts toward your streak once you log a study session of at least 5 minutes, a completed focus-timer session of at least 10 minutes, log at least one question set, or clear every task you planned for that day in the Daily Planner — the same rule the Leaderboard uses, so the numbers never disagree.",
      "The streak number only drops to 0 after a full 2-day gap — if you studied yesterday but haven't yet today, it still shows yesterday's count instead of zeroing out the instant a new day starts.",
      "The flame icon glows and flickers once you've logged something today; it stays dull while the number shown is still just carried over from yesterday, waiting on you.",
      "Clearing a full day's plan in the Daily Planner counts on its own, even with zero minutes logged elsewhere — but only if you had at least one task due that day and every single one of them ends up Completed, not just some of them.",
      "\"Longest streak\" (used for achievements) is a separate lifetime record — it doesn't reset when your current streak breaks, so a badge you earned stays earned.",
      "Streak freeze: you start with 1 token and earn another for every 7 genuine study days (capped at 2 held). If you miss a single day, the app silently spends a token to cover it so your streak keeps running — it only kicks in for a lone missed day, not a longer gap, and each calendar date can only ever be frozen once.",
    ],
  },
  {
    emoji: "📖",
    label: "Study Tracker",
    blurb: "Manually log a study session — subject, chapter, type, and minutes.",
    details: [
      "Completing a chapter's first session bumps that chapter from \"Not Started\" to \"Studying\" in your syllabus automatically.",
      "\"Today's summary\" breaks your logged time down by session type (Lecture / Practice / Revision) for the current IST day.",
    ],
  },
  {
    emoji: "⏱️",
    label: "Focus Timer",
    blurb: "A running timer for deep-work sessions that survives closing the tab.",
    details: [
      "The timer's end time is stored as an absolute timestamp, so if you close the app and reopen it, the countdown picks up exactly where it should be — it isn't just counting down in memory.",
      "When a timer finishes, it logs straight into timer_sessions with the actual minutes completed — this is what \"Today's summary\" and your streak treat as verified study time, separate from manually logged sessions, so the two never get double-counted.",
    ],
  },
  {
    emoji: "🗓️",
    label: "Study Calendar",
    blurb: "A month view with a colour-dot per day for study/questions/mocks/tasks.",
    details: [
      "Every dated record (sessions, questions, mocks, tasks, revisions) gets bucketed onto its IST calendar day — including focus-timer sessions logged late at night, which land on the correct day here too, matching Dashboard and the streak.",
      "Click any day to see everything logged on it in one place.",
    ],
  },
  {
    emoji: "📚",
    label: "Syllabus & Backlog",
    blurb: "Chapter-by-chapter status tracking, plus a place to park what's fallen behind.",
    details: [
      "Chapter status (Not Started / Studying / Completed / Mastered) drives your overall completion % on the Dashboard and Analytics.",
      "Backlog items can carry a deadline; anything past its deadline (compared in IST) is flagged overdue.",
    ],
  },
  {
    emoji: "✏️",
    label: "Question Practice",
    blurb: "Quick-add how many questions you solved, by subject and difficulty.",
    details: [
      "\"Today\", \"this week\", and lifetime totals are all IST-day based, same as everywhere else in the app.",
      "\"Avg / active day\" only counts days you actually logged something — days you didn't study aren't averaged in.",
    ],
  },
  {
    emoji: "📝",
    label: "Mock Tests",
    blurb: "Log a full mock's subject-wise marks and correct/incorrect counts for NEET UG (720 marks: Botany, Zoology, Physics, Chemistry) or Custom/Part Exams.",
    details: [
      "NEET UG auto-calculates marks from your correct/incorrect counts (+4/-1, 45 scored questions per section = 180 marks each for Botany, Zoology, Physics & Chemistry, 720 total) or accepts direct marks entry; Custom Exam supports any part test or custom total marks.",
      "The \"Main vs Advanced\" trend chart always plots the two exam types as separate lines — never mixed into one, since their totals aren't on the same scale. Toggle between % and raw marks, and see avg/best/trend-delta stat pills for each paper.",
      "Smart AI & Mathematical Comparison combines NTA NEET UG marks-vs-rank log interpolation, Ordinary Least Squares (OLS) regression slope, Z-score consistency, and +4/-1 Expected Value counterfactual rank simulations with AI insights.",
      "Mock scores feed both Analytics and the AI Insights snapshot, so your buddy's mock-related advice is grounded in the actual scores you've entered.",
      "Optional per-subject time-spent minutes power the Pacing Check, which flags the subject where your time share and score share mismatch the most.",
      "Tag mistakes on any reviewed mock (silly, concept gap, calculation, time pressure, guesswork) — this feeds Backlog's recovery priority, not just a static breakdown.",
    ],
  },
  {
    emoji: "🔁",
    label: "Revision Planner",
    blurb: "Chapters resurface for revision on a schedule instead of being forgotten.",
    details: [
      "Completing a chapter automatically schedules its first revision 3 days later (IST calendar days).",
      "Revisions sort into three shelves — overdue, due today, upcoming — all compared against the current IST date.",
      "The 7-day week strip shows a dot on any upcoming day that already has a revision due.",
    ],
  },
  {
    emoji: "📝",
    label: "Daily Planner",
    blurb: "A simple task list with due dates for the day-to-day to-dos around your studying.",
    details: [
      "New tasks default to today's (IST) date if you don't set one.",
    ],
  },
  {
    emoji: "📊",
    label: "Analytics",
    blurb: "Weekly study-hour trends and syllabus completion by subject, at a glance.",
    details: [
      "Pulls from the same underlying session and chapter data as the Dashboard — nothing here is calculated differently, just visualised differently.",
    ],
  },
  {
    emoji: "🧠",
    label: "AI Insights & Smart Study Buddy",
    blurb: "Gemini-powered analysis and chat, grounded only in your real study data.",
    details: [
      "Both features build their answers from the same compact data snapshot (today's hours, streak, subject backlog, mock scores, revision status) — so they can't drift into generic advice that ignores what you've actually logged.",
      "They only unlock once you've hit a 6-day study streak, so Gemini quota is spent on people actively using the app rather than being wide open from day one.",
      "Nothing is sent to Gemini in the background — a request only goes out when you open AI Insights or send a chat message.",
      "AI Insights' last result is saved to your account in Supabase (not just this browser), so it's still there when you come back to the page, refresh, or switch devices — it only changes when you click \"Generate\" again.",
    ],
  },
  {
    emoji: "🏆",
    label: "Achievements",
    blurb: "Badges for milestones — streaks, backlog clears, comebacks, and more.",
    details: [
      "Streak-based badges (3/7/30/90/180/365-day) check your all-time longest streak, not your current one — so missing a day later doesn't take a badge away.",
      "The \"comeback\" badge specifically looks for resuming study after a 14+ day gap.",
    ],
  },
  {
    emoji: "👑",
    label: "Leaderboard",
    blurb: "An opt-in public ranking by a rolling 30-day activity score.",
    details: [
      "Your score blends verified focus-timer minutes, self-reported minutes (weighted lower), questions, mocks, chapters completed, and streak — all within a rolling 30-day window.",
      "The streak shown here uses the exact same IST 2-day-grace rule as your personal streak, so the leaderboard never contradicts what you see on your own Dashboard.",
      "The Top 3 get a podium — gold/silver/bronze tiers with your mascot, streak, and score — and the rest of the Top 20 lists below it.",
      "Only your display name, mascot, score, streak, and active-day count are public — nothing else from your account is exposed.",
    ],
  },
  {
    emoji: "🎀",
    label: "Mascot & Theme",
    blurb: "Pick a study buddy species and a colour palette for the whole app.",
    details: [
      "Your mascot's mood reacts to today's progress (e.g. sleepy until you've logged something) and each species has its own personality, sounds, and achievement flavour text rather than everything being reskinned bunny content.",
    ],
  },
  {
    emoji: "💾",
    label: "Data & Backup",
    blurb: "Export everything to a JSON file, or import one back in.",
    details: [
      "Importing adds records from the file to your account — it never deletes or overwrites what's already there.",
      "You can choose whether an import also restores your profile (name, exam date, theme, mascot) or just the study data.",
    ],
  },
  {
    emoji: "🔄",
    label: "Cross-device sync",
    blurb: "Everything you log updates live, everywhere you're signed in.",
    details: [
      "All your data lives in Supabase under your account and syncs in real time — log a session on your phone and it shows up on your laptop's Dashboard without a refresh.",
      "This is also why signing in matters: without an account, your data would only ever live in one browser.",
    ],
  },
];
