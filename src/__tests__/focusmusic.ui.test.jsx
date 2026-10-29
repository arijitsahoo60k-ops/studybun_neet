import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";

const db = vi.hoisted(() => ({ tables: {}, n: 0 }));
vi.mock("../lib/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("../data/syllabus", () => ({ weightageFor: () => 1 }));
vi.mock("../lib/supabaseClient", () => {
  const chan = { on: () => chan, subscribe: () => chan };
  const builder = (table) => {
    const st = { op: "select", filters: [], patch: null, maybe: false, limit: null };
    const run = () => {
      const rows = (db.tables[table] ||= []);
      const match = (r) => st.filters.every(([c, v]) => r[c] === v);
      if (st.op === "insert") { const row = { id: `id${++db.n}`, created_at: String(1000 + db.n), ...st.patch }; rows.push(row); return { data: row, error: null }; }
      if (st.op === "update") { const hit = rows.filter(match); hit.forEach((r) => Object.assign(r, st.patch)); return { data: hit[0] || null, error: hit.length ? null : { message: "x" } }; }
      if (st.op === "delete") { db.tables[table] = rows.filter((r) => !match(r)); return { error: null }; }
      let out = rows.filter(match).map((r) => ({ ...r }));
      if (st.limit) out = out.slice(0, st.limit);
      return st.maybe ? { data: out[0] || null, error: null } : { data: out, error: null };
    };
    const api = {
      select: () => api, eq: (c, v) => { st.filters.push([c, v]); return api; }, order: () => api, limit: (n) => { st.limit = n; return api; },
      insert: (p) => { st.op = "insert"; st.patch = p; return api; }, update: (p) => { st.op = "update"; st.patch = p; return api; },
      delete: () => { st.op = "delete"; return api; }, single: () => api, maybeSingle: () => { st.maybe = true; return api; },
      then: (res, rej) => Promise.resolve(run()).then(res, rej),
    };
    return api;
  };
  return { supabase: { channel: () => chan, removeChannel: () => {}, from: builder } };
});

import { useFocusMusic } from "../hooks/useFocusMusic";
import FocusMusicStage from "../components/FocusMusicStage";
import FocusMusicSettings, { FocusMusicMiniBar } from "../components/FocusMusicSettings";

function Harness({ running = false, startOpen = true }) {
  const music = useFocusMusic({ timerRunning: running, page: "timer" });
  const [open, setOpen] = React.useState(startOpen);
  return (
    <div>
      <FocusMusicStage music={music} />
      <FocusMusicMiniBar music={music} running={running} onOpenSettings={() => setOpen(true)} />
      {open && <FocusMusicSettings music={music} timerRunning={running} />}
      <button onClick={() => setOpen(false)}>close-settings</button>
    </div>
  );
}

beforeEach(() => {
  db.tables = { focus_playlists: [], focus_playlist_tracks: [], focus_music_settings: [] };
  db.n = 0;
  localStorage.clear();
  window.YT = undefined; // no player script in jsdom -- nothing should try to load one until asked
  global.fetch = vi.fn(async (url) => {
    const v = decodeURIComponent(String(url)).match(/v=([\w-]{11})/)[1];
    return { status: 200, ok: true, json: async () => ({ title: `Song ${v}`, author_name: "Someone" }) };
  });
});
afterEach(() => { delete window.YT; });

describe("Focus music settings UI", () => {
  it("the app / timer card alone never loads YouTube's player script (only a running timer or the settings preview does)", async () => {
    render(<Harness startOpen={false} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(document.querySelector('script[src*="youtube.com/iframe_api"]')).toBeNull();
  });

  it("switching the pill, building a playlist, adding and removing a track", async () => {
    render(<Harness />);
    const pill = await screen.findByRole("tablist", { name: "Music source" });
    expect(pill).toHaveAttribute("data-active", "stations");
    expect(screen.getByRole("button", { name: /Chillhop radio/ })).toBeInTheDocument();

    fireEvent.click(within(pill).getByRole("tab", { name: /My music/ }));
    expect(pill).toHaveAttribute("data-active", "own");
    expect(screen.getByText(/No playlists yet/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Create a playlist"));
    fireEvent.change(screen.getByPlaceholderText(/Playlist name/), { target: { value: "Night owl" } });
    fireEvent.click(screen.getByText("Create"));
    await screen.findByText("Night owl", { selector: ".sb-music-plname" });

    fireEvent.change(screen.getByPlaceholderText(/Paste a YouTube/), { target: { value: "https://youtu.be/aaaaaaaaaaa" } });
    fireEvent.click(screen.getByText("Add"));
    await screen.findByText("Song aaaaaaaaaaa");
    expect(screen.getByText("1/50 tracks", { exact: false })).toBeInTheDocument();

    // bad link -> friendly error, nothing added
    fireEvent.change(screen.getByPlaceholderText(/Paste a YouTube/), { target: { value: "nope" } });
    fireEvent.click(screen.getByText("Add"));
    await screen.findByText(/Couldn't read a video/);

    fireEvent.click(screen.getByLabelText(/Remove Song aaaaaaaaaaa/));
    await waitFor(() => expect(screen.queryByText("Song aaaaaaaaaaa")).not.toBeInTheDocument());

    fireEvent.click(within(pill).getByRole("tab", { name: /Stations/ }));
    expect(pill).toHaveAttribute("data-active", "stations");
    // choices were persisted to the account
    await waitFor(() => expect(db.tables.focus_music_settings[0].source).toBe("stations"));
  });

  it("the preview slot puts the player stage into the dialog, and closing settings releases it", async () => {
    render(<Harness />);
    const stage = document.querySelector(".sb-music-stage");
    await waitFor(() => expect(stage.classList.contains("in-slot")).toBe(true));
    fireEvent.click(screen.getByText("close-settings"));
    await waitFor(() => expect(stage.classList.contains("in-slot")).toBe(false));
  });

  it("the timer card shows nothing when music is off, and a 'starts with your timer' note when on", async () => {
    const { rerender } = render(<Harness />);
    await waitFor(() => expect(document.querySelector(".sb-music-mini-solo")).not.toBeInTheDocument());
    expect(screen.queryByText(/Set up focus music/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^On$|^Off$/ }));
    await waitFor(() => expect(screen.getByText(/plays when you start/)).toBeInTheDocument());
    rerender(<Harness running />);
    expect(screen.queryByText(/plays when you start/)).not.toBeInTheDocument();
  });
});
