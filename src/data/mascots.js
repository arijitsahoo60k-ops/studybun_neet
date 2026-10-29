export const MASCOTS = {
  bunny: { label: "Bunny", emoji: "🐰" },
  cat: { label: "Cat", emoji: "🐱" },
  fox: { label: "Fox", emoji: "🦊" },
  bear: { label: "Bear", emoji: "🐻" },
  hamster: { label: "Hamster", emoji: "🐹" },
  penguin: { label: "Penguin", emoji: "🐧" },
  // `exclusive: "founder"` -- these three never appear in a plain member's
  // picker. The flag is only half the story: hiding a button stops an
  // honest user, not someone editing the request, so the real lock is the
  // database trigger in supabase/migration_founder_mascots.sql (dragon,
  // axolotl) and supabase/migration_moderator_mascot_unlock.sql (lion),
  // which reject a profile update that sets one of these unless the row's
  // owner actually holds the right role.
  //
  // `unlockedFor` says which roles, beyond founder, also get it -- lion is
  // the one mascot moderators unlock too (their own thing, distinct from
  // the founder-exclusive dragon/axolotl). Omit it and a mascot is
  // founder-only, same as before. Keep this in lockstep with the two
  // migration files above if you ever add a fourth exclusive species.
  lion: { label: "Lion", emoji: "🦁", exclusive: "founder", unlockedFor: ["moderator"] },
  dragon: { label: "Dragon", emoji: "🐉", exclusive: "founder" },
  // No official axolotl emoji exists in Unicode yet, so this uses the
  // closest widely-supported stand-in rather than an inaccurate animal.
  axolotl: { label: "Axolotl", emoji: "🦎", exclusive: "founder" },
};

/** Is this species one of the founder-only ones? */
export function isExclusiveMascot(species) {
  return Boolean(MASCOTS[species]?.exclusive);
}

/** Tooltip text for the crown on an exclusive mascot's picker tile —
 * "Founders & Mods only" for lion, "Founders only" for dragon/axolotl. */
export function exclusiveMascotLabel(species) {
  const m = MASCOTS[species];
  if (!m?.exclusive) return null;
  return (m.unlockedFor || []).includes("moderator") ? "Founders & Mods only" : "Founders only";
}

/**
 * The list a picker should render. Plain members get the six standard
 * species; founders get all eight (dragon/axolotl are founder-only, lion
 * is shared with moderators); a moderator who isn't a founder gets the
 * six standard plus lion.
 *
 * `roles` is `{ isFounder, isModerator }`. The old call shape —
 * `pickableMascots(isFounder, current)`, a bare boolean as the first
 * arg — still works: every existing call site that hasn't been updated
 * to pass a roles object keeps behaving exactly as before (founder-only
 * gating, no lion-for-mods), it just doesn't get the new unlock.
 *
 * `current` is the species already saved on the profile, and it's always
 * included even when nobody's role unlocks it. That covers the awkward
 * in-between states -- role status still loading, or a role that got
 * revoked -- where dropping the saved species from the grid would make
 * the picker look like nothing is selected, and one stray tap would
 * silently overwrite it.
 */
export function pickableMascots(roles, current) {
  const { isFounder, isModerator } = typeof roles === "boolean" ? { isFounder: roles, isModerator: false } : (roles || {});
  return Object.entries(MASCOTS).filter(([id, m]) => {
    if (!m.exclusive || id === current) return true;
    if (isFounder) return true;
    if (isModerator && (m.unlockedFor || []).includes("moderator")) return true;
    return false;
  });
}

/**
 * Per-species personality: what each mascot *does* (verb, plus a capitalized
 * "-ing"-ready form for badge names) and what it collects, plus a little
 * signature sound used in greetings. This is what keeps achievements and
 * buddy chatter from feeling like they're only ever about a bunny hopping
 * for carrots — a bear hunts fish, a hamster scurries for seeds, a penguin
 * waddles for pebbles, and so on.
 */
export const MASCOT_THEME = {
  bunny: { verbing: "Hop", sound: "*boing*", collectible: { emoji: "🥕", name: "carrot", plural: "Carrots" } },
  cat: { verbing: "Pounce", sound: "*purr*", collectible: { emoji: "🧶", name: "yarn ball", plural: "Yarn Balls" } },
  fox: { verbing: "Dash", sound: "*yip*", collectible: { emoji: "🫐", name: "berry", plural: "Berries" } },
  bear: { verbing: "Hunt", sound: "*grr*", collectible: { emoji: "🐟", name: "fish", plural: "Fish" } },
  hamster: { verbing: "Scurry", sound: "*squeak*", collectible: { emoji: "🌻", name: "seed", plural: "Seeds" } },
  penguin: { verbing: "Waddle", sound: "*honk*", collectible: { emoji: "🪨", name: "pebble", plural: "Pebbles" } },
  lion: { verbing: "Prowl", sound: "*rawr*", collectible: { emoji: "👑", name: "crown jewel", plural: "Crown Jewels" } },
  dragon: { verbing: "Soar", sound: "*fwoosh*", collectible: { emoji: "💎", name: "gem", plural: "Gems" } },
  axolotl: { verbing: "Paddle", sound: "*blub*", collectible: { emoji: "🫧", name: "bubble", plural: "Bubbles" } },
};

export function mascotTheme(species) {
  return MASCOT_THEME[species] || MASCOT_THEME.bunny;
}

export const MOODS = {
  idle: "Idle",
  happy: "Happy",
  sad: "Sad / neglected — no study yet and the day's slipping away",
  sleepy: "Sleepy / no study today, but plenty of day left",
  thinking: "Thinking (AI insights)",
  celebrate: "Celebrating (goal / streak / mock improved)",
  concerned: "Concerned (backlog increased)",
  studying: "Studying (holding a book)",
  reminder: "Reminder pose (revision overdue)",
};

/**
 * Reaction -> mood mapping, per the master prompt's "mascot reactions" table,
 * extended so the mascot actually reads as a pet that reacts to how the
 * day is going, not just a binary "studied / didn't":
 *
 *  - Any real win (goal hit, revision finished, mock improved, streak intact)
 *    -> "celebrate", the most energetic state.
 *  - Some study logged today, goal not yet hit -> "happy", scaling with how
 *    close they are (see mascotEnergy below).
 *  - Nothing logged yet: "sleepy" early in the day (no judgment, plenty of
 *    time left) but "sad" once the day is more than half gone — a
 *    genuinely neglected pet, not just a tired one.
 *
 * `hour` is the current IST hour (0-23); pass istHour() from lib/dateIST.
 */
export function reactionMood({ finishedGoal, finishedRevision, mockImproved, streak, noStudyToday, backlogIncreased, revisionOverdue, aiGenerating, hour }) {
  if (aiGenerating) return "thinking";
  if (finishedGoal || finishedRevision || mockImproved || streak) return "celebrate";
  if (revisionOverdue) return "reminder";
  if (backlogIncreased) return "concerned";
  if (noStudyToday) {
    const h = hour ?? new Date().getHours();
    return h >= 15 ? "sad" : "sleepy";
  }
  return "happy";
}

/**
 * A 0-1 "how alive should this mascot look right now" value, driven by real
 * progress toward the daily goal. Mascot.jsx uses this to scale its ambient
 * idle animation (faster/bouncier as the day goes better, slow and drooping
 * when neglected) — the same numbers that pick the mood also pick how
 * energetic it plays that mood.
 */
export function mascotEnergy({ mood, todayHours = 0, dailyGoal = 6 }) {
  if (mood === "celebrate") return 1;
  if (mood === "sad") return 0.12;
  if (mood === "sleepy") return 0.3;
  if (mood === "concerned" || mood === "reminder") return 0.4;
  const pct = dailyGoal > 0 ? Math.max(0, Math.min(1, todayHours / dailyGoal)) : 0;
  return 0.45 + pct * 0.45; // 0.45 (just started) up to 0.9 (goal in sight)
}

/**
 * Deterministic pick from a list, seeded by a string built from the actual
 * stats in play. Same numbers -> same pick (no flicker on unrelated
 * re-renders); different numbers -> a different line from the pool. This is
 * how the "vast pool" of quick tips stays grounded instead of turning into
 * literal Math.random() filler.
 */
function seededPick(list, seed) {
  if (list.length === 1) return list[0];
  let h = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

/**
 * What the mascot-as-guide says on each page, grounded in the user's real
 * numbers (never generic filler). Returns { text, action? } where action,
 * if present, is a { label, page } shortcut the bubble can offer.
 *
 * Every case below picks from several grounded phrasings for the same
 * situation (via seededPick) rather than a single fixed sentence, so the
 * buddy doesn't repeat itself verbatim every time someone lands on a page.
 */
export function buddyLine(page, ctx) {
  const {
    name, species, streak = 0, longestStreak = 0, todayHours = 0, dailyGoal = 6,
    overdueRevisions = 0, dueRevisions = 0, upcomingRevisions = 0, backlogChapters = 0,
    totalQuestions = 0, todayQuestions = 0, mocks = [], mocksCount = 0,
    unlockedCount = 0, achievementDefsCount = 0, overallPct = 0, masteredCount = 0,
    weeklyData = [],
  } = ctx;

  const who = name ? `, ${name}` : "";
  const theme = mascotTheme(species);
  const streakDaysLeft = weeklyData.filter((d) => Number(d.hours) > 0).length;
  const remaining = Math.max(0, dailyGoal - todayHours);

  function withStreakAddendum(base) {
    if (streak <= 0) return base;
    const isPB = streak >= 2 && streak >= longestStreak;
    if (isPB) {
      return `${base} ${seededPick([
        `And that's a personal best streak — ${streak} days. 🏆`,
        `Streak's at ${streak} — your longest yet, keep it alive.`,
        `${streak}-day streak, a new record for you. Don't jinx it!`,
      ], streak + 7)}`;
    }
    if (streak >= 7) {
      return `${base} ${seededPick([
        `Streak's at ${streak} days — that's real consistency now.`,
        `${streak} days in a row. This is becoming a habit, not a sprint.`,
        `${streak}-day streak holding strong.`,
      ], streak)}`;
    }
    if (streak >= 3) {
      return `${base} ${seededPick([
        `Streak's at ${streak} days — keep it going!`,
        `${streak} days running. Don't break it now.`,
        `${streak} in a row — nice momentum.`,
      ], streak)}`;
    }
    return base;
  }

  switch (page) {
    case "dashboard": {
      let base;
      if (todayHours === 0) {
        base = seededPick([
          `Haven't logged any study time yet today${who} — even 20 minutes counts.`,
          `Nothing logged today${who} yet. Pick the easiest subject and just start the clock.`,
          `Day's still open${who} — one small session now beats a big one you never start.`,
        ], `d0-${overdueRevisions}-${backlogChapters}`);
      } else if (todayHours >= dailyGoal) {
        base = seededPick([
          `You hit your ${dailyGoal}h goal today — that's the good stuff. 🌸`,
          `${dailyGoal}h goal: done. Anything extra now is pure bonus.`,
          `Goal met — ${todayHours}h logged. Good day, ${name || "friend"}.`,
        ], `dg-${todayHours}`);
      } else {
        base = seededPick([
          `${todayHours}h logged today, ${remaining.toFixed(1)}h to go for your goal.`,
          `${remaining.toFixed(1)}h left to hit your ${dailyGoal}h goal — you're already ${todayHours}h in.`,
          `Halfway-ish: ${todayHours}h down, ${remaining.toFixed(1)}h to close it out.`,
        ], `dp-${todayHours}-${dailyGoal}`);
      }
      const text = withStreakAddendum(base);
      let action = null;
      if (overdueRevisions > 0) action = { label: `${overdueRevisions} revision${overdueRevisions > 1 ? "s" : ""} overdue`, page: "revision" };
      else if (backlogChapters > 5) action = { label: `${backlogChapters} chapters in backlog`, page: "backlog" };
      else if (mocksCount === 0) action = { label: "Log your first mock", page: "mocks" };
      else if (backlogChapters > 0) action = { label: `${backlogChapters} chapters in backlog`, page: "backlog" };
      return { text, action };
    }

    case "study":
      return {
        text: seededPick([
          "Log today's session here — every hour you track feeds your streak and stats.",
          "Even a rough, unfocused hour is worth logging. The data doesn't need to be pretty, just honest.",
          "This is the ledger that everything else — streaks, analytics, insights — reads from. Keep it current.",
          streakDaysLeft >= 5
            ? "You've studied most days this week already — logging today keeps that trend visible on your analytics."
            : "Log today's session here — every hour you track feeds your streak and stats.",
        ], `study-${streakDaysLeft}`),
      };

    case "timer":
      return {
        text: seededPick([
          "Start a focus timer for a distraction-free block — I'll be cheering you on.",
          "Pick a subject, set a block, and let the timer do the discipline for you.",
          "A 25–50 minute focused block beats an hour of half-attention. Try one now.",
        ], "timer"),
      };

    case "syllabus": {
      if (backlogChapters === 0) {
        return { text: seededPick([
          "Syllabus's looking clean — nice work!",
          "Nothing pending here right now — a good moment to get ahead on revision instead.",
          `${masteredCount > 0 ? `${masteredCount} chapters mastered and ` : ""}syllabus fully cleared. Enjoy it.`,
        ], "syl-clean") };
      }
      const tier = overallPct >= 75 ? "close" : overallPct >= 40 ? "mid" : "early";
      const text = seededPick(
        tier === "close"
          ? [`${backlogChapters} chapters left and you're at ${overallPct}% overall — you're close, don't let these last ones drag.`, `Just ${backlogChapters} chapters standing between you and a clean syllabus. Push through.`]
          : tier === "mid"
          ? [`${backlogChapters} chapters still pending, ${overallPct}% done overall — steady pace, pick one and chip away.`, `${overallPct}% through the syllabus. ${backlogChapters} chapters to go — no need to rush all at once.`]
          : [`${backlogChapters} chapters still pending — pick one and chip away, no need to do it all today.`, `Early days on this — ${backlogChapters} chapters pending. Start with whichever subject feels lightest.`],
        `syl-${overallPct}-${backlogChapters}`
      );
      return { text };
    }

    case "backlog": {
      if (backlogChapters === 0) return { text: seededPick(["No backlog right now — enjoy it while it lasts.", "Backlog's empty. This is the best time to get ahead on revision instead of letting it pile up again."], "bl-clean") };
      if (backlogChapters >= 10) return { text: seededPick([
        `${backlogChapters} chapters waiting — that's a real pile. Don't try to clear it in one sitting; pick 1–2 for today.`,
        `${backlogChapters} chapters backlogged. Sort by what's blocking other topics and start there, not by what's easiest.`,
      ], `bl-big-${backlogChapters}`) };
      if (backlogChapters >= 4) return { text: seededPick([
        `${backlogChapters} chapters waiting on you. Start with whichever feels lightest.`,
        `${backlogChapters} pending — knock out one today so it doesn't grow into next week's problem.`,
      ], `bl-mid-${backlogChapters}`) };
      return { text: seededPick([
        `Just ${backlogChapters} chapter${backlogChapters > 1 ? "s" : ""} waiting — an easy one to clear today.`,
        `${backlogChapters} left in backlog. Small enough to finish this session.`,
      ], `bl-small-${backlogChapters}`) };
    }

    case "questions": {
      const ratio = totalQuestions > 0 ? Math.round((todayQuestions / Math.max(totalQuestions, 1)) * 100) : 0;
      return { text: seededPick([
        `${todayQuestions} solved today, ${totalQuestions} lifetime. Keep the reps up.`,
        todayQuestions === 0
          ? `Nothing solved yet today — even 10 questions keeps the streak of practice alive. ${totalQuestions} lifetime so far.`
          : `${totalQuestions} lifetime questions, ${todayQuestions} of those today. Volume compounds — keep going.`,
        `Reps matter more than any single session. ${totalQuestions} solved lifetime, ${todayQuestions} today.`,
      ], `q-${todayQuestions}-${ratio}`) };
    }

    case "mocks": {
      if (mocksCount === 0) {
        return { text: seededPick([
          "No mocks logged yet — try one when you're ready, it's the best signal we've got.",
          "Mocks are the closest thing to a real exam-day rehearsal. Log your first one when you take it.",
        ], "mocks-0") };
      }
      if (mocksCount === 1) {
        return { text: seededPick([
          "One mock logged. One data point isn't a trend yet — take another when you can to start seeing patterns.",
          "First mock's in. The real value shows up once you've got a few to compare.",
        ], "mocks-1") };
      }
      const scored = mocks.map((m) => Number(m.biology_marks || (Number(m.botany_marks || 0) + Number(m.zoology_marks || 0)) || 0) + Number(m.physics_marks || 0) + Number(m.chemistry_marks || 0) + Number(m.math_marks || 0));
      const last = scored[0], prev = scored[1];
      if (typeof last === "number" && typeof prev === "number" && !Number.isNaN(last) && !Number.isNaN(prev)) {
        if (last > prev) return { text: seededPick([
          `Last mock was up from the one before it — whatever you adjusted, it's working.`,
          `Improving mock-to-mock. Keep doing what you did before the last one.`,
        ], `mocks-up-${last}`) };
        if (last < prev) return { text: seededPick([
          `Last mock dipped a bit from the one before — one off mock isn't a trend, but worth a quick look at what changed.`,
          `Score dropped slightly vs. your last mock. Check accuracy vs. attempts before assuming it's a knowledge gap.`,
        ], `mocks-down-${last}`) };
      }
      return { text: seededPick([
        `${mocksCount} mocks logged. Consistency here matters more than any single score.`,
        `${mocksCount} mocks in. Look at the trend line, not any one number.`,
      ], `mocks-${mocksCount}`) };
    }

    case "revision": {
      if (overdueRevisions > 0) return { text: seededPick([
        `${overdueRevisions} revision${overdueRevisions > 1 ? "s" : ""} overdue — those fade fastest, tackle them first.`,
        `${overdueRevisions} overdue. The longer these sit, the more you'll have forgotten — clear them before new ones pile on.`,
      ], `rev-over-${overdueRevisions}`) };
      if (dueRevisions > 0) return { text: seededPick([
        `${dueRevisions} revision${dueRevisions > 1 ? "s" : ""} due today.`,
        `${dueRevisions} due right now — a quick pass while it's still fresh-ish.`,
      ], `rev-due-${dueRevisions}`) };
      if (upcomingRevisions > 0) return { text: seededPick([
        `All caught up for today — ${upcomingRevisions} more coming up soon.`,
        `Nothing due today. ${upcomingRevisions} scheduled for the next few days, so this gap won't last.`,
      ], `rev-up-${upcomingRevisions}`) };
      return { text: seededPick(["Revisions are all caught up — nicely done.", "Clean slate on revisions right now. Good spot to be in."], "rev-clean") };
    }

    case "planner":
      return { text: seededPick([
        "Plan today's tasks here — small steps, tracked daily.",
        "Breaking today into a few concrete tasks beats one vague goal like \"study more.\"",
        "A short, honest task list here is worth more than an ambitious one you won't finish.",
      ], "planner") };

    case "analytics":
      return { text: seededPick([
        "Your trends live here — check in weekly to spot patterns.",
        "This is where single bad days stop mattering and the bigger pattern shows up instead.",
        "Worth a look after a few weeks of logging — one day tells you little, ten days tell you a lot.",
      ], "analytics") };

    case "ai":
      return { text: seededPick([
        "Click Generate any time you want a fresh, data-backed read on how things are going.",
        "This reads your actual numbers, not generic advice — worth checking after a mock or a rough week.",
      ], "ai") };

    case "achievements": {
      const frac = achievementDefsCount > 0 ? unlockedCount / achievementDefsCount : 0;
      if (unlockedCount === 0) return { text: seededPick([
        `${unlockedCount}/${achievementDefsCount} badges unlocked — there's always another one within reach.`,
        `None unlocked yet — the first one usually comes from just logging a session or two.`,
      ], "ach-0") };
      if (frac >= 0.8) return { text: seededPick([
        `${unlockedCount}/${achievementDefsCount} unlocked — almost the full set now.`,
        `${unlockedCount}/${achievementDefsCount}. You're close to clearing this whole board.`,
      ], `ach-hi-${unlockedCount}`) };
      return { text: seededPick([
        `${unlockedCount}/${achievementDefsCount} badges unlocked — there's always another one within reach.`,
        `${unlockedCount}/${achievementDefsCount} so far. Check the locked ones for hints on what's next.`,
      ], `ach-${unlockedCount}`) };
    }

    case "leaderboard":
      return { text: seededPick([
        "Compare your pace with others here, but remember — your own trend line matters more than any single rank.",
        "Ranks shift daily. Use this for a nudge of motivation, not a verdict on how you're doing.",
      ], "leaderboard") };

    case "profile":
      return { text: seededPick([
        "This is your corner — stats, streak, and badges all in one place.",
        `${masteredCount > 0 ? `${masteredCount} chapters mastered and counting. ` : ""}This is your corner — stats, streak, and badges all in one place.`,
      ], `profile-${masteredCount}`) };

    case "settings":
      return { text: seededPick([
        "Tweak things here to make StudyBun feel like yours.",
        `Swap your theme or mascot here whenever the vibe needs a refresh — ${theme.sound} approved.`,
      ], "settings") };

    default:
      return { text: seededPick(["I'm here whenever you need a nudge.", "Tap me anytime — quick tip or a real chat, your call."], "default") };
  }
}
