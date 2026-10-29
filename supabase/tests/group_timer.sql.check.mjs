// Runs migration_group_timer.sql on a real Postgres (PGlite, in-memory) with RLS + auth stubs.
// Usage:  npm i --no-save @electric-sql/pglite  &&  node supabase/tests/group_timer.sql.check.mjs
import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import fs from "fs";
const db = new PGlite({ extensions: { uuid_ossp } });
const sql = fs.readFileSync(new URL("../migration_group_timer.sql", import.meta.url), "utf8");
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log("FAIL:", m); } };
const U = { a: "00000000-0000-0000-0000-00000000000a", b: "00000000-0000-0000-0000-00000000000b", c: "00000000-0000-0000-0000-00000000000c", m: "00000000-0000-0000-0000-00000000000d" };

await db.exec(`
create extension if not exists "uuid-ossp";
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create table user_roles(user_id uuid, role text);
create function is_moderator(uid uuid) returns boolean language sql stable security definer as $$ select exists(select 1 from user_roles where user_id=uid and role in ('moderator','admin','founder')) $$;
create role authenticated nologin;
grant usage on schema public, auth to authenticated;
grant execute on function auth.uid() to authenticated;
alter default privileges in schema public grant all on tables to authenticated;
insert into auth.users values ('${U.a}'),('${U.b}'),('${U.c}'),('${U.m}');
insert into user_roles values ('${U.m}','founder');
`);
try { await db.exec(sql); await db.exec(sql); ok(true, ""); } catch (e) { console.log("MIGRATION ERROR:", e.message); process.exit(1); }
await db.exec("grant all on all tables in schema public to authenticated");

const as = async (who, q, p) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${U[who]}',false)`);
  try { const r = await db.query(q, p); return { rows: r.rows }; }
  catch (e) { return { err: e.message }; }
  finally { await db.exec("reset role"); }
};
const seeded = (await db.query("select count(*)::int n from study_groups where is_public")).rows[0].n;
ok(seeded === 4, "seed 4 public rooms once (idempotent), got " + seeded);

let r = await as("a", "select * from gt_create_group('  Night   Owls ', false)");
ok(!r.err, "create private: " + r.err);
const g = r.rows?.[0]; ok(g && /^[A-HJ-NP-Z2-9]{6}$/.test(g.join_code), "code format " + g?.join_code);
ok(g?.name === "Night Owls", "name normalised: " + g?.name);

r = await as("a", "select * from gt_create_group('x', false)"); ok(r.err?.includes("2–40"), "short name rejected");
r = await as("a", "select * from gt_create_group('Pub', true)"); ok(r.err?.includes("founders"), "member cannot make public");
r = await as("m", "select * from gt_create_group('Mod Pub', true)"); ok(!r.err && r.rows[0].join_code === null, "mod makes public: " + r.err);

r = await as("b", "select * from gt_join_by_code($1)", [g.join_code.toLowerCase().slice(0,3)+"-"+g.join_code.slice(3).toLowerCase()]);
ok(!r.err && r.rows[0].id === g.id, "join by messy code: " + r.err);
r = await as("b", "select * from gt_join_by_code('ZZZZZZ')"); ok(r.err?.includes("No group"), "bad code");
r = await as("b", "select * from gt_join_by_code('AB')"); ok(r.err?.includes("6 characters"), "short code");

r = await as("c", "select id from study_groups where id=$1", [g.id]); ok(r.rows.length === 0, "non-member can't see private (RLS)");
r = await as("b", "select id, join_code from study_groups where id=$1", [g.id]); ok(r.rows.length === 1 && r.rows[0].join_code === g.join_code, "member sees code");
r = await as("c", "select count(*)::int n from study_group_members where group_id=$1", [g.id]); ok(r.rows[0].n === 0, "non-member can't see members");
r = await as("b", "select count(*)::int n from study_group_members where group_id=$1", [g.id]); ok(r.rows[0].n === 2, "member sees members");

r = await as("c", "insert into study_groups(name,is_public,join_code) values ('hack',false,'AAAAAA')"); ok(r.err, "direct insert blocked");
r = await as("c", "insert into study_group_members(group_id,user_id) values ($1,$2)", [g.id, U.c]); ok(r.err, "direct member insert blocked");
r = await as("c", "delete from study_group_members where group_id=$1", [g.id]);
ok((await db.query("select count(*)::int n from study_group_members where group_id=$1",[g.id])).rows[0].n === 2, "direct member delete blocked");

r = await as("c", "select * from gt_list_public_groups()"); ok(r.rows?.length === 5 && r.rows.every(x => x.is_member === false), "public list " + (r.err || r.rows?.length));
const pub = r.rows?.find(x => x.name === "Physics Focus");
r = await as("c", "select * from gt_join_public($1)", [pub.id]); ok(!r.err, "join public: " + r.err);
r = await as("c", "select * from gt_list_public_groups()"); ok(r.rows.find(x => x.id === pub.id).is_member && Number(r.rows.find(x => x.id === pub.id).member_count) === 1, "is_member + count");
r = await as("c", "select * from gt_join_public($1)", [g.id]); ok(r.err?.includes("does not exist"), "gt_join_public refuses private");
r = await as("c", "select * from gt_my_groups()"); ok(r.rows?.length === 1 && r.rows[0].name === "Physics Focus", "my groups: " + (r.err || r.rows?.length));
r = await as("a", "select * from gt_my_groups()"); ok(r.rows?.length === 1 && r.rows[0].join_code === g.join_code && Number(r.rows[0].member_count) === 2, "my groups private row");

r = await as("c", "delete from study_groups where id=$1 returning id", [g.id]); ok(r.rows?.length === 0, "non-creator delete matches nothing");
r = await as("a", "select gt_leave_group($1)", [g.id]); ok(!r.err, "creator leave: " + r.err);
ok((await db.query("select count(*)::int n from study_groups where id=$1", [g.id])).rows[0].n === 1, "group survives with 1 member");
r = await as("b", "select gt_leave_group($1)", [g.id]);
ok((await db.query("select count(*)::int n from study_groups where id=$1", [g.id])).rows[0].n === 0, "empty user group auto-deleted");
r = await as("c", "select gt_leave_group($1)", [pub.id]);
ok((await db.query("select count(*)::int n from study_groups where id=$1", [pub.id])).rows[0].n === 1, "seeded group never deleted");

for (let i = 0; i < 5; i++) await as("b", `select * from gt_create_group('G${i}', false)`);
r = await as("b", "select * from gt_create_group('G6', false)"); ok(r.err?.includes("up to 5"), "creation cap");
r = await as("b", "select id from study_groups where created_by=$1 limit 1", [U.b]);
r = await as("b", "delete from study_groups where id=$1 returning id", [r.rows[0].id]); ok(r.rows?.length === 1, "creator can delete own");
const ids = (await db.query("select id from study_groups where created_by=$1",[U.b])).rows.map(x=>x.id);
r = await as("c", "select gt_delete_group($1) d", [ids[0]]); ok(r.rows?.[0]?.d === false, "non-creator RPC delete refused: "+(r.err||""));
for (const id of ids) { r = await as("m", "select gt_delete_group($1) d", [id]); ok(r.rows?.[0]?.d === true, "mod RPC deletes private group: "+(r.err||"")); }
r = await as("a", "select gt_delete_group($1) d", [ids[0]]); ok(r.rows?.[0]?.d === false, "already deleted -> false");

// member cap
const big = (await as("m", "select * from gt_create_group('Cap', false)")).rows[0];
await db.exec(`insert into auth.users select ('10000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,30) i;
 insert into study_group_members(group_id,user_id) select '${big.id}', id from auth.users where id::text like '10000000%' limit 29`);
r = await as("a", "select * from gt_join_by_code($1)", [big.join_code]); ok(r.err?.includes("full"), "member cap: " + (r.err || "joined"));

r = await as("c", "select gt_server_time() t"); ok(Math.abs(Number(r.rows?.[0]?.t) - Date.now()) < 5000, "gt_server_time ~ now: " + (r.err || r.rows?.[0]?.t));

// signed-out
await db.exec("set role authenticated; select set_config('request.jwt.claim.sub','',false)");
try { await db.query("select * from gt_create_group('x1',false)"); ok(false, "anon create should fail"); } catch (e) { ok(/sign in/i.test(e.message), "anon: " + e.message); }
await db.exec("reset role");
console.log(`passes=${passes} fails=${fails}`);
