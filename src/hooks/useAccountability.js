import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { todayIST, daysAgoIST } from "../lib/dateIST";
import { attachProfiles } from "../lib/communityProfiles";

const SELECT = "id, user_id, goal_date, subject, chapter, goal_type, goal_text, target_value, actual_value, estimated_minutes, status, result_note, created_at, completed_at";

// Soft UX cap on how many goals someone can stack in one day — the table
// itself has no limit (no unique constraint on user_id+goal_date), this is
// purely to stop the checklist from growing unreasonably long.
export const MAX_GOALS_PER_DAY = 5;

// How many past days the "History" view fetches. On-demand only (see
// loadHistory below) so it costs nothing for anyone who never opens it.
export const HISTORY_DAYS = 14;

/**
 * Daily accountability check-ins. A student can log several goals for
 * today (not just one) — `myGoals` is every one of today's rows for the
 * signed-in user, oldest first. `activeGoals` is everyone else's today
 * rows, grouped by person (one entry per person, each holding their list
 * of goals) for the Community page's "Today's check-ins" section. Real
 * Supabase data only — no fabricated counts.
 */
export function useAccountability() {
  const { user } = useAuth();
  const userId = user?.id;
  const [myGoals, setMyGoals] = useState([]); // today's rows, oldest first
  const [activeGoals, setActiveGoals] = useState([]); // [{ user_id, profiles, goals: [...] }]
  const [weekly, setWeekly] = useState({ total: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  // Past days only (today lives in myGoals), newest first:
  // [{ date, goals: [...] }]. Loaded lazily — see loadHistory.
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const today = todayIST();
    const weekAgo = daysAgoIST(6);

    const [mineRes, othersRes, weekRes] = await Promise.all([
      supabase.from("accountability_goals").select(SELECT).eq("user_id", userId).eq("goal_date", today).order("created_at", { ascending: true }),
      supabase.from("accountability_goals").select(SELECT).eq("goal_date", today).neq("user_id", userId).order("created_at", { ascending: false }).limit(60),
      supabase.from("accountability_goals").select("id, status").eq("user_id", userId).gte("goal_date", weekAgo),
    ]);

    if (!mounted.current) return;
    if (!mineRes.error) setMyGoals(mineRes.data || []);
    if (!othersRes.error) {
      const withProfiles = await attachProfiles(othersRes.data || []);
      if (!mounted.current) return;
      // Group into one card per person, newest activity first, each
      // holding all of that person's goals for today in the order they
      // were created.
      const order = [];
      const byUser = new Map();
      for (const row of withProfiles) {
        if (!byUser.has(row.user_id)) {
          byUser.set(row.user_id, { user_id: row.user_id, profiles: row.profiles, goals: [] });
          order.push(row.user_id);
        }
        byUser.get(row.user_id).goals.push(row);
      }
      for (const uid of order) byUser.get(uid).goals.reverse(); // oldest-first within a person
      setActiveGoals(order.map((uid) => byUser.get(uid)));
    }
    if (!weekRes.error) {
      const rows = weekRes.data || [];
      setWeekly({ total: rows.length, completed: rows.filter((r) => r.status === "completed").length });
    }
    setLoading(false);
  }, [userId]);

  // On-demand only — called when the student actually opens the "History"
  // view, not on every page load. With 167+ users that keeps this from
  // adding a query nobody asked for on top of the today/weekly fetch above.
  // Own rows only, one extra query, so it's cheap even when they do.
  const loadHistory = useCallback(async () => {
    if (!userId) return;
    setHistoryLoading(true);
    setHistoryError(false);
    const since = daysAgoIST(HISTORY_DAYS - 1);
    const today = todayIST();
    const { data, error: err } = await supabase
      .from("accountability_goals")
      .select(SELECT)
      .eq("user_id", userId)
      .gte("goal_date", since)
      .lt("goal_date", today)
      .order("goal_date", { ascending: false })
      .order("created_at", { ascending: true });

    if (!mounted.current) return;
    if (!err) {
      // Group into one entry per day, most-recent day first (the query is
      // already ordered that way, so the order goals are first seen in is
      // the order days should render in — no extra sort needed).
      const order = [];
      const byDate = new Map();
      for (const row of data || []) {
        if (!byDate.has(row.goal_date)) { byDate.set(row.goal_date, []); order.push(row.goal_date); }
        byDate.get(row.goal_date).push(row);
      }
      setHistory(order.map((date) => ({ date, goals: byDate.get(date) })));
      setHistoryLoaded(true);
    } else {
      // Leave historyLoaded false so the "History" tab can be retried
      // (e.g. flipping away and back) instead of getting stuck showing
      // nothing forever after one failed request.
      setHistoryError(true);
    }
    setHistoryLoading(false);
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    // Reset lazily-loaded history whenever the signed-in user changes, so a
    // user switch (without a full page reload) can't leave a previous
    // user's history state sitting around instead of refetching for the
    // new one — everything else here (myGoals/activeGoals/weekly) already
    // gets overwritten by load() below since those aren't lazy.
    setHistory([]);
    setHistoryLoaded(false);
    setHistoryError(false);
    setHistoryLoading(false);
    load();
    if (!userId) return () => { mounted.current = false; };

    const ch = supabase
      .channel(`rt:accountability_goals:${todayIST()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "accountability_goals" }, () => load())
      .subscribe();

    return () => { mounted.current = false; supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, load]);

  // Always adds a new goal for today rather than replacing an existing
  // one — a student can now stack several goals in one day.
  const addGoal = useCallback(
    async (form) => {
      if (!userId) return { ok: false };
      if (myGoals.length >= MAX_GOALS_PER_DAY) {
        return { ok: false, error: `You can track up to ${MAX_GOALS_PER_DAY} goals a day.` };
      }
      const payload = {
        user_id: userId,
        goal_date: todayIST(),
        subject: form.subject || null,
        chapter: form.chapter || null,
        goal_type: form.goalType || "custom",
        goal_text: form.goalText,
        target_value: form.targetValue ?? null,
        estimated_minutes: form.estimatedMinutes ?? null,
        status: "studying",
      };

      const { data, error: err } = await supabase
        .from("accountability_goals")
        .insert(payload)
        .select(SELECT)
        .single();
      if (err) return { ok: false, error: "Couldn't save your goal. Try again." };
      setMyGoals((prev) => [...prev, data]);
      return { ok: true, data };
    },
    [userId, myGoals]
  );

  const updateStatus = useCallback(
    async (id, status, extra = {}) => {
      const patch = { status, ...extra };
      if (status === "completed" || status === "partial" || status === "missed") {
        patch.completed_at = new Date().toISOString();
      }
      const { data, error: err } = await supabase.from("accountability_goals").update(patch).eq("id", id).select(SELECT).single();
      if (err) return { ok: false, error: "Couldn't update that goal." };
      setMyGoals((prev) => prev.map((g) => (g.id === id ? data : g)));
      return { ok: true, data };
    },
    []
  );

  // Lets a student remove a goal they added by mistake today. Own rows
  // only (RLS already restricts delete to auth.uid() = user_id).
  const deleteGoal = useCallback(
    async (id) => {
      const { error: err } = await supabase.from("accountability_goals").delete().eq("id", id);
      if (err) return { ok: false, error: "Couldn't remove that goal." };
      setMyGoals((prev) => prev.filter((g) => g.id !== id));
      return { ok: true };
    },
    []
  );

  return {
    myGoals, activeGoals, weekly, loading, addGoal, updateStatus, deleteGoal, refetch: load,
    history, historyLoading, historyLoaded, historyError, loadHistory,
  };
}
