// In-process backend for the e2e run:
//  - REAL Postgres (PGlite) with the project's actual migrations (v1 + v2), RLS on, auth stubs
//  - tiny HTTP API that behaves like PostgREST for the handful of calls Group Timer makes
//  - WebSocket hub that behaves like Supabase Realtime presence + broadcast (per-topic)
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { WebSocketServer } from "ws";

const SUPA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../supabase");
export const U = {
  asha: "00000000-0000-0000-0000-0000000000a1", bela: "00000000-0000-0000-0000-0000000000b2",
  chirag: "00000000-0000-0000-0000-0000000000c3", dev: "00000000-0000-0000-0000-0000000000d4",
  fay: "00000000-0000-0000-0000-0000000000f6",
};
const NAMES = { asha: "Asha", bela: "Bela", chirag: "Chirag", dev: "Dev", fay: "Founder Fay" };

// How each RPC's result is shaped back to the client (PostgREST semantics).
const ARRAY = new Set(["gt_list_public_groups", "gt_my_groups", "gt_group_roster", "gt_group_bans", "get_community_profiles"]);
const SCALAR = new Set(["gt_server_time", "gt_group_stats", "gt_delete_group", "gt_set_focus_lock", "get_role_ids"]);
const OBJECT = new Set(["gt_create_group", "gt_join_public", "gt_join_by_code", "gt_update_group", "gt_regenerate_code"]);
const IDENT = /^[a-z_][a-z0-9_]*$/;

export async function startServer({ port = 8787 } = {}) {
  const db = new PGlite({ extensions: { uuid_ossp } });
  let queue = Promise.resolve();
  const exclusive = (fn) => { const p = queue.then(fn); queue = p.catch(() => {}); return p; };

  await db.exec(`
    create extension if not exists "uuid-ossp";
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    create table user_roles(user_id uuid, role text);
    create function is_moderator(uid uuid) returns boolean language sql stable security definer as $$ select exists(select 1 from user_roles where user_id=uid and role in ('moderator','admin','founder')) $$;
    create table timer_sessions(id uuid primary key default uuid_generate_v4(), user_id uuid, mode text, planned_minutes numeric, actual_minutes numeric, completed boolean default true, created_at timestamptz default now());
    create table profiles_stub(user_id uuid primary key, name text, mascot text);
    create function get_community_profiles(uids uuid[]) returns table(user_id uuid, name text, mascot text) language sql stable security definer as $$ select p.user_id, p.name, p.mascot from profiles_stub p where p.user_id = any(uids) $$;
    create function get_role_ids() returns jsonb language sql stable security definer as $$ select jsonb_build_object('founders', coalesce((select jsonb_agg(user_id) from user_roles where role='founder'),'[]'::jsonb), 'moderators','[]'::jsonb) $$;
    create role authenticated nologin;
    grant usage on schema public, auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    alter default privileges in schema public grant all on tables to authenticated;
    alter default privileges in schema public grant execute on functions to authenticated;
  `);
  for (const [k, id] of Object.entries(U)) {
    await db.query("insert into auth.users values ($1)", [id]);
    await db.query("insert into profiles_stub values ($1,$2,$3)", [id, NAMES[k], ["bunny", "cat", "fox", "bear", "lion"][Object.keys(U).indexOf(k)]]);
  }
  await db.query("insert into user_roles values ($1,'founder')", [U.fay]);
  await db.exec(fs.readFileSync(path.join(SUPA, "migration_group_timer.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(SUPA, "migration_group_timer_v2.sql"), "utf8"));
  await db.exec("grant all on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated");

  const asUser = (uid, fn) => exclusive(async () => {
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid || ""]);
    try { return await fn(); } finally { await db.exec("reset role"); }
  });

  const handlers = {
    async rpc({ name, args = {}, uid }) {
      if (!IDENT.test(name)) return { error: { message: "bad name" } };
      const keys = Object.keys(args).filter((k) => IDENT.test(k));
      const sql = `select * from ${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")})`;
      try {
        const r = await asUser(uid, () => db.query(sql, keys.map((k) => args[k])));
        if (ARRAY.has(name)) return { data: r.rows };
        if (SCALAR.has(name)) return { data: r.rows[0]?.[name] ?? null };
        if (OBJECT.has(name)) return { data: r.rows[0] ?? null };
        return { data: null };
      } catch (e) {
        const missing = /does not exist/.test(e.message) && /function/.test(e.message);
        return { error: { message: e.message.replace(/^error: /i, ""), ...(missing ? { code: "PGRST202" } : {}) } };
      }
    },
    async select({ table, cols = "*", eq = {}, count = false, head = false, uid }) {
      if (!IDENT.test(table)) return { error: { message: "bad table" } };
      const colList = cols.split(",").map((c) => c.trim()).filter((c) => IDENT.test(c) || c === "*");
      const where = Object.keys(eq).filter((k) => IDENT.test(k));
      const sql = `select ${count && head ? "count(*)::int as n" : colList.join(",")} from ${table}${where.length ? " where " + where.map((k, i) => `${k} = $${i + 1}`).join(" and ") : ""}`;
      try {
        const r = await asUser(uid, () => db.query(sql, where.map((k) => eq[k])));
        return count && head ? { count: r.rows[0].n, data: null } : { data: r.rows };
      } catch (e) { return { error: { message: e.message } }; }
    },
    async insert({ table, row, uid }) {
      if (table !== "timer_sessions") return { error: { message: "unsupported" } };
      const r = await exclusive(() => db.query(
        "insert into timer_sessions(user_id, mode, planned_minutes, actual_minutes, completed, created_at) values ($1,$2,$3,$4,$5, coalesce($6::timestamptz, now())) returning *",
        [uid, row.mode, row.planned_minutes, row.actual_minutes, row.completed ?? true, row.created_at || null]));
      return { data: r.rows[0] };
    },
    async delete({ table, id, uid }) {
      if (table !== "timer_sessions") return { error: { message: "unsupported" } };
      await exclusive(() => db.query("delete from timer_sessions where id=$1 and user_id=$2", [id, uid]));
      return { data: null };
    },
    // test-only: arbitrary SQL as superuser (seeding / assertions)
    async sql({ sql, params = [] }) {
      const r = await exclusive(() => db.query(sql, params));
      return { data: r.rows };
    },
  };

  const server = http.createServer(async (req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "content-type");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    let body = "";
    for await (const c of req) body += c;
    const route = req.url.replace(/^\//, "");
    try {
      const out = handlers[route] ? await handlers[route](JSON.parse(body || "{}")) : { error: { message: "no route" } };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: String(e.message || e) } }));
    }
  });

  // ---- realtime hub: presence + broadcast per topic ----
  const rooms = new Map(); // topic -> Set(conn)
  const wss = new WebSocketServer({ server, path: "/rt" });
  const pushPresence = (topic) => {
    const conns = rooms.get(topic) || new Set();
    const state = {};
    conns.forEach((c) => { if (c.meta) (state[c.key] ||= []).push({ ...c.meta, presence_ref: c.id }); });
    conns.forEach((c) => c.ws.readyState === 1 && c.ws.send(JSON.stringify({ op: "presence", state })));
  };
  let nextId = 1;
  wss.on("connection", (ws) => {
    const conn = { ws, id: String(nextId++), topic: null, key: null, meta: null };
    ws.on("message", (raw) => {
      const m = JSON.parse(raw);
      if (m.op === "join") {
        conn.topic = m.topic; conn.key = m.key || conn.id;
        if (!rooms.has(m.topic)) rooms.set(m.topic, new Set());
        rooms.get(m.topic).add(conn);
        ws.send(JSON.stringify({ op: "joined" }));
        pushPresence(m.topic);
      } else if (m.op === "track") { conn.meta = m.payload; pushPresence(conn.topic); }
      else if (m.op === "untrack") { conn.meta = null; pushPresence(conn.topic); }
      else if (m.op === "send") {
        (rooms.get(conn.topic) || new Set()).forEach((c) => { if (c !== conn && c.ws.readyState === 1) c.ws.send(JSON.stringify({ op: "broadcast", event: m.event, payload: m.payload })); });
      }
    });
    ws.on("close", () => {
      if (!conn.topic) return;
      rooms.get(conn.topic)?.delete(conn);
      pushPresence(conn.topic);
    });
  });

  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return {
    port,
    sql: (sql, params) => handlers.sql({ sql, params }).then((r) => r.data),
    close: async () => { wss.clients.forEach((c) => c.terminate()); await new Promise((r) => server.close(r)); },
  };
}
