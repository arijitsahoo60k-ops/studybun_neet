import React from "react";
import fs from "fs";
import path from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, render, screen, fireEvent, act, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ channels: [], rpcs: [], roster: [], stats: null, group: { id: "g1", name: "G", is_public: false, join_code: "ABC234", focus_lock: false } }));
vi.mock("../lib/supabaseClient", () => {
  const makeChannel = (topic) => {
    const ch = {
      topic, state: "joined", handlers: {}, tracked: [], sent: [], state_: {},
      on(_t, f, cb) { ch.handlers[f.event] = cb; return ch; },
      subscribe(cb) { cb("SUBSCRIBED"); return ch; },
      track: async (p) => { ch.tracked.push(p); },
      send: async (m) => { ch.sent.push(m); },
      presenceState: () => ch.state_,
    };
    h.channels.push(ch);
    return ch;
  };
  return {
    supabase: {
      channel: makeChannel,
      removeChannel: async () => "ok",
      rpc: async (name, args) => {
        h.rpcs.push([name, args]);
        if (name === "gt_server_time") return { data: Date.now(), error: null };
        if (name === "gt_group_roster") return { data: h.roster, error: null };
        if (name === "gt_group_stats") return { data: h.stats, error: null };
        if (name === "gt_group_bans") return { data: [], error: null };
        if (name === "get_community_profiles") return { data: [], error: null };
        return { data: null, error: null };
      },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.group }) }) }) }),
    },
  };
});
vi.mock("../lib/communityProfiles", () => ({
  fetchProfilesByIds: async (ids) => new Map(ids.map((id) => [id, { name: `Name-${id}`, mascot: "bunny" }])),
}));

import { useGroupTimerRoom } from "../hooks/useGroupTimerRoom";
import { GroupStatsCard, GroupRecapCard } from "../components/groupTimer/GroupStats";
import { GroupRosterDialog } from "../components/groupTimer/GroupHost";
import { GT_RULES, GT_LIMITS } from "../lib/groupTimer";

const timer = (o = {}) => ({ running: false, askDone: false, sessionActive: false, mode: "Pomodoro", elapsedSeconds: 0, total: 1500, ...o });
const tick = () => act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });

beforeEach(() => {
  h.channels.length = 0; h.rpcs.length = 0; localStorage.clear();
  h.group = { id: "g1", name: "G", is_public: false, join_code: "ABC234", focus_lock: false };
  h.roster = [
    { user_id: "me", is_host: true, joined_at: "2026-01-01", last_studied_at: null },
    { user_id: "u2", is_host: false, joined_at: "2026-01-02", last_studied_at: "2026-01-02T10:00:00Z" },
  ];
});

async function enter(t = timer(), extra = {}) {
  const hook = renderHook((p) => useGroupTimerRoom({ timer: p.t, userId: "me", notify: p.notify }), { initialProps: { t, notify: vi.fn(), ...extra } });
  await tick();
  act(() => hook.result.current.enterRoom({ id: "g1", name: "G", is_public: false, focus_lock: false }));
  await tick();
  return { ...hook, ch: h.channels[0] };
}

describe("room events (broadcast)", () => {
  it("only shows people the SERVER lists as members (spoofed presence is hidden)", async () => {
    const { result, ch } = await enter();
    ch.state_ = { u2: [{ phase: "studying", sentAt: 1, tab: "a" }], intruder: [{ phase: "studying", sentAt: 1, tab: "b" }] };
    act(() => ch.handlers.sync());
    expect(result.current.members.map((m) => m.userId)).toEqual(["u2"]);
  });

  it("accepts a cheer from a present member and ignores one from a stranger", async () => {
    const notify = vi.fn();
    const { result, ch } = await enter(timer(), { notify });
    ch.state_ = { u2: [{ phase: "studying", sentAt: 1, tab: "a" }] };
    act(() => ch.handlers.sync());
    act(() => ch.handlers.gt({ payload: { type: "cheer", from: "u2", to: "me", emoji: "🔥" } }));
    expect(result.current.feed[0]).toMatchObject({ type: "cheer", from: "u2", emoji: "🔥" });
    act(() => ch.handlers.gt({ payload: { type: "cheer", from: "intruder", to: null, emoji: "👏" } }));
    expect(result.current.feed).toHaveLength(1);
    act(() => ch.handlers.gt({ payload: { type: "cheer", from: "u2", to: null, emoji: "💩" } })); // not in the whitelist
    expect(result.current.feed).toHaveLength(1);
  });

  it("focus lock silences cheers and nudges but not goal results", async () => {
    h.group = { ...h.group, focus_lock: true };
    const { result, ch } = await enter();
    ch.state_ = { u2: [{ phase: "studying", sentAt: 1, tab: "a" }] };
    act(() => ch.handlers.sync());
    act(() => ch.handlers.gt({ payload: { type: "cheer", from: "u2", to: "me", emoji: "🔥" } }));
    expect(result.current.feed).toHaveLength(0);
    expect(result.current.cheer("u2", "🔥")).toMatchObject({ ok: false, reason: "locked" });
    act(() => ch.handlers.gt({ payload: { type: "goal", from: "u2", goal: "20 PYQs", done: true, minutes: 42 } }));
    expect(result.current.feed[0]).toMatchObject({ type: "goal", done: true });
  });

  it("sending a cheer broadcasts it, and is rate limited", async () => {
    const { result, ch } = await enter();
    let r; act(() => { r = result.current.cheer("u2", "🔥"); });
    expect(r.ok).toBe(true);
    expect(ch.sent.at(-1).payload).toMatchObject({ type: "cheer", to: "u2", emoji: "🔥", from: "me" });
    act(() => { r = result.current.cheer("u2", "👏"); });
    expect(r).toMatchObject({ ok: false, reason: "slow" });
  });

  it("nudge only after 5+ min paused, once per person per 10 min; receiver must itself be paused", async () => {
    const { result, ch } = await enter();
    const fresh = { userId: "u2", phase: "paused", since: Date.now() - 60_000 };
    const old = { userId: "u2", phase: "paused", since: Date.now() - 6 * 60_000 };
    expect(result.current.canNudge(fresh)).toBe(false);
    expect(result.current.canNudge(old)).toBe(true);
    let r; act(() => { r = result.current.nudge(old); });
    expect(r.ok).toBe(true);
    expect(ch.sent.at(-1).payload).toMatchObject({ type: "nudge", to: "u2" });
    expect(result.current.canNudge(old)).toBe(false); // cooldown

    // receiving: I'm idle -> ignored
    ch.state_ = { u2: [{ phase: "studying", sentAt: 1, tab: "a" }] };
    act(() => ch.handlers.sync());
    act(() => ch.handlers.gt({ payload: { type: "nudge", from: "u2", to: "me" } }));
    expect(result.current.feed.some((f) => f.type === "nudge" && f.from === "u2")).toBe(false);
  });

  it("a paused user receives a nudge (and a toast)", async () => {
    const notify = vi.fn();
    const { result, ch } = await enter(timer({ sessionActive: true, running: false }), { notify });
    ch.state_ = { u2: [{ phase: "studying", sentAt: 1, tab: "a" }] };
    act(() => ch.handlers.sync());
    act(() => ch.handlers.gt({ payload: { type: "nudge", from: "u2", to: "me" } }));
    await tick();
    expect(result.current.feed[0]).toMatchObject({ type: "nudge", from: "u2" });
    expect(notify).toHaveBeenCalled();
  });

  it("goal result is broadcast, shown locally, and clears the goal", async () => {
    const { result, ch } = await enter(timer({ sessionActive: true, askDone: true, elapsedSeconds: 1500 }));
    act(() => result.current.setGoal("20 PYQs on Rotation"));
    act(() => result.current.reportGoal(true));
    expect(ch.sent.at(-1).payload).toMatchObject({ type: "goal", goal: "20 PYQs on Rotation", done: true, minutes: 25 });
    expect(result.current.feed[0]).toMatchObject({ type: "goal", from: "me", done: true });
    expect(result.current.goal).toBe("");
  });

  it("announces the declared goal and the phase start in presence", async () => {
    const { result, rerender, ch } = await enter();
    act(() => result.current.setGoal("Finish ch 4"));
    await act(async () => { await new Promise((r) => setTimeout(r, 800)); });
    expect(ch.tracked.at(-1).goal).toBe("Finish ch 4");
    rerender({ t: timer({ sessionActive: true, running: false }), notify: vi.fn() });
    await tick();
    expect(ch.tracked.at(-1)).toMatchObject({ phase: "paused" });
    expect(ch.tracked.at(-1).since).toBeGreaterThan(0);
  });

  it("leaves the room when the server says I'm no longer a member", async () => {
    const { result } = await enter();
    const sb = (await import("../lib/supabaseClient")).supabase;
    const orig = sb.rpc;
    sb.rpc = async (name, a) => (name === "gt_group_roster" ? { data: null, error: { message: "You are not a member of this group." } } : orig(name, a));
    await act(async () => { await result.current.refreshRoster(true); });
    sb.rpc = orig;
    expect(result.current.activeGroup).toBeNull();
    expect(result.current.notice).toMatch(/no longer/);
  });
});

describe("room stats UI", () => {
  const stats = (o = {}) => ({
    rule_version: "v1", range: "week", from: "2026-10-12", to: "2026-10-18",
    total_minutes: 754, total_sessions: 9, active_members: 2, members_count: 3, goal_hours: 20, streak_days: 4,
    board: [
      { user_id: "me", minutes: 400, sessions: 5, rank: 1 },
      { user_id: "u2", minutes: 354, sessions: 4, rank: 2 },
      { user_id: "u3", minutes: 0, sessions: 0, rank: 3 },
    ],
    daily: [{ date: "2026-10-12", minutes: 300 }, { date: "2026-10-14", minutes: 454 }],
    ...o,
  });

  it("shows totals, goal progress, streak and ranked board", async () => {
    h.stats = stats();
    render(<GroupStatsCard groupId="g1" goalHours={20} isHost userId="me" refreshToken="0-0" />);
    await waitFor(() => expect(screen.getByText("12h 34m")).toBeInTheDocument());
    expect(screen.getByText(/Weekly goal · 20h/)).toBeInTheDocument();
    expect(screen.getByText("62%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /Weekly room goal/ })).toHaveAttribute("aria-valuenow", "62");
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByLabelText("Rank 1")).toBeInTheDocument();
    expect(screen.getByText("6h 40m")).toBeInTheDocument();
  });

  it("explains exactly how hours are counted", async () => {
    h.stats = stats();
    render(<GroupStatsCard groupId="g1" goalHours={20} isHost userId="me" refreshToken="0-0" />);
    await waitFor(() => screen.getByText("12h 34m"));
    fireEvent.click(screen.getByText(/How is this counted/));
    expect(screen.getByText(/How are hours counted\?/)).toBeInTheDocument();
    GT_RULES.forEach((r) => expect(screen.getByText(r.title + ".")).toBeInTheDocument());
  });

  it("recap shows goal hit/miss and the 7 days", async () => {
    h.stats = stats({ range: "last_week", total_minutes: 1500, goal_hours: 20, streak_days: 2 });
    render(<GroupRecapCard groupId="g1" userId="me" refreshToken="0-0" />);
    await waitFor(() => expect(screen.getByText("25h 00m")).toBeInTheDocument());
    expect(screen.getByText(/Goal hit — 125% of 20h/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /per day last week/ }).children).toHaveLength(7);
  });
});

describe("roster dialog", () => {
  it("lists offline members with last-studied and gives hosts remove/ban", async () => {
    const onRemoved = vi.fn();
    render(
      <GroupRosterDialog
        group={{ id: "g1" }} roster={h.roster} userId="me" isHost onRemoved={onRemoved} onClose={() => {}}
        presence={{ self: { phase: "idle" }, others: new Map() }}
      />
    );
    await waitFor(() => expect(screen.getByText("Name-u2")).toBeInTheDocument());
    expect(screen.getByText(/Offline · studied/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Remove You/)).toBeNull();           // can't remove yourself / the host
    fireEvent.click(screen.getByLabelText("Ban Name-u2"));
    expect(screen.getByText("Ban?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Yes"));
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith("u2"));
    expect(h.rpcs.some(([n, a]) => n === "gt_kick_member" && a.p_ban === true && a.p_user_id === "u2")).toBe(true);
  });

  it("non-hosts get no remove/ban buttons", async () => {
    render(<GroupRosterDialog group={{ id: "g1" }} roster={h.roster} userId="me" isHost={false} onRemoved={() => {}} onClose={() => {}} presence={{ self: {}, others: new Map() }} />);
    await waitFor(() => screen.getByText("Name-u2"));
    expect(screen.queryByLabelText("Ban Name-u2")).toBeNull();
  });
});

describe("rules stay in sync with the SQL", () => {
  it("every number the UI quotes is in the migration's rule header", () => {
    const sql = fs.readFileSync(path.resolve(process.cwd(), "supabase/migration_group_timer_v2.sql"), "utf8");
    expect(sql).toContain(`${GT_LIMITS.dailyCapMinutes} min`);
    expect(sql).toContain(`<= ${GT_LIMITS.maxSessionMinutes}`);
    expect(sql).toContain(`>= ${GT_LIMITS.roomDayMinutes}`);
    expect(sql).toContain("least(sum(s.m), 780)");
    expect(sql).toContain("Asia/Kolkata");
    const text = GT_RULES.map((r) => `${r.title} ${r.body}`).join(" ");
    expect(text).toContain("600 min");
    expect(text).toContain("780 min");
    expect(text).toContain("10+ minutes");
    expect(text).toContain("IST");
  });
});
