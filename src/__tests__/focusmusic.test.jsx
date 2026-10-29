import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/* ---------- in-memory Supabase ---------- */
const db = vi.hoisted(() => ({ tables: {}, n: 0, reset() { this.tables = { focus_playlists: [], focus_playlist_tracks: [], focus_music_settings: [] }; this.n = 0; } }));

vi.mock("../lib/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("../data/syllabus", () => ({ weightageFor: () => 1 }));
vi.mock("../lib/supabaseClient", () => {
  const chan = { on: () => chan, subscribe: () => chan };
  const builder = (table) => {
    const st = { op: "select", filters: [], patch: null, single: false, maybe: false, order: null, limit: null };
    const run = () => {
      const rows = db.tables[table];
      const match = (r) => st.filters.every(([c, v]) => r[c] === v);
      const fkBad = (obj) => table === "focus_music_settings" && obj && obj.playlist_id
        && !db.tables.focus_playlists.some((pl) => pl.id === obj.playlist_id);
      if ((st.op === "insert" || st.op === "update") && fkBad(st.patch)) {
        return { data: null, error: { message: "violates foreign key constraint" } };
      }
      if (st.op === "insert") {
        const row = { id: `id${++db.n}`, created_at: new Date(1000 + db.n).toISOString(), ...st.patch };
        rows.push(row);
        return { data: row, error: null };
      }
      if (st.op === "update") {
        const hit = rows.filter(match);
        hit.forEach((r) => Object.assign(r, st.patch));
        return { data: hit[0] || null, error: hit.length ? null : { message: "no row" } };
      }
      if (st.op === "delete") {
        const gone = rows.filter(match).map((r) => r.id);
        db.tables[table] = rows.filter((r) => !match(r));
        if (table === "focus_playlists") db.tables.focus_playlist_tracks = db.tables.focus_playlist_tracks.filter((t) => !gone.includes(t.playlist_id)); // FK cascade
        return { error: null };
      }
      let out = rows.filter(match).map((r) => ({ ...r }));
      if (st.order) out.sort((a, b) => (a[st.order.col] - b[st.order.col]) * (st.order.asc ? 1 : -1));
      if (st.limit) out = out.slice(0, st.limit);
      if (st.maybe) return { data: out[0] || null, error: null };
      return { data: out, error: null };
    };
    const api = {
      select: () => api,
      eq: (c, v) => { st.filters.push([c, v]); return api; },
      order: (col, o) => { st.order = { col, asc: o?.ascending !== false }; return api; },
      limit: (n) => { st.limit = n; return api; },
      insert: (p) => { st.op = "insert"; st.patch = p; return api; },
      update: (p) => { st.op = "update"; st.patch = p; return api; },
      delete: () => { st.op = "delete"; return api; },
      single: () => api,
      maybeSingle: () => { st.maybe = true; return api; },
      then: (res, rej) => Promise.resolve(run()).then(res, rej),
    };
    return api;
  };
  return { supabase: { channel: () => chan, removeChannel: () => {}, from: builder } };
});

import { useFocusMusic } from "../hooks/useFocusMusic";

/* ---------- fake YouTube player ---------- */
class FakePlayer {
  static instances = [];
  constructor(el, opts) {
    this.el = el; this.opts = opts; this.calls = [];
    FakePlayer.instances.push(this);
    queueMicrotask(() => opts.events.onReady({ target: this }));
  }
  loadVideoById(a) { this.videoId = a.videoId; this.calls.push(["load", a.videoId, a.startSeconds]); }
  cueVideoById(a) { this.videoId = a.videoId; this.calls.push(["cue", a.videoId]); }
  playVideo() { this.calls.push(["play"]); }
  pauseVideo() { this.calls.push(["pause"]); }
  stopVideo() { this.calls.push(["stop"]); }
  seekTo() { this.calls.push(["seek"]); }
  setVolume() {}
  destroy() {}
  getCurrentTime() { return 42; }
  getDuration() { return 200; }
  getVideoData() { return { isLive: false, video_id: this.reportedId ?? this.videoId }; }
  emit(state) { this.opts.events.onStateChange({ data: state }); }
}
const last = () => FakePlayer.instances[FakePlayer.instances.length - 1];
const callNames = (p) => p.calls.map((c) => c[0]);

// In the app, FocusMusicStage hands the hook its DOM host; hook-only tests do it by hand.
const attach = (hook) => act(async () => { hook.result.current.attachHost(document.createElement("div")); });

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  db.reset();
  localStorage.clear();
  FakePlayer.instances = [];
  window.YT = { Player: FakePlayer };
  global.fetch = vi.fn(async (url) => {
    const v = decodeURIComponent(String(url)).match(/v=([\w-]{11})/)[1];
    return { status: 200, ok: true, json: async () => ({ title: `Title ${v}`, author_name: "Author" }) };
  });
});
afterEach(() => { delete window.YT; vi.useRealTimers(); });

const A = "aaaaaaaaaaa";
const B = "bbbbbbbbbbb";
const C = "ccccccccccc";

async function mountWithPlaylist(props) {
  const hook = renderHook((p) => useFocusMusic(p), { initialProps: props });
  await attach(hook);
  await waitFor(() => expect(hook.result.current.rowLoaded).toBe(true));
  let res;
  await act(async () => { res = await hook.result.current.createPlaylist("Deep focus"); });
  expect(res.ok).toBe(true);
  for (const id of [A, B, C]) {
    await act(async () => { res = await hook.result.current.addTrack(hook.result.current.playlists[0].id, id); });
    expect(res.ok).toBe(true);
  }
  await act(async () => { hook.result.current.setEnabled(true); });
  return hook;
}

describe("Focus music — never plays on its own", () => {
  it("a saved custom link from the OLD radio does not start playing when the app opens", async () => {
    // exactly the reported bug: something is in the old "Custom link" box
    localStorage.setItem("sb.focusTimer.v1", JSON.stringify({ radioChoice: "custom", radioCustomUrl: `https://youtu.be/${A}`, running: false }));
    const hk = renderHook(() => useFocusMusic({ timerRunning: false, page: "timer" }));
    const { result } = hk;
    await attach(hk);
    await waitFor(() => expect(result.current.rowLoaded).toBe(true));
    await flush();
    expect(result.current.enabled).toBe(true); // choice was carried over...
    expect(result.current.wantPlay).toBe(false); // ...but it is silent
    expect(FakePlayer.instances).toHaveLength(0); // player isn't even created
  });

  it("the legacy custom link is migrated into a playlist once", async () => {
    localStorage.setItem("sb.focusTimer.v1", JSON.stringify({ radioChoice: "custom", radioCustomUrl: `https://youtu.be/${A}` }));
    const { result } = renderHook(() => useFocusMusic({ timerRunning: false, page: "timer" }));
    await waitFor(() => expect(result.current.playlists[0]?.tracks).toHaveLength(1));
    expect(result.current.playlists[0].name).toBe("My music");
    expect(result.current.playlists[0].tracks[0].video_id).toBe(A);
    expect(result.current.source).toBe("own");
    expect(db.tables.focus_playlists).toHaveLength(1);
  });

  it("a legacy station choice is kept, and stays silent until the timer runs", async () => {
    localStorage.setItem("sb.focusTimer.v1", JSON.stringify({ radioChoice: "lofi-24-7" }));
    const hk = renderHook(() => useFocusMusic({ timerRunning: false, page: "dashboard" }));
    const { result } = hk;
    await attach(hk);
    expect(result.current.enabled).toBe(true);
    expect(result.current.stationId).toBe("lofi-24-7");
    await flush();
    expect(FakePlayer.instances).toHaveLength(0);
  });
});

describe("Focus music — follows the timer", () => {
  it("plays on start, pauses on pause, resumes on start", async () => {
    const hook = await mountWithPlaylist({ timerRunning: false, page: "timer" });
    await flush();
    expect(FakePlayer.instances).toHaveLength(0); // enabled + tracks, but timer idle => nothing

    hook.rerender({ timerRunning: true, page: "timer" });
    await waitFor(() => expect(FakePlayer.instances).toHaveLength(1));
    await waitFor(() => expect(callNames(last())).toContain("load"));
    expect(last().calls.find((c) => c[0] === "load")[1]).toBe(A);
    await act(async () => last().emit(1));
    expect(hook.result.current.audible).toBe(true);

    hook.rerender({ timerRunning: false, page: "timer" });
    await waitFor(() => expect(callNames(last())).toContain("pause"));
    await act(async () => last().emit(2));
    expect(hook.result.current.audible).toBe(false);

    const before = last().calls.length;
    hook.rerender({ timerRunning: true, page: "timer" });
    await waitFor(() => expect(last().calls.slice(before).map((c) => c[0])).toContain("play"));
  });

  it("does not play when the timer runs but music is switched off", async () => {
    const hook = await mountWithPlaylist({ timerRunning: false, page: "timer" });
    await act(async () => { hook.result.current.setEnabled(false); });
    hook.rerender({ timerRunning: true, page: "timer" });
    await flush();
    expect(hook.result.current.wantPlay).toBe(false);
    expect(FakePlayer.instances.every((p) => !callNames(p).includes("load"))).toBe(true);
  });

  it("autoplays the playlist one track after another, wrapping with loop on", async () => {
    const hook = await mountWithPlaylist({ timerRunning: true, page: "timer" });
    await waitFor(() => expect(FakePlayer.instances).toHaveLength(1));
    const p = last();
    await waitFor(() => expect(p.calls.filter((c) => c[0] === "load")).toHaveLength(1));
    const loads = () => p.calls.filter((c) => c[0] === "load").map((c) => c[1]);
    expect(loads()).toEqual([A]);
    await act(async () => p.emit(0)); // A ended
    await waitFor(() => expect(loads()).toEqual([A, B]));
    await act(async () => p.emit(0));
    await waitFor(() => expect(loads()).toEqual([A, B, C]));
    await act(async () => p.emit(0)); // last one -> loop back to A
    await waitFor(() => expect(loads()).toEqual([A, B, C, A]));
  });

  it("with loop off, the playlist stops after the last track", async () => {
    const hook = await mountWithPlaylist({ timerRunning: true, page: "timer" });
    await act(async () => { hook.result.current.setLoop(false); });
    await waitFor(() => expect(FakePlayer.instances).toHaveLength(1));
    const p = last();
    await act(async () => hook.result.current.playTrack(hook.result.current.playlists[0].tracks[2].id));
    await waitFor(() => expect(p.calls.filter((c) => c[0] === "load").map((c) => c[1])).toContain(C));
    await act(async () => p.emit(0));
    expect(hook.result.current.status).toBe("ended");
  });

  it("skips a track that can't be embedded and keeps going", async () => {
    const hook = await mountWithPlaylist({ timerRunning: true, page: "timer" });
    await waitFor(() => expect(FakePlayer.instances).toHaveLength(1));
    const p = last();
    await waitFor(() => expect(p.calls.some((c) => c[0] === "load")).toBe(true));
    await act(async () => p.opts.events.onError({ data: 150 }));
    await waitFor(() => expect(p.calls.filter((c) => c[0] === "load").map((c) => c[1])).toEqual([A, B]));
    expect(hook.result.current.notice).toMatch(/Skipped/);
  });
});

describe("Focus music — survives a reload", () => {
  it("reloading mid-session (timer already running) resumes the same track and offset", async () => {
    const first = await mountWithPlaylist({ timerRunning: true, page: "timer" });
    await waitFor(() => expect(FakePlayer.instances).toHaveLength(1));
    const p1 = last();
    await waitFor(() => expect(p1.calls.some((c) => c[0] === "load")).toBe(true));
    await act(async () => p1.emit(0)); // move on to B
    await waitFor(() => expect(p1.calls.filter((c) => c[0] === "load")).toHaveLength(2));
    await act(async () => p1.emit(1)); // B playing -> status effect persists position
    first.unmount(); // "reload": all in-memory state gone, localStorage + DB remain

    FakePlayer.instances = [];
    const second = renderHook(() => useFocusMusic({ timerRunning: true, page: "dashboard" }));
    await attach(second);
    await waitFor(() => expect(FakePlayer.instances).toHaveLength(1));
    const p2 = last();
    await waitFor(() => expect(p2.calls.some((c) => c[0] === "load")).toBe(true));
    const load = p2.calls.find((c) => c[0] === "load");
    expect(load[1]).toBe(B);
    expect(load[2]).toBe(42); // saved offset
    expect(second.result.current.enabled).toBe(true);
    expect(second.result.current.source).toBe("own");
  });

  it("if the browser blocks autoplay after a reload, it flags it and the next tap resumes", async () => {
    await mountWithPlaylist({ timerRunning: false, page: "timer" });
    FakePlayer.instances = [];
    const hook = renderHook(() => useFocusMusic({ timerRunning: true, page: "dashboard" }));
    await attach(hook);
    await waitFor(() => expect(FakePlayer.instances).toHaveLength(1));
    const p = last();
    await waitFor(() => expect(p.calls.some((c) => c[0] === "load")).toBe(true));
    await act(async () => p.opts.events.onAutoplayBlocked());
    expect(hook.result.current.status).toBe("blocked");
    const before = p.calls.length;
    await act(async () => { window.dispatchEvent(new Event("click")); });
    expect(p.calls.slice(before).map((c) => c[0])).toContain("play");
    await act(async () => p.emit(1));
    expect(hook.result.current.status).toBe("playing");
  });

  it("tapping while the timer is NOT running does not start music", async () => {
    const hook = await mountWithPlaylist({ timerRunning: true, page: "timer" });
    await waitFor(() => expect(FakePlayer.instances).toHaveLength(1));
    const p = last();
    await waitFor(() => expect(p.calls.some((c) => c[0] === "load")).toBe(true));
    await act(async () => p.opts.events.onAutoplayBlocked());
    hook.rerender({ timerRunning: false, page: "timer" });
    await flush();
    const before = p.calls.length;
    await act(async () => { window.dispatchEvent(new Event("click")); });
    expect(p.calls.slice(before).map((c) => c[0])).not.toContain("play");
  });
});

describe("Focus music — playlists in Supabase", () => {
  it("creates, dedupes, reorders, removes and deletes; selection is saved to the settings row", async () => {
    const hook = await mountWithPlaylist({ timerRunning: false, page: "timer" });
    const pl = () => hook.result.current.playlists[0];
    expect(pl().tracks.map((t) => t.video_id)).toEqual([A, B, C]);
    expect(pl().tracks[0].title).toBe(`Title ${A}`);
    expect(db.tables.focus_playlist_tracks).toHaveLength(3);

    let res;
    await act(async () => { res = await hook.result.current.addTrack(pl().id, `https://youtu.be/${A}`); });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/already/);
    await act(async () => { res = await hook.result.current.addTrack(pl().id, "https://www.youtube.com/playlist?list=PL123"); });
    expect(res.error).toMatch(/whole-playlist/);
    await act(async () => { res = await hook.result.current.addTrack(pl().id, "not a link"); });
    expect(res.ok).toBe(false);

    await act(async () => { await hook.result.current.moveTrack(pl().id, pl().tracks[0].id, 1); });
    expect(pl().tracks.map((t) => t.video_id)).toEqual([B, A, C]);
    expect(db.tables.focus_playlist_tracks.map((t) => [t.video_id, t.sort_order]).sort((x, y) => x[1] - y[1]).map((x) => x[0])).toEqual([B, A, C]);

    await act(async () => { await hook.result.current.removeTrack(pl().tracks[1].id); });
    expect(pl().tracks.map((t) => t.video_id)).toEqual([B, C]);

    const row = db.tables.focus_music_settings[0];
    expect(row.enabled).toBe(true);
    expect(row.source).toBe("own");
    expect(row.playlist_id).toBe(pl().id);

    await act(async () => { res = await hook.result.current.createPlaylist("deep FOCUS"); });
    expect(res.error).toMatch(/already/);

    await act(async () => { await hook.result.current.deletePlaylist(pl().id); });
    expect(hook.result.current.playlists).toHaveLength(0);
    expect(db.tables.focus_playlist_tracks).toHaveLength(0); // cascade
    expect(hook.result.current.hasQueue).toBe(false);
  });

  it("rejects videos YouTube says can't be embedded", async () => {
    const hook = await mountWithPlaylist({ timerRunning: false, page: "timer" });
    global.fetch = vi.fn(async () => ({ status: 401, ok: false, json: async () => ({}) }));
    let res;
    await act(async () => { res = await hook.result.current.addTrack(hook.result.current.playlists[0].id, "zzzzzzzzzzz"); });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/outside YouTube/);
  });
});

describe("Focus music — regressions found in review", () => {
  it("switching to another playlist starts from ITS first track (not the old track's slot)", async () => {
    const hook = await mountWithPlaylist({ timerRunning: true, page: "timer" });
    await waitFor(() => expect(FakePlayer.instances).toHaveLength(1));
    const p = last();
    await waitFor(() => expect(p.calls.some((c) => c[0] === "load")).toBe(true));
    const firstPlaylist = hook.result.current.playlists[0].id;

    // build a second playlist (creating it selects it) with 3 tracks
    let res;
    await act(async () => { res = await hook.result.current.createPlaylist("Second"); });
    const second = res.playlist.id;
    for (const id of ["ddddddddddd", "eeeeeeeeeee", "fffffffffff"]) {
      await act(async () => { await hook.result.current.addTrack(second, id); });
    }
    await waitFor(() => expect(hook.result.current.queueItems).toHaveLength(3));
    // listen to its 3rd track, then flip back to the first playlist
    const third = hook.result.current.queueItems[2].id;
    await act(async () => hook.result.current.playTrack(third));
    await waitFor(() => expect(hook.result.current.currentId).toBe(third));
    await act(async () => hook.result.current.selectPlaylist(firstPlaylist));
    await waitFor(() => expect(hook.result.current.queueItems).toHaveLength(3));
    await waitFor(() => expect(hook.result.current.currentItem?.videoId).toBe(A)); // its FIRST track, not slot #3
  });

  it("'pause music' while running does not stay muted forever after a pause/start cycle", async () => {
    const hook = await mountWithPlaylist({ timerRunning: true, page: "timer" });
    await waitFor(() => expect(FakePlayer.instances).toHaveLength(1));
    const p = last();
    await waitFor(() => expect(p.calls.some((c) => c[0] === "load")).toBe(true));
    await act(async () => p.emit(1));

    await act(async () => hook.result.current.togglePlay()); // person mutes the music
    expect(hook.result.current.wantPlay).toBe(false);
    await waitFor(() => expect(callNames(p)).toContain("pause"));

    hook.rerender({ timerRunning: false, page: "timer" });
    hook.rerender({ timerRunning: true, page: "timer" });
    await waitFor(() => expect(hook.result.current.wantPlay).toBe(true));
    await waitFor(() => expect(callNames(p).lastIndexOf("play")).toBeGreaterThan(callNames(p).lastIndexOf("pause")));
  });

  it("a playlist deleted on ANOTHER device can't make later saves fail against the foreign key", async () => {
    const hk = renderHook(() => useFocusMusic({ timerRunning: false, page: "timer" }));
    await attach(hk);
    await waitFor(() => expect(hk.result.current.rowLoaded).toBe(true));
    let res;
    await act(async () => { res = await hk.result.current.createPlaylist("Temp"); }); // selects it
    await waitFor(() => expect(db.tables.focus_music_settings[0]?.playlist_id).toBe(res.playlist.id));
    // another device deletes it: DB nulls the FK, this session still remembers the old id
    db.tables.focus_playlists = [];
    db.tables.focus_music_settings[0].playlist_id = null;
    await act(async () => { hk.result.current.setEnabled(true); });
    await waitFor(() => expect(db.tables.focus_music_settings[0].enabled).toBe(true));
  });

  it("changes made before the settings row finished loading are kept and saved", async () => {
    const hk = renderHook(() => useFocusMusic({ timerRunning: false, page: "timer" }));
    await attach(hk);
    await act(async () => { hk.result.current.setEnabled(true); hk.result.current.setStation("lofi-24-7"); }); // row not loaded yet
    await waitFor(() => expect(db.tables.focus_music_settings[0]?.enabled).toBe(true));
    await waitFor(() => expect(db.tables.focus_music_settings[0].station_id).toBe("lofi-24-7"));
    expect(hk.result.current.stationId).toBe("lofi-24-7");
  });

  it("never records a resume position taken from a different video than the one loaded", async () => {
    const hook = await mountWithPlaylist({ timerRunning: true, page: "timer" });
    await waitFor(() => expect(FakePlayer.instances).toHaveLength(1));
    const p = last();
    await waitFor(() => expect(p.calls.some((c) => c[0] === "load")).toBe(true));
    localStorage.removeItem("sb.focusMusic.resume.v1");
    p.reportedId = "zzzzzzzzzzz"; // player is momentarily on some other video
    await act(async () => p.emit(1));
    expect(localStorage.getItem("sb.focusMusic.resume.v1")).toBeNull();
    p.reportedId = undefined;
    await act(async () => p.emit(2));
    await act(async () => p.emit(1));
    expect(JSON.parse(localStorage.getItem("sb.focusMusic.resume.v1")).itemId).toBe(hook.result.current.currentId);
  });

  it("a track that was basically finished restarts from 0 after a reload instead of the last second", async () => {
    const first = await mountWithPlaylist({ timerRunning: true, page: "timer" });
    await waitFor(() => expect(FakePlayer.instances).toHaveLength(1));
    const p1 = last();
    await waitFor(() => expect(p1.calls.some((c) => c[0] === "load")).toBe(true));
    p1.getCurrentTime = () => 199;
    await act(async () => p1.emit(1));
    first.unmount();
    FakePlayer.instances = [];
    const second = renderHook(() => useFocusMusic({ timerRunning: true, page: "dashboard" }));
    await attach(second);
    await waitFor(() => expect(FakePlayer.instances).toHaveLength(1));
    await waitFor(() => expect(last().calls.some((c) => c[0] === "load")).toBe(true));
    expect(last().calls.find((c) => c[0] === "load")[2]).toBeUndefined();
  });

  it("under React StrictMode (dev double-effects) still builds exactly one player", async () => {
    const wrapper = ({ children }) => <React.StrictMode>{children}</React.StrictMode>;
    const hk = renderHook(() => useFocusMusic({ timerRunning: true, page: "timer" }), { wrapper });
    await attach(hk);
    await act(async () => { hk.result.current.setEnabled(true); });
    await waitFor(() => expect(FakePlayer.instances.length).toBeGreaterThanOrEqual(1));
    await flush();
    expect(FakePlayer.instances).toHaveLength(1);
  });
});
