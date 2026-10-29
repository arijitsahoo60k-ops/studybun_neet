import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, render, screen, act, waitFor, fireEvent } from "@testing-library/react";

// Controllable Supabase stub. `h.own` is what the signed-in user's own
// community_chat_bans row looks like, `h.all` is what an admin's list
// query returns, `h.rpc` answers RPC calls, and every realtime
// subscription's callback is captured so a test can fire an event.
const h = vi.hoisted(() => ({
  own: null,
  all: [],
  isAdmin: false,
  rpcCalls: [],
  rpcError: null,
  listeners: [],
  dir: [],
  dirError: null,
}));

vi.mock("../lib/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("../lib/supabaseClient", () => {
  const makeChannel = () => {
    const chan = {
      on: (_type, opts, cb) => { h.listeners.push({ opts, cb }); return chan; },
      subscribe: () => chan,
    };
    return chan;
  };
  return {
    supabase: {
      channel: () => makeChannel(),
      removeChannel: () => {},
      rpc: async (name, args) => {
        h.rpcCalls.push({ name, args });
        if (name === "is_chat_ban_admin") return { data: h.isAdmin, error: null };
        if (name === "set_chat_ban") {
          if (h.rpcError) return { data: null, error: { message: h.rpcError } };
          return { data: args.p_banned, error: null };
        }
        if (name === "get_community_profiles") return { data: [], error: null };
        if (name === "get_chat_ban_directory") {
          if (h.dirError) return { data: null, error: { message: h.dirError } };
          return { data: h.dir, error: null };
        }
        return { data: null, error: null };
      },
      from: () => ({
        select: () => ({
          eq: (col) => {
            if (col === "user_id") {
              return { maybeSingle: async () => ({ data: h.own, error: null }) };
            }
            // .eq("is_banned", true) — the admin's list query
            return Promise.resolve({ data: h.all, error: null });
          },
        }),
      }),
    },
  };
});

import { useCommunityChatBan } from "../hooks/useCommunityChatBan";
import CommunityChat from "../components/community/CommunityChat";
import ChatBanManager from "../components/community/ChatBanManager";

beforeEach(() => {
  h.own = null; h.all = []; h.isAdmin = false; h.rpcCalls = []; h.rpcError = null; h.listeners = []; h.dir = []; h.dirError = null;
});

describe("useCommunityChatBan", () => {
  it("defaults to not banned, not admin", async () => {
    const { result } = renderHook(() => useCommunityChatBan());
    await waitFor(() => expect(h.rpcCalls.some((c) => c.name === "is_chat_ban_admin")).toBe(true));
    expect(result.current.banned).toBe(false);
    expect(result.current.isBanAdmin).toBe(false);
  });

  it("reads my own blocked state and follows realtime block/unblock", async () => {
    h.own = { is_banned: true };
    const { result } = renderHook(() => useCommunityChatBan());
    await waitFor(() => expect(result.current.banned).toBe(true));

    const own = h.listeners.find((l) => l.opts.filter === "user_id=eq.me");
    act(() => own.cb({ eventType: "UPDATE", new: { user_id: "me", is_banned: false } }));
    expect(result.current.banned).toBe(false);
    act(() => own.cb({ eventType: "UPDATE", new: { user_id: "me", is_banned: true } }));
    expect(result.current.banned).toBe(true);
    act(() => own.cb({ eventType: "DELETE", old: { user_id: "me" } }));
    expect(result.current.banned).toBe(false);
  });

  it("a normal user never gets the admin list or controls", async () => {
    h.isAdmin = false;
    const { result } = renderHook(() => useCommunityChatBan());
    await waitFor(() => expect(h.rpcCalls.length).toBeGreaterThan(0));
    expect(result.current.isBanAdmin).toBe(false);
    expect(result.current.bannedIds.size).toBe(0);
    expect(h.listeners.some((l) => !l.opts.filter)).toBe(false);
  });

  it("admin: loads the blocked list, blocks and unblocks via set_chat_ban, refuses self", async () => {
    h.isAdmin = true;
    h.all = [{ user_id: "a" }];
    const { result } = renderHook(() => useCommunityChatBan());
    await waitFor(() => expect(result.current.isBanAdmin).toBe(true));
    await waitFor(() => expect(result.current.bannedIds.has("a")).toBe(true));

    let res;
    await act(async () => { res = await result.current.setBan("b", true); });
    expect(res.ok).toBe(true);
    expect(h.rpcCalls.find((c) => c.name === "set_chat_ban").args).toEqual({ p_user_id: "b", p_banned: true });
    expect(result.current.bannedIds.has("b")).toBe(true);

    await act(async () => { res = await result.current.setBan("b", false); });
    expect(res.ok).toBe(true);
    expect(result.current.bannedIds.has("b")).toBe(false);

    const before = h.rpcCalls.length;
    await act(async () => { res = await result.current.setBan("me", true); });
    expect(res.ok).toBe(false);
    expect(h.rpcCalls.length).toBe(before); // never even hit the server

    // live list updates from realtime (e.g. a second admin tab)
    const all = h.listeners.find((l) => !l.opts.filter);
    act(() => all.cb({ eventType: "UPDATE", new: { user_id: "a", is_banned: false } }));
    expect(result.current.bannedIds.has("a")).toBe(false);
  });

  it("surfaces a server refusal instead of pretending it worked", async () => {
    h.isAdmin = true;
    h.rpcError = "not_authorized";
    const { result } = renderHook(() => useCommunityChatBan());
    await waitFor(() => expect(result.current.isBanAdmin).toBe(true));
    let res;
    await act(async () => { res = await result.current.setBan("b", true); });
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(result.current.bannedIds.has("b")).toBe(false);
  });
});

describe("CommunityChat blocked state", () => {
  const baseProps = (over = {}) => ({
    channels: [{ id: "c1", name: "general", is_locked: false }],
    activeChannelId: "c1",
    onSelectChannel: () => {},
    setChannelLock: async () => ({ ok: true }),
    messages: [
      { id: "m1", channel_id: "c1", user_id: "other", content: "hello there", created_at: new Date().toISOString(), profiles: { name: "Riya", mascot: "bunny" } },
      { id: "m2", channel_id: "c1", user_id: "me", content: "my own msg", created_at: new Date().toISOString(), profiles: { name: "Me", mascot: "bunny" } },
    ],
    loading: false, sending: false,
    sendMessage: vi.fn(async () => ({ ok: true })),
    deleteMessage: vi.fn(async () => ({ ok: true })),
    hasMore: false, loadOlder: () => {}, markChannelRead: vi.fn(),
    currentUserId: "me", myProfile: { name: "Me", mascot: "bunny" },
    moderation: { isBlocked: () => false, canDelete: () => false, isChannelLockAdmin: false },
    founderIds: new Set(), memberIds: new Set(), mascot: "bunny",
    focusLock: { eligible: false, locked: false, toggle: async () => ({ ok: true }) },
    chatBan: { banned: false, isBanAdmin: false, bannedIds: new Set(), setBan: vi.fn(async () => ({ ok: true })), refresh: vi.fn() },
    ...over,
  });

  it("normal user: chat, composer and no block controls", () => {
    render(<CommunityChat {...baseProps()} />);
    expect(screen.getByText("hello there")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/./)).toBeInTheDocument();
    expect(screen.queryByLabelText("Block from chat")).toBeNull();
    expect(screen.queryByText(/Blocked/)).toBeNull();
  });

  it("blocked user: banner replaces messages + composer, and no read receipts are written", () => {
    const props = baseProps({ chatBan: { banned: true, isBanAdmin: false, bannedIds: new Set(), setBan: vi.fn(), refresh: vi.fn() } });
    render(<CommunityChat {...props} />);
    expect(screen.getByText(/You're blocked from Community Chat/)).toBeInTheDocument();
    expect(screen.queryByText("hello there")).toBeNull();
    expect(screen.queryByPlaceholderText(/./)).toBeNull();
    expect(props.markChannelRead).not.toHaveBeenCalled();
  });

  it("blocked wins over Focus Lock without touching it, and unblock restores the chat", () => {
    const focusLock = { eligible: true, locked: true, toggle: async () => ({ ok: true }) };
    const banned = { banned: true, isBanAdmin: false, bannedIds: new Set(), setBan: vi.fn(), refresh: vi.fn() };
    const { rerender } = render(<CommunityChat {...baseProps({ focusLock, chatBan: banned })} />);
    expect(screen.getByText(/You're blocked from Community Chat/)).toBeInTheDocument();
    expect(screen.queryByText("You closed this off.")).toBeNull();

    rerender(<CommunityChat {...baseProps({ focusLock, chatBan: { ...banned, banned: false } })} />);
    expect(screen.queryByText(/You're blocked from Community Chat/)).toBeNull();
    expect(screen.getByText("You closed this off.")).toBeInTheDocument(); // focus lock intact

    rerender(<CommunityChat {...baseProps({ focusLock: { ...focusLock, locked: false }, chatBan: { ...banned, banned: false } })} />);
    expect(screen.getByText("hello there")).toBeInTheDocument();
  });

  it("a send refused with chat_banned asks the hook to re-check state", async () => {
    const sendMessage = vi.fn(async () => ({ ok: false, error: "x", code: "chat_banned" }));
    const props = baseProps({ sendMessage });
    render(<CommunityChat {...props} />);
    const box = screen.getByPlaceholderText(/./);
    fireEvent.change(box, { target: { value: "hi" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(sendMessage).toHaveBeenCalled());
    await waitFor(() => expect(props.chatBan.refresh).toHaveBeenCalled());
  });

  it("admin: can block others (with confirm), never themselves, and sees the Blocked chip", async () => {
    const setBan = vi.fn(async () => ({ ok: true }));
    const chatBan = { banned: false, isBanAdmin: true, bannedIds: new Set(["other"]), setBan, refresh: vi.fn() };
    render(<CommunityChat {...baseProps({ chatBan })} />);
    // only the other person's message gets a control (their message is blocked => Unblock)
    expect(screen.getAllByLabelText(/chat$/)).toHaveLength(1);
    expect(screen.getByLabelText("Unblock from chat")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Unblock from chat"));
    fireEvent.click(await screen.findByRole("button", { name: "Unblock" }));
    await waitFor(() => expect(setBan).toHaveBeenCalledWith("other", false));
  });

  it("admin: blocking asks for confirmation first and Cancel does nothing", async () => {
    const setBan = vi.fn(async () => ({ ok: true }));
    const chatBan = { banned: false, isBanAdmin: true, bannedIds: new Set(), setBan, refresh: vi.fn() };
    render(<CommunityChat {...baseProps({ chatBan })} />);
    fireEvent.click(screen.getByLabelText("Block from chat"));
    expect(setBan).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(setBan).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Block from chat"));
    fireEvent.click(await screen.findByRole("button", { name: "Block" }));
    await waitFor(() => expect(setBan).toHaveBeenCalledWith("other", true));
  });

  it("admin: a failed block shows an error instead of silently succeeding", async () => {
    const setBan = vi.fn(async () => ({ ok: false, error: "Couldn't block that user. Try again." }));
    const chatBan = { banned: false, isBanAdmin: true, bannedIds: new Set(), setBan, refresh: vi.fn() };
    render(<CommunityChat {...baseProps({ chatBan })} />);
    fireEvent.click(screen.getByLabelText("Block from chat"));
    fireEvent.click(await screen.findByRole("button", { name: "Block" }));
    expect(await screen.findByText("Couldn't block that user. Try again.")).toBeInTheDocument();
  });

  it("admin: the Blocked list can unblock someone with no messages on screen", async () => {
    const setBan = vi.fn(async () => ({ ok: true }));
    const chatBan = { banned: false, isBanAdmin: true, bannedIds: new Set(["ghost"]), setBan, refresh: vi.fn() };
    render(<div className="sb-app"><CommunityChat {...baseProps({ chatBan, messages: [] })} /></div>);
    fireEvent.click(screen.getByLabelText(/Blocked from chat \(1\)/));
    fireEvent.click(await screen.findByRole("button", { name: /Unblock/ }));
    await waitFor(() => expect(setBan).toHaveBeenCalledWith("ghost", false));
  });
});

describe("useCommunityChatBan.fetchDirectory", () => {
  it("returns the member list from the admin RPC and never includes me", async () => {
    h.isAdmin = true;
    h.dir = [
      { user_id: "a", name: "Aarav", mascot: "bunny", is_banned: false },
      { user_id: "me", name: "Me", mascot: "bunny", is_banned: false },
    ];
    const { result } = renderHook(() => useCommunityChatBan());
    await waitFor(() => expect(result.current.isBanAdmin).toBe(true));
    let res;
    await act(async () => { res = await result.current.fetchDirectory(); });
    expect(res.ok).toBe(true);
    expect(res.data.map((r) => r.user_id)).toEqual(["a"]);
    expect(h.rpcCalls.some((c) => c.name === "get_chat_ban_directory")).toBe(true);
  });

  it("reports a server refusal as an error instead of an empty list", async () => {
    h.isAdmin = true;
    h.dirError = "not_authorized";
    const { result } = renderHook(() => useCommunityChatBan());
    await waitFor(() => expect(result.current.isBanAdmin).toBe(true));
    let res;
    await act(async () => { res = await result.current.fetchDirectory(); });
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(res.data).toEqual([]);
  });
});

describe("ChatBanManager: block someone from the header list", () => {
  const MEMBERS = [
    { user_id: "u1", name: "Aarav", mascot: "bunny", is_banned: false },
    { user_id: "u2", name: "Riya", mascot: "bunny", is_banned: false },
    { user_id: "u3", name: "Zoya", mascot: "bunny", is_banned: true },
  ];
  const setup = (over = {}) => {
    const props = {
      bannedIds: new Set(["u3"]),
      onBan: vi.fn(async () => ({ ok: true })),
      onUnban: vi.fn(async () => ({ ok: true })),
      fetchDirectory: vi.fn(async () => ({ ok: true, data: MEMBERS })),
      founderIds: new Set(["u2"]),
      ...over,
    };
    render(<div className="sb-app"><ChatBanManager {...props} /></div>);
    return props;
  };
  const openIt = () => fireEvent.click(screen.getByLabelText(/Blocked from chat/));

  it("lists members who are not blocked yet and keeps blocked ones in the Blocked list only", async () => {
    setup();
    openIt();
    expect(await screen.findByLabelText("Block Aarav")).toBeInTheDocument();
    expect(screen.getByLabelText("Block Riya")).toBeInTheDocument();
    expect(screen.queryByLabelText("Block Zoya")).toBeNull();
    expect(screen.getByLabelText("Unblock Zoya")).toBeInTheDocument();
  });

  it("fetches the directory only when opened, and again on each open", async () => {
    const props = setup();
    expect(props.fetchDirectory).not.toHaveBeenCalled();
    openIt();
    await screen.findByLabelText("Block Aarav");
    expect(props.fetchDirectory).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText("Close"));
    openIt();
    await screen.findByLabelText("Block Aarav");
    expect(props.fetchDirectory).toHaveBeenCalledTimes(2);
  });

  it("search narrows the list (case-insensitive) and shows an empty state", async () => {
    setup();
    openIt();
    await screen.findByLabelText("Block Aarav");
    const box = screen.getByLabelText("Search members to block");
    fireEvent.change(box, { target: { value: "  rIy " } });
    expect(screen.getByLabelText("Block Riya")).toBeInTheDocument();
    expect(screen.queryByLabelText("Block Aarav")).toBeNull();
    fireEvent.change(box, { target: { value: "nobody" } });
    expect(screen.getByText("No one matches that name.")).toBeInTheDocument();
  });

  it("blocking needs a second confirm tap; Cancel does nothing; confirm calls onBan", async () => {
    const props = setup();
    openIt();
    fireEvent.click(await screen.findByLabelText("Block Aarav"));
    expect(props.onBan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onBan).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Block Aarav")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Block Aarav"));
    fireEvent.click(screen.getByLabelText("Confirm block Aarav"));
    await waitFor(() => expect(props.onBan).toHaveBeenCalledWith("u1"));
    expect(props.onBan).toHaveBeenCalledTimes(1);
  });

  it("a blocked member moves from the picker to the Blocked list live", async () => {
    const props = {
      onBan: vi.fn(async () => ({ ok: true })),
      onUnban: vi.fn(async () => ({ ok: true })),
      fetchDirectory: vi.fn(async () => ({ ok: true, data: MEMBERS })),
      founderIds: new Set(),
    };
    const ui = (bannedIds) => <div className="sb-app"><ChatBanManager {...props} bannedIds={bannedIds} /></div>;
    const r = render(ui(new Set()));
    fireEvent.click(r.getAllByLabelText(/Blocked from chat/)[0]);
    await screen.findByLabelText("Block Aarav");
    await act(async () => { r.rerender(ui(new Set(["u1"]))); });
    expect(screen.queryByLabelText("Block Aarav")).toBeNull();
    expect(screen.getByLabelText("Unblock Aarav")).toBeInTheDocument();
  });

  it("marks founders so a mis-tap on the other founder is obvious", async () => {
    setup();
    openIt();
    await screen.findByLabelText("Block Riya");
    expect(screen.getByText("founder")).toBeInTheDocument();
  });

  it("a failed block shows an error and leaves the member listed", async () => {
    setup({ onBan: vi.fn(async () => ({ ok: false, error: "Couldn't block that user. Try again." })) });
    openIt();
    fireEvent.click(await screen.findByLabelText("Block Aarav"));
    fireEvent.click(screen.getByLabelText("Confirm block Aarav"));
    expect(await screen.findByText("Couldn't block that user. Try again.")).toBeInTheDocument();
    expect(screen.getByLabelText("Block Aarav")).toBeInTheDocument();
  });

  it("directory failure shows an error with Retry, and Retry recovers", async () => {
    const fetchDirectory = vi.fn()
      .mockResolvedValueOnce({ ok: false, data: [], error: "Couldn't load members. Try again." })
      .mockResolvedValue({ ok: true, data: MEMBERS });
    setup({ fetchDirectory });
    openIt();
    expect(await screen.findByText("Couldn't load members. Try again.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByLabelText("Block Aarav")).toBeInTheDocument();
  });

  it("caps the rendered results and says how many are hidden", async () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ user_id: `x${i}`, name: `Member ${String(i).padStart(2, "0")}`, mascot: "bunny", is_banned: false }));
    setup({ bannedIds: new Set(), fetchDirectory: vi.fn(async () => ({ ok: true, data: many })) });
    openIt();
    await screen.findByLabelText("Block Member 00");
    expect(screen.getAllByLabelText(/^Block Member/)).toHaveLength(30);
    expect(screen.getByText(/\+15 more/)).toBeInTheDocument();
  });

  it("unblock from the same dialog still works", async () => {
    const props = setup();
    openIt();
    fireEvent.click(await screen.findByLabelText("Unblock Zoya"));
    await waitFor(() => expect(props.onUnban).toHaveBeenCalledWith("u3"));
  });

  it("Escape closes the dialog and clears the confirm/search state", async () => {
    setup();
    openIt();
    fireEvent.click(await screen.findByLabelText("Block Aarav"));
    fireEvent.change(screen.getByLabelText("Search members to block"), { target: { value: "ri" } });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    openIt();
    await screen.findByLabelText("Block Aarav");
    expect(screen.getByLabelText("Search members to block").value).toBe("");
    expect(screen.queryByLabelText("Confirm block Aarav")).toBeNull();
  });

  it("without a directory loader the picker is hidden but Unblock still works", async () => {
    const props = setup({ fetchDirectory: undefined, onBan: undefined });
    openIt();
    expect(await screen.findByLabelText("Unblock Study Buddy")).toBeInTheDocument();
    expect(screen.queryByLabelText("Search members to block")).toBeNull();
    expect(props.onUnban).not.toHaveBeenCalled();
  });
});

describe("CommunityChat header: block from the list (integration)", () => {
  it("admin opens the header list, blocks a member with no messages on screen", async () => {
    const setBan = vi.fn(async () => ({ ok: true }));
    const fetchDirectory = vi.fn(async () => ({ ok: true, data: [{ user_id: "ghost", name: "Ghost", mascot: "bunny", is_banned: false }] }));
    const chatBan = { banned: false, isBanAdmin: true, bannedIds: new Set(), setBan, fetchDirectory, refresh: vi.fn() };
    const props = {
      channels: [{ id: "c1", name: "general", is_locked: false }], activeChannelId: "c1", onSelectChannel: () => {},
      setChannelLock: async () => ({ ok: true }), messages: [], loading: false, sending: false,
      sendMessage: vi.fn(async () => ({ ok: true })), deleteMessage: vi.fn(async () => ({ ok: true })),
      hasMore: false, loadOlder: () => {}, markChannelRead: vi.fn(), currentUserId: "me",
      myProfile: { name: "Me", mascot: "bunny" },
      moderation: { isBlocked: () => false, canDelete: () => false, isChannelLockAdmin: false },
      founderIds: new Set(), memberIds: new Set(), mascot: "bunny",
      focusLock: { eligible: false, locked: false, toggle: async () => ({ ok: true }) }, chatBan,
    };
    render(<div className="sb-app"><CommunityChat {...props} /></div>);
    fireEvent.click(screen.getByLabelText(/Blocked from chat/));
    fireEvent.click(await screen.findByLabelText("Block Ghost"));
    fireEvent.click(screen.getByLabelText("Confirm block Ghost"));
    await waitFor(() => expect(setBan).toHaveBeenCalledWith("ghost", true));
  });

  it("a normal member never sees the header button or the picker", () => {
    const chatBan = { banned: false, isBanAdmin: false, bannedIds: new Set(), setBan: vi.fn(), fetchDirectory: vi.fn(), refresh: vi.fn() };
    render(<div className="sb-app"><CommunityChat
      channels={[{ id: "c1", name: "general", is_locked: false }]} activeChannelId="c1" onSelectChannel={() => {}}
      setChannelLock={async () => ({ ok: true })} messages={[]} loading={false} sending={false}
      sendMessage={vi.fn()} deleteMessage={vi.fn()} hasMore={false} loadOlder={() => {}} markChannelRead={vi.fn()}
      currentUserId="me" myProfile={{ name: "Me", mascot: "bunny" }}
      moderation={{ isBlocked: () => false, canDelete: () => false, isChannelLockAdmin: false }}
      founderIds={new Set()} memberIds={new Set()} mascot="bunny"
      focusLock={{ eligible: false, locked: false, toggle: async () => ({ ok: true }) }} chatBan={chatBan} /></div>);
    expect(screen.queryByLabelText(/Blocked from chat/)).toBeNull();
    expect(chatBan.fetchDirectory).not.toHaveBeenCalled();
  });
});
