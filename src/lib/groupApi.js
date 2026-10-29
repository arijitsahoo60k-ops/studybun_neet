import { supabase } from "./supabaseClient";

// PostgREST says this when an RPC doesn't exist yet -- i.e. a Group Timer SQL
// migration hasn't been run on this project. It's the one failure that's the
// developer's, not the user's, so it gets its own message.
export function friendlyError(error) {
  if (!error) return null;
  const msg = String(error.message || "");
  if (error.code === "PGRST202" || /could not find the function/i.test(msg)) {
    return "Group Timer isn't fully set up on the server yet (run supabase/migration_group_timer.sql and migration_group_timer_v2.sql).";
  }
  if (/Failed to fetch|NetworkError|network/i.test(msg)) {
    return "Couldn't reach the server — check your connection.";
  }
  return msg || "Something went wrong.";
}

export const isMissingFunction = (error) =>
  !!error && (error.code === "PGRST202" || /could not find the function/i.test(String(error.message || "")));

const BASE_COLS = "id,name,is_public,join_code,created_by,created_at";
const FULL_COLS = `${BASE_COLS},description,rules,goal_hours,focus_lock`;

// One group row the caller may see (public, or one they belong to).
//   row  -> found   |   null -> gone / no longer visible   |   undefined -> couldn't tell (network)
// Falls back to the v1 columns if v2's columns aren't on the server yet, so
// shipping the frontend a moment before the SQL can never break the room.
export async function fetchGroup(groupId) {
  if (!groupId) return null;
  let res = await supabase.from("study_groups").select(FULL_COLS).eq("id", groupId).maybeSingle();
  if (res.error && /column|does not exist/i.test(String(res.error.message || ""))) {
    res = await supabase.from("study_groups").select(BASE_COLS).eq("id", groupId).maybeSingle();
  }
  if (res.error) return undefined;
  return res.data || null;
}

const wrap = async (promise) => {
  const { data, error } = await promise;
  return error ? { error: friendlyError(error) } : { data };
};

export const fetchStats = (groupId, range) => wrap(supabase.rpc("gt_group_stats", { p_group_id: groupId, p_range: range }));
export const fetchRoster = (groupId) => supabase.rpc("gt_group_roster", { p_group_id: groupId });
export const fetchBans = (groupId) => wrap(supabase.rpc("gt_group_bans", { p_group_id: groupId }));
export const updateGroup = (groupId, { name, description, rules, goalHours }) =>
  wrap(supabase.rpc("gt_update_group", { p_group_id: groupId, p_name: name, p_description: description || "", p_rules: rules || "", p_goal_hours: goalHours ?? null }));
export const setFocusLock = (groupId, locked) => wrap(supabase.rpc("gt_set_focus_lock", { p_group_id: groupId, p_locked: !!locked }));
export const regenerateCode = (groupId) => wrap(supabase.rpc("gt_regenerate_code", { p_group_id: groupId }));
export const kickMember = (groupId, userId, ban) => wrap(supabase.rpc("gt_kick_member", { p_group_id: groupId, p_user_id: userId, p_ban: !!ban }));
export const unbanMember = (groupId, userId) => wrap(supabase.rpc("gt_unban_member", { p_group_id: groupId, p_user_id: userId }));
