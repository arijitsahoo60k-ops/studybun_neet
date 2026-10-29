import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, render, screen, act, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  reads: [],
  msgs: {}, // channel_id -> [{id, user_id, created_at}]
  listeners: [],
  rpcCalls: [],
}));

vi.mock("../lib/supabaseClient", () => {
  const makeQuery = (table) => {
    const f = { eq: [], neq: [], gt: [] };
    const q = {
      select: () => q,
      eq: (c, v) => { f.eq.push([c, v]); return q; },
      neq: (c, v) => { f.neq.push([c, v]); return q; },
      gt: (c, v) => { f.gt.push([c, v]); return q; },
      order: () => q,
      limit: () => q,
      then: (res, rej) => {
        let data = [];
        if (table === "community_channel_reads") data = h.reads;
        else {
          const ch = f.eq.find((x) => x[0] === "channel_id")[1];
          const me = f.neq.find((x) => x[0] === "user_id")?.[1];
          const wm = f.gt.find((x) => x[0] === "created_at")?.[1];
          const all = (h.msgs[ch] || []).slice().sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
          // no neq filter => the "newest message, any author" baseline query
          data = me === undefined ? all.slice(0, 1) : all.filter((m) => m.user_id !== me && (!wm || m.created_at > wm)).slice(0, 1);
        }
        return Promise.resolve({ data, error: null }).then(res, rej);
      },
    };
    return q;
  };
  const chan = { on: (_t, _o, cb) => { h.listeners.push(cb); return chan; }, subscribe: () => chan };
  return {
    supabase: {
      from: makeQuery,
      channel: () => chan,
      removeChannel: () => {},
      rpc: async (name, args) => { h.rpcCalls.push({ name, args }); return { data: null, error: null }; },
    },
  };
});

import { useChannelUnread } from "../hooks/useChannelUnread";
import ChannelSelector from "../components/community/ChannelSelector";

const channels = [{ id: "a", name: "General" }, { id: "b", name: "Physics" }, { id: "c", name: "Maths" }];

beforeEach(() => { h.reads = []; h.msgs = {}; h.listeners = []; h.rpcCalls = []; window.localStorage.clear(); });

describe("useChannelUnread", () => {
  it("flags channels with newer messages from others, ignores own + active", async () => {
    h.reads = [{ channel_id: "b", last_read_at: "2026-10-06T10:00:00+00:00" }, { channel_id: "c", last_read_at: "2026-10-06T10:00:00+00:00" }];
    h.msgs = {
      a: [{ id: 1, user_id: "x", created_at: "2026-10-06T11:00:00+00:00" }],
      b: [{ id: 2, user_id: "x", created_at: "2026-10-06T11:00:00+00:00" }],
      c: [{ id: 3, user_id: "me", created_at: "2026-10-06T11:00:00+00:00" }, { id: 4, user_id: "x", created_at: "2026-10-06T09:00:00+00:00" }],
    };
    const { result } = renderHook(() => useChannelUnread({ channels, activeChannelId: "a", userId: "me" }));
    await waitFor(() => expect(result.current.has("b")).toBe(true));
    expect(result.current.has("a")).toBe(false); // active
    expect(result.current.has("c")).toBe(false); // own + old
  });

  it("no watermark (e.g. wiped by a chat block) does NOT make old messages unread", async () => {
    h.reads = []; // block deleted every watermark
    h.msgs = {
      b: [{ id: 1, user_id: "x", created_at: "2026-10-06T09:00:00+00:00" }],
      c: [{ id: 2, user_id: "x", created_at: "2026-10-06T09:30:00+00:00" }],
    };
    const { result, unmount } = renderHook(() => useChannelUnread({ channels, activeChannelId: "a", userId: "me" }));
    await waitFor(() => expect(window.localStorage.getItem("sb_unread_base:me:b")).toBe("2026-10-06T09:00:00+00:00"));
    expect(result.current.size).toBe(0);
    unmount();

    // A later load (still no watermark): only messages NEWER than the baseline count.
    h.msgs.b.push({ id: 3, user_id: "x", created_at: "2026-10-06T12:00:00+00:00" });
    const again = renderHook(() => useChannelUnread({ channels, activeChannelId: "a", userId: "me" }));
    await waitFor(() => expect(again.result.current.has("b")).toBe(true));
    expect(again.result.current.has("c")).toBe(false);
  });

  it("block -> unblock: enabled flips off then on, nothing lights up and a stale baseline is dropped", async () => {
    window.localStorage.setItem("sb_unread_base:me:b", "2026-10-01T00:00:00+00:00"); // old, from before the channel was ever opened
    h.reads = [{ channel_id: "b", last_read_at: "2026-10-06T11:00:00+00:00" }];
    h.msgs = { b: [{ id: 1, user_id: "x", created_at: "2026-10-06T10:00:00+00:00" }] };
    const { result, rerender } = renderHook((p) => useChannelUnread(p), {
      initialProps: { channels, activeChannelId: "a", userId: "me", enabled: true },
    });
    await waitFor(() => expect(window.localStorage.getItem("sb_unread_base:me:b")).toBe(null)); // watermark wins, baseline dropped
    expect(result.current.size).toBe(0);

    h.reads = []; // set_chat_ban() deleted the watermarks
    rerender({ channels, activeChannelId: "a", userId: "me", enabled: false });
    rerender({ channels, activeChannelId: "a", userId: "me", enabled: true });
    await waitFor(() => expect(window.localStorage.getItem("sb_unread_base:me:b")).toBe("2026-10-06T10:00:00+00:00"));
    expect(result.current.size).toBe(0);
  });

  it("realtime: other channel lights up, own/active don't; selecting clears", async () => {
    const { result, rerender } = renderHook((p) => useChannelUnread(p), {
      initialProps: { channels, activeChannelId: "a", userId: "me", viewing: true },
    });
    await waitFor(() => expect(h.listeners.length).toBeGreaterThan(0));
    const fire = (row) => act(() => { h.listeners[h.listeners.length - 1]({ new: row }); });
    fire({ channel_id: "b", user_id: "x" });
    expect(result.current.has("b")).toBe(true);
    fire({ channel_id: "c", user_id: "me" });
    expect(result.current.has("c")).toBe(false);
    fire({ channel_id: "a", user_id: "x" });
    expect(result.current.has("a")).toBe(false);
    fire({ channel_id: "zzz", user_id: "x" });
    expect(result.current.size).toBe(1);
    rerender({ channels, activeChannelId: "b", userId: "me", viewing: true });
    expect(result.current.has("b")).toBe(false);
  });

  it("trailing read mark only fires when viewing the active channel", async () => {
    vi.useFakeTimers();
    try {
      const { rerender } = renderHook((p) => useChannelUnread(p), {
        initialProps: { channels, activeChannelId: "a", userId: "me", viewing: false },
      });
      await act(async () => { await Promise.resolve(); });
      const cb = h.listeners[h.listeners.length - 1];
      act(() => cb({ new: { channel_id: "a", user_id: "x" } }));
      act(() => { vi.advanceTimersByTime(6000); });
      expect(h.rpcCalls.length).toBe(0);
      rerender({ channels, activeChannelId: "a", userId: "me", viewing: true });
      act(() => cb({ new: { channel_id: "a", user_id: "x" } }));
      act(() => { vi.advanceTimersByTime(6000); });
      expect(h.rpcCalls).toEqual([{ name: "mark_channel_read", args: { p_channel_id: "a" } }]);
    } finally { vi.useRealTimers(); }
  });
});

describe("ChannelSelector", () => {
  it("renders the unread class only for non-active unread channels, works without the prop", () => {
    const { rerender } = render(<ChannelSelector channels={channels} activeId="a" onSelect={() => {}} />);
    expect(document.querySelectorAll(".sb-chip.unread").length).toBe(0);
    rerender(<ChannelSelector channels={channels} activeId="a" onSelect={() => {}} unreadIds={new Set(["a", "b"])} />);
    const un = document.querySelectorAll(".sb-chip.unread");
    expect(un.length).toBe(1);
    expect(screen.getByLabelText("Physics, new messages")).toBeTruthy();
  });
});
