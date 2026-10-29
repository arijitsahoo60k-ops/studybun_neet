import { todayIST, istHour, daysUntilIST, daysAgoIST } from "../../src/lib/dateIST.js";

/**
 * Pulls together everything the notification AI needs to say something
 * genuinely specific to this student's actual day — not a generic
 * "keep studying!" ping. Every query is scoped to `user_id` and this file
 * only ever runs server-side with the service-role key.
 */
export async function buildUserContext(admin, userId) {
  const today = todayIST();
  const weekAgo = daysAgoIST(6);

  const [
    profileRes,
    tasksRes,
    revisionsRes,
    studyTodayRes,
    studyWeekRes,
    timerTodayRes,
    backlogRes,
    goalsRes,
    lastMockRes,
    statsRes,
    checkinsRes,
  ] = await Promise.all([
    admin.from("profiles").select("name, exam, exam_date, daily_goal").eq("user_id", userId).maybeSingle(),
    admin.from("tasks").select("title, subject, priority, status, due_date, category")
      .eq("user_id", userId).eq("due_date", today).neq("status", "Completed"),
    admin.from("revision_plans").select("subject, chapter, revision_number, due_date, status")
      .eq("user_id", userId).eq("status", "Pending").lte("due_date", today).order("due_date", { ascending: true }).limit(20),
    admin.from("study_sessions").select("minutes, platform").eq("user_id", userId).eq("session_date", today),
    admin.from("study_sessions").select("minutes, platform, session_date").eq("user_id", userId).gte("session_date", weekAgo),
    admin.from("timer_sessions").select("actual_minutes, completed, created_at")
      .eq("user_id", userId).eq("completed", true).gte("created_at", `${today}T00:00:00Z`),
    admin.from("backlog_items").select("title, subject, status").eq("user_id", userId).neq("status", "Completed").limit(50),
    admin.from("goals").select("title, deadline, starred").eq("user_id", userId).eq("status", "Active").limit(10),
    admin.from("mock_tests").select("exam_name, mock_date, total_marks, percentile")
      .eq("user_id", userId).order("mock_date", { ascending: false }).limit(1),
    admin.from("user_statistics").select("current_streak, longest_streak").eq("user_id", userId).maybeSingle(),
    admin.from("accountability_goals").select("goal_text, subject, status").eq("user_id", userId).eq("goal_date", today),
  ]);

  const profile = profileRes.data || {};

  // Rows logged from the "what did you study?" card after a focus-timer
  // session are tagged platform: "Focus Timer" — their minutes already
  // live in timer_sessions (logged automatically when the timer completes),
  // so they must be excluded here or every timer session gets counted
  // twice. This mirrors the `manualSessions` filter in src/App.jsx exactly
  // — keep both in sync if the tagging convention ever changes.
  const manualToday = (studyTodayRes.data || []).filter((r) => r.platform !== "Focus Timer");
  const manualWeek = (studyWeekRes.data || []).filter((r) => r.platform !== "Focus Timer");

  const minutesToday =
    manualToday.reduce((s, r) => s + Number(r.minutes || 0), 0) +
    (timerTodayRes.data || []).reduce((s, r) => s + Number(r.actual_minutes || 0), 0);
  const minutesWeek = manualWeek.reduce((s, r) => s + Number(r.minutes || 0), 0);

  const checkins = checkinsRes.data || [];
  // "Open" = not yet resolved. The DB constraint allows status
  // 'planned' | 'studying' | 'completed' | 'partial' | 'missed' (default
  // 'planned'); the UI's addGoal() always inserts 'studying' today, but
  // defining "open" as "not a terminal status" instead of "=== 'studying'"
  // means a 'planned' row (default value, or from any future insert path)
  // still counts as open instead of silently falling through uncounted.
  const TERMINAL_STATUSES = new Set(["completed", "partial", "missed"]);
  const checkinsOpen = checkins.filter((c) => !TERMINAL_STATUSES.has(c.status));
  const checkinsCompleted = checkins.filter((c) => c.status === "completed");

  const revisions = revisionsRes.data || [];
  const overdueRevisions = revisions.filter((r) => r.due_date < today);
  const dueTodayRevisions = revisions.filter((r) => r.due_date === today);

  return {
    hour_ist: istHour(),
    date_ist: today,
    student_name: profile.name || null,
    exam: profile.exam || null,
    days_to_exam: profile.exam_date ? daysUntilIST(profile.exam_date) : null,
    daily_goal_hours: profile.daily_goal ?? null,
    study_minutes_today: Math.round(minutesToday),
    study_hours_today: Math.round((minutesToday / 60) * 10) / 10,
    study_minutes_last_7_days: Math.round(minutesWeek),
    current_streak: statsRes.data?.current_streak ?? null,
    tasks_due_today: (tasksRes.data || []).map((t) => ({
      title: t.title, subject: t.subject, priority: t.priority, category: t.category,
    })),
    tasks_due_today_count: (tasksRes.data || []).length,
    revisions_overdue_count: overdueRevisions.length,
    revisions_due_today_count: dueTodayRevisions.length,
    revisions_sample: revisions.slice(0, 6).map((r) => ({
      subject: r.subject, chapter: r.chapter, rep: r.revision_number, due_date: r.due_date,
    })),
    backlog_open_count: (backlogRes.data || []).length,
    backlog_sample: (backlogRes.data || []).slice(0, 5).map((b) => ({ title: b.title, subject: b.subject })),
    active_goals: (goalsRes.data || []).map((g) => ({ title: g.title, deadline: g.deadline, starred: g.starred })),
    last_mock: lastMockRes.data?.[0]
      ? { exam_name: lastMockRes.data[0].exam_name, date: lastMockRes.data[0].mock_date, percentile: lastMockRes.data[0].percentile }
      : null,
    // Community "check-in" (accountability_goals for today, see
    // src/hooks/useAccountability.js). has_checked_in_today is false if the
    // student hasn't logged any goal for today yet — that's the prompt-to-
    // check-in case. checkins_open_count is goals they logged but haven't
    // marked done/partial/missed yet — that's the "close it out" reminder case.
    has_checked_in_today: checkins.length > 0,
    checkins_today_count: checkins.length,
    checkins_open_count: checkinsOpen.length,
    checkins_completed_count: checkinsCompleted.length,
    checkins_open_sample: checkinsOpen.slice(0, 3).map((c) => ({ text: c.goal_text, subject: c.subject })),
  };
}
