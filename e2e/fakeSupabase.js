// Browser-side stand-in for src/lib/supabaseClient.js during the e2e run (swapped in by the
// vite plugin in run.mjs). Same surface the Group Timer code uses: rpc, from().select().eq(),
// channel() with presence + broadcast, removeChannel. Talks to e2e/server.mjs.
const API = window.__E2E_API || "http://127.0.0.1:8787";
const WS_URL = API.replace(/^http/, "ws") + "/rt";
const uid = new URLSearchParams(location.search).get("u");

export const post = async (route, body) => {
  const r = await fetch(`${API}/${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, uid }) });
  return r.json();
};

class Builder {
  constructor(table) { this.q = { table, cols: "*", eq: {}, count: false, head: false }; }
  select(cols, opts = {}) { this.q.cols = cols || "*"; this.q.count = opts.count === "exact"; this.q.head = !!opts.head; return this; }
  eq(col, val) { this.q.eq[col] = val; return this; }
  async maybeSingle() { const r = await post("select", this.q); return r.error ? { data: null, error: r.error } : { data: r.data[0] || null, error: null }; }
  then(resolve, reject) { return post("select", this.q).then((r) => (r.error ? { data: null, count: null, error: r.error } : { data: r.data, count: r.count ?? null, error: null })).then(resolve, reject); }
}

class FakeChannel {
  constructor(topic, opts) { this.topic = topic; this.key = opts?.config?.presence?.key; this.handlers = []; this.state = "closed"; this._state = {}; }
  on(type, filter, cb) { this.handlers.push({ type, event: filter?.event, cb }); return this; }
  subscribe(cb) {
    this.ws = new WebSocket(WS_URL);
    this.ws.onopen = () => this.ws.send(JSON.stringify({ op: "join", topic: this.topic, key: this.key }));
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.op === "joined") { this.state = "joined"; cb?.("SUBSCRIBED"); }
      else if (m.op === "presence") { this._state = m.state; this.handlers.filter((h) => h.type === "presence").forEach((h) => h.cb()); }
      else if (m.op === "broadcast") this.handlers.filter((h) => h.type === "broadcast" && h.event === m.event).forEach((h) => h.cb({ payload: m.payload }));
    };
    this.ws.onclose = () => { this.state = "closed"; cb?.("CLOSED"); };
    return this;
  }
  track(payload) { this.ws?.readyState === 1 && this.ws.send(JSON.stringify({ op: "track", payload })); return Promise.resolve("ok"); }
  send(msg) { if (msg.type === "broadcast" && this.ws?.readyState === 1) this.ws.send(JSON.stringify({ op: "send", event: msg.event, payload: msg.payload })); return Promise.resolve("ok"); }
  presenceState() { return this._state; }
  _close() { try { this.ws?.close(); } catch { /* already closed */ } }
}

export const supabase = {
  rpc: (name, args) => post("rpc", { name, args: args || {} }),
  from: (table) => new Builder(table),
  channel: (topic, opts) => new FakeChannel(topic, opts),
  removeChannel: async (ch) => { ch._close(); return "ok"; },
};
export const isSupabaseConfigured = true;
