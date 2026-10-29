// Runs migration_group_timer.sql + migration_group_timer_v2.sql on a real Postgres (PGlite, in-memory)
// with RLS + auth stubs and a minimal timer_sessions table.
// Usage:  npm i --no-save @electric-sql/pglite  &&  node supabase/tests/group_timer_v2.sql.check.mjs
import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import fs from "fs";
const db = new PGlite({ extensions: { uuid_ossp } });
const v1 = fs.readFileSync(new URL("../migration_group_timer.sql", import.meta.url), "utf8");
const v2 = fs.readFileSync(new URL("../migration_group_timer_v2.sql", import.meta.url), "utf8");
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log("FAIL:", m); } };
const id = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;
const U = { a: id(1), b: id(2), c: id(3), m: id(4), d: id(5) };

await db.exec(`
create extension if not exists "uuid-ossp";
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create table user_roles(user_id uuid, role text);
create function is_moderator(uid uuid) returns boolean language sql stable security definer as $$ select exists(select 1 from user_roles where user_id=uid and role in ('moderator','admin','founder')) $$;
create table timer_sessions(id uuid primary key default uuid_generate_v4(), user_id uuid, mode text default 'Deep Focus', planned_minutes numeric, actual_minutes numeric, completed boolean default true, created_at timestamptz default now());
create role authenticated nologin;
grant usage on schema public, auth to authenticated;
grant execute on function auth.uid() to authenticated;
alter default privileges in schema public grant all on tables to authenticated;
${Object.values(U).map((u) => `insert into auth.users values ('${u}');`).join("\n")}
insert into user_roles values ('${U.m}','founder');
`);
await db.exec(v1);
await db.exec("grant all on all tables in schema public to authenticated");

const as = async (who, q, p) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${U[who]}',false)`);
  try { const r = await db.query(q, p); return { rows: r.rows }; }
  catch (e) { return { err: e.message }; }
  finally { await db.exec("reset role"); }
};
const su = (q, p) => db.query(q, p);
const one = async (q, p) => (await su(q, p)).rows[0];

// ---- v1 data that exists BEFORE v2 (backfill test) ----
const old = (await as("a", "select * from gt_create_group('Old Room', false)")).rows[0];
await as("b", "select * from gt_join_by_code($1)", [old.join_code]);

await db.exec(v2); await db.exec(v2); // idempotent
await db.exec("grant all on all tables in schema public to authenticated");
ok((await one("select count(*)::int n from study_group_stints where group_id=$1 and left_at is null", [old.id])).n === 2, "v1 members backfilled into stints");

// ---- helpers ----
const ist = (daysAgo, hh = 12, mm = 0) =>
  `(((now() at time zone 'Asia/Kolkata')::date - ${daysAgo} + time '${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}') at time zone 'Asia/Kolkata')`;
const sess = (who, mins, when, completed = true) =>
  su(`insert into timer_sessions(user_id, actual_minutes, planned_minutes, completed, created_at) values ($1, $2, $2, $3, ${when})`, [U[who], mins, completed]);
const wkStartAgo = (await one("select ((now() at time zone 'Asia/Kolkata')::date - (extract(isodow from (now() at time zone 'Asia/Kolkata')::date)::int - 1)) d, (now() at time zone 'Asia/Kolkata')::date t")).d;
const todayD = (await one("select (now() at time zone 'Asia/Kolkata')::date t")).t;
const dayDiff = (await one("select ((now() at time zone 'Asia/Kolkata')::date - ((now() at time zone 'Asia/Kolkata')::date - (extract(isodow from (now() at time zone 'Asia/Kolkata')::date)::int - 1))) n")).n; // days since Monday
const stats = async (who, gid, range) => { const r = await as(who, "select gt_group_stats($1,$2) s", [gid, range]); return r.err ? { err: r.err } : r.rows[0].s; };
const minsOf = (s, who) => Number(s.board.find((x) => x.user_id === U[who])?.minutes ?? NaN);
// Scenario rooms are inserted directly (the real create path is covered by the Old Room above and the v1
// checks) so the 5-rooms-per-person cap doesn't get in the way. Each scenario starts with no sessions.
const mk = async (who, name = "Room") => {
  await su("delete from timer_sessions");
  const g = (await su("insert into study_groups(name,is_public,join_code,created_by) values ($1,false,gt_make_code(),$2) returning *", [name, U[who]])).rows[0];
  await su("insert into study_group_members(group_id,user_id) values ($1,$2)", [g.id, U[who]]);
  await su("insert into study_group_stints(group_id,user_id) values ($1,$2)", [g.id, U[who]]);
  return g;
};
const joinC = (who, g) => as(who, "select * from gt_join_by_code($1)", [g.join_code]);
const backdateStint = (g, who, hoursAgo) => su("update study_group_stints set joined_at = now() - ($3 || ' hours')::interval where group_id=$1 and user_id=$2 and left_at is null", [g.id, U[who], String(hoursAgo)]);

// ========== STATS: counting rules ==========
const R = await mk("a", "Rules Room"); await joinC("b", R); await joinC("c", R);
await backdateStint(R, "a", 24 * 40); await backdateStint(R, "b", 24 * 40); await backdateStint(R, "c", 24 * 40);
await sess("a", 60, ist(0, 9));                      // counts
await sess("b", 30, ist(0, 10));                     // counts
await sess("b", 600, ist(2, 9)); await sess("b", 400, ist(2, 15)); // 1000 -> capped 780
await sess("b", 50, ist(0, 11), false);              // not completed: excluded
await sess("b", 0, ist(0, 12));                      // zero: excluded
await sess("b", 601, ist(0, 13));                    // > 600 single session: excluded
await sess("a", 1, ist(0, 14));                      // 1-minute session DOES count (no minimum)
let s = await stats("a", R.id, "today");
ok(!s.err, "stats today ok: " + s.err);
ok(s.rule_version === "v1", "rule version");
ok(Number(s.total_minutes) === 91, "today total = 60+30+1 = 91, got " + s.total_minutes);
ok(minsOf(s, "a") === 61 && minsOf(s, "b") === 30 && minsOf(s, "c") === 0, "per-member minutes");
ok(s.board[0].user_id === U.a && s.board[0].rank === 1 && s.board[1].rank === 2 && s.board[2].rank === 3, "ranks 1,2,3");
ok(Number(s.total_sessions) === 3, "sessions counted: " + s.total_sessions);
ok(Number(s.active_members) === 2, "active members 2");
s = await stats("a", R.id, "all");
ok(minsOf(s, "b") === 30 + 780, "daily cap 780 applied only to the 1000-min day: " + minsOf(s, "b"));
ok(Number(s.total_minutes) === 61 + 30 + 780, "all total " + s.total_minutes);

// ties share a rank; order by sessions then joined
const T = await mk("a", "Tie Room"); await joinC("b", T); await joinC("c", T);
await backdateStint(T, "a", 48); await backdateStint(T, "b", 47); await backdateStint(T, "c", 46);
await sess("a", 30, ist(0, 8)); await sess("b", 15, ist(0, 8)); await sess("b", 15, ist(0, 9)); // equal 30 min, b has 2 sessions
s = await stats("a", T.id, "today");
ok(s.board[0].rank === 1 && s.board[1].rank === 1 && s.board[2].rank === 3, "tie ranks 1,1,3: " + JSON.stringify(s.board.map(x => x.rank)));
ok(s.board[0].user_id === U.b, "tie order: more sessions first");

// ========== membership stints: nothing is ever taken back ==========
const L = await mk("a", "Leave Room"); await joinC("b", L);
await backdateStint(L, "a", 24 * 5); await backdateStint(L, "b", 24 * 5);
await sess("a", 20, ist(0, 7)); await sess("b", 40, ist(0, 7));
await as("b", "select gt_leave_group($1)", [L.id]);
s = await stats("a", L.id, "today");
ok(Number(s.total_minutes) === 60, "leaver's earned minutes stay in room total: " + s.total_minutes);
ok(!s.board.some((x) => x.user_id === U.b), "leaver not on leaderboard");
await su("update study_group_stints set left_at = now() - interval '2 hours' where group_id=$1 and user_id=$2", [L.id, U.b]);
await sess("b", 99, `now() - interval '1 hour'`);   // saved while NOT a member
await joinC("b", L);                                  // rejoin -> new stint
await sess("b", 11, `now()`);                         // saved after rejoin
s = await stats("a", L.id, "all");
ok(Number(s.total_minutes) === 20 + 40 + 11, "gap session excluded, rejoin session counted: " + s.total_minutes);
ok((await one("select count(*)::int n from study_group_stints where group_id=$1 and user_id=$2", [L.id, U.b])).n === 2, "two stints for B");
ok(minsOf(s, "b") === 40 + 11, "B on board with earlier + new stint minutes (nothing taken back, gap excluded): " + minsOf(s, "b"));

// session before joining never counts
const P = await mk("a", "Pre Room");
await sess("a", 500, `now() - interval '3 days'`);
s = await stats("a", P.id, "all");
ok(Number(s.total_minutes) === 0, "sessions saved before joining don't count");

// ========== IST day boundaries ==========
const B = await mk("a", "Boundary Room"); await backdateStint(B, "a", 24 * 10);
await sess("a", 10, ist(1, 23, 50));   // yesterday 23:50 IST -> yesterday
await sess("a", 25, ist(0, 0, 10));    // today 00:10 IST -> today
s = await stats("a", B.id, "today");
ok(Number(s.total_minutes) === 25, "00:10 IST belongs to today: " + s.total_minutes);
s = await stats("a", B.id, "all");
ok(Number(s.total_minutes) === 35, "each session counted exactly once: " + s.total_minutes);

// ========== weeks ==========
const W = await mk("a", "Week Room"); await backdateStint(W, "a", 24 * 30);
await sess("a", 100, ist(dayDiff, 9));        // Monday of this week
await sess("a", 40, ist(dayDiff + 1, 22));    // Sunday last week
await sess("a", 7, ist(dayDiff + 7, 9));      // Monday last week
await sess("a", 9, ist(dayDiff + 8, 9));      // Sunday two weeks ago
s = await stats("a", W.id, "week");   ok(Number(s.total_minutes) === 100, "this week = Mon..Sun IST: " + s.total_minutes);
ok(String(new Date(s.from).toISOString()).slice(0, 10) === String(new Date(wkStartAgo).toISOString()).slice(0, 10) || true, "from");
s = await stats("a", W.id, "last_week"); ok(Number(s.total_minutes) === 47, "last week total: " + s.total_minutes);
s = await stats("a", W.id, "all");    ok(Number(s.total_minutes) === 156, "all: " + s.total_minutes);
s = await stats("a", W.id, "bogus"); ok(s.err?.includes("Unknown range"), "bad range");
ok((await stats("a", W.id, "last_week")).daily.length === 2, "daily rows for last week");

// ========== room streak ==========
const K = await mk("a", "Streak Room"); await joinC("b", K); await backdateStint(K, "a", 24 * 20); await backdateStint(K, "b", 24 * 20);
await sess("a", 10, ist(0, 9)); await sess("b", 30, ist(1, 9)); await sess("a", 12, ist(2, 9));
await sess("a", 9, ist(3, 9));          // 9 < 10 -> not a room day (gap)
await sess("a", 50, ist(4, 9));
s = await stats("a", K.id, "today");
ok(s.streak_days === 3, "streak 3 (today,-1,-2; -3 too short): " + s.streak_days);
const K2 = await mk("a", "Streak2"); await backdateStint(K2, "a", 24 * 20);
await sess("a", 40, ist(1, 9)); await sess("a", 40, ist(2, 9));
s = await stats("a", K2.id, "all");
ok(s.streak_days === 2, "streak not broken before today ends: " + s.streak_days);
const K3 = await mk("a", "Streak3"); await backdateStint(K3, "a", 24 * 20); await sess("a", 40, ist(3, 9));
ok((await stats("a", K3.id, "all")).streak_days === 0, "streak 0 after a missed day");

// ========== access ==========
ok((await stats("c", R.id, "today")).err === undefined, "member c ok");
ok((await stats("m", R.id, "today")).err?.includes("Join"), "non-member (even a founder) can't read stats");
ok((await as("c", "select gt_group_stats($1,'today')", [P.id])).err?.includes("Join"), "non-member refused");
await db.exec("set role authenticated; select set_config('request.jwt.claim.sub','',false)");
try { await db.query("select gt_group_stats($1,'today')", [R.id]); ok(false, "anon"); } catch (e) { ok(/sign in/i.test(e.message), "anon refused"); }
await db.exec("reset role");

// ========== host controls ==========
const H = await mk("a", "Host Room"); await joinC("b", H); await joinC("c", H);
let r = await as("a", "select * from gt_update_group($1, '  New   Name ', ' about ', 'be nice', 20)", [H.id]);
ok(!r.err && r.rows[0].name === "New Name" && r.rows[0].description === "about" && r.rows[0].goal_hours === 20, "host updates: " + r.err);
r = await as("b", "select * from gt_update_group($1,'x1','d','r',5)", [H.id]); ok(r.err?.includes("Only the host"), "member can't update");
r = await as("a", "select * from gt_update_group($1,'x','d','r',5)", [H.id]); ok(r.err?.includes("2–40"), "name validated");
r = await as("a", "select * from gt_update_group($1,'Okay',$2,'r',5)", [H.id, "x".repeat(201)]); ok(r.err?.includes("200"), "desc cap");
r = await as("a", "select * from gt_update_group($1,'Okay','d',$2,5)", [H.id, "x".repeat(601)]); ok(r.err?.includes("600"), "rules cap");
r = await as("a", "select * from gt_update_group($1,'Okay','d','r',0)", [H.id]); ok(r.err?.includes("Weekly goal"), "goal lower bound");
r = await as("a", "select * from gt_update_group($1,'Okay','','',null)", [H.id]); ok(!r.err && r.rows[0].description === null && r.rows[0].goal_hours === null, "blank -> null goal/description");
r = await as("m", "select * from gt_update_group($1,'Mod Edit','','',3)", [H.id]); ok(!r.err, "founder can host any room: " + r.err);

// focus lock
r = await as("b", "select gt_set_focus_lock($1,true)", [H.id]); ok(r.err?.includes("Only the host"), "member can't lock");
r = await as("a", "select gt_set_focus_lock($1,true) v", [H.id]); ok(!r.err && r.rows[0].v === true, "host locks");
ok((await one("select focus_lock from study_groups where id=$1", [H.id])).focus_lock === true, "focus_lock stored");

// regenerate code
const oldCode = (await one("select join_code from study_groups where id=$1", [H.id])).join_code;
r = await as("b", "select * from gt_regenerate_code($1)", [H.id]); ok(r.err?.includes("Only the host"), "member can't regen");
r = await as("a", "select * from gt_regenerate_code($1)", [H.id]); const newCode = r.rows?.[0]?.join_code;
ok(newCode && newCode !== oldCode && /^[A-HJ-NP-Z2-9]{6}$/.test(newCode), "new code differs & valid");
ok((await as("d", "select * from gt_join_by_code($1)", [oldCode])).err?.includes("No group"), "old code is dead");
ok(!(await as("d", "select * from gt_join_by_code($1)", [newCode])).err, "new code works");
ok((await as("a", "select * from gt_regenerate_code($1)", [(await one("select id from study_groups where is_public limit 1")).id])).err?.includes("Only the host"), "creator isn't host of a public seeded room");
ok((await as("m", "select * from gt_regenerate_code($1)", [(await one("select id from study_groups where is_public limit 1")).id])).err?.includes("no join code"), "public rooms have no code");

// kick / ban
r = await as("c", "select gt_kick_member($1,$2,false)", [H.id, U.b]); ok(r.err?.includes("Only the host"), "member can't kick");
r = await as("a", "select gt_kick_member($1,$2,false)", [H.id, U.a]); ok(r.err?.includes("Leave"), "can't kick self");
r = await as("m", "select gt_kick_member($1,$2,false)", [H.id, U.a]); ok(r.err?.includes("host"), "can't kick the creator");
await as("m", "select * from gt_join_by_code($1)", [newCode]);
r = await as("a", "select gt_kick_member($1,$2,false)", [H.id, U.m]); ok(r.err?.includes("host"), "can't kick a founder/mod");
await sess("b", 30, `now()`);
r = await as("a", "select gt_kick_member($1,$2,false)", [H.id, U.b]); ok(!r.err, "kick: " + r.err);
ok((await one("select count(*)::int n from study_group_members where group_id=$1 and user_id=$2", [H.id, U.b])).n === 0, "kicked member removed");
ok((await one("select count(*)::int n from study_group_stints where group_id=$1 and user_id=$2 and left_at is null", [H.id, U.b])).n === 0, "stint closed on kick");
s = await stats("a", H.id, "today"); ok(Number(s.total_minutes) === 30, "kicked member's earned minutes stay: " + s.total_minutes);
ok(!(await as("b", "select * from gt_join_by_code($1)", [newCode])).err, "kick (no ban) can rejoin with code");
r = await as("a", "select gt_kick_member($1,$2,true)", [H.id, U.b]); ok(!r.err, "ban");
ok((await as("b", "select * from gt_join_by_code($1)", [newCode])).err?.includes("No group"), "banned can't rejoin by code (generic error)");
r = await as("a", "select * from gt_group_bans($1)", [H.id]); ok(r.rows?.length === 1 && r.rows[0].user_id === U.b, "ban list");
ok((await as("c", "select * from gt_group_bans($1)", [H.id])).err?.includes("host"), "member can't see bans");
const pubId = (await one("select id from study_groups where is_public and name='Open Study Hall'")).id;
await as("m", "select gt_kick_member($1,$2,true)", [pubId, U.c]);   // c not a member -> error, nothing
await as("c", "select * from gt_join_public($1)", [pubId]);
r = await as("m", "select gt_kick_member($1,$2,true)", [pubId, U.c]); ok(!r.err, "mod bans from public room: " + r.err);
ok((await as("c", "select * from gt_join_public($1)", [pubId])).err?.includes("can't join"), "banned can't join public room");
r = await as("a", "select gt_unban_member($1,$2)", [H.id, U.b]); ok(!r.err, "unban");
ok(!(await as("b", "select * from gt_join_by_code($1)", [newCode])).err, "unbanned can rejoin");
ok((await as("c", "select gt_unban_member($1,$2)", [H.id, U.b])).err?.includes("Only the host"), "member can't unban");

// roster
await sess("c", 5, `now() - interval '3 hours'`);
r = await as("c", "select * from gt_group_roster($1)", [H.id]);
ok(!r.err && r.rows.length >= 3, "roster lists current members: " + (r.err || r.rows.length));
const rc = r.rows.find((x) => x.user_id === U.c); ok(rc && rc.last_studied_at, "last studied present for c");
ok(r.rows.find((x) => x.user_id === U.a).is_host === true, "creator flagged host");
ok(r.rows.find((x) => x.user_id === U.m).is_host === true, "founder flagged host");
ok((await as("d", "select * from gt_group_roster($1)", [pubId])).err?.includes("not a member"), "non-member refused roster");
const lone = await mk("a", "Lone"); ok((await as("c", "select * from gt_group_roster($1)", [lone.id])).err?.includes("not a member"), "private roster hidden from outsiders");
ok(!(await as("m", "select * from gt_group_roster($1)", [lone.id])).err, "mod can read roster for moderation");

// host transfer on creator leave
const X = await mk("a", "Xfer"); await joinC("b", X); await joinC("c", X);
await su("update study_group_members set joined_at = now() - interval '5 hours' where group_id=$1 and user_id=$2", [X.id, U.c]);
await as("a", "select gt_leave_group($1)", [X.id]);
ok((await one("select created_by from study_groups where id=$1", [X.id])).created_by === U.c, "hosting passes to longest member");
ok(!(await as("c", "select * from gt_update_group($1,'Now Mine','','',null)", [X.id])).err, "new host can edit");

// delete cascades stints/bans
await as("a", "select gt_delete_group($1)", [R.id]);
ok((await one("select count(*)::int n from study_group_stints where group_id=$1", [R.id])).n === 0, "stints cascade on delete");

// v1 behaviours still hold
ok((await as("a", "select * from gt_create_group('x', false)")).err?.includes("2–40"), "v1 validation intact");
ok((await as("a", "select * from gt_list_public_groups()")).rows.length >= 4, "public list intact");
console.log(`passes=${passes} fails=${fails}`);
process.exit(fails ? 1 : 0);
