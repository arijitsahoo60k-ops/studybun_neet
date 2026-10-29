import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

const rpc = vi.fn();
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    channel: () => ({ on() { return this; }, subscribe() { return this; }, track: async () => {}, presenceState: () => ({}) }),
    removeChannel: async () => "ok",
  },
  isSupabaseConfigured: true,
}));
vi.mock("../hooks/useRoleIds", () => ({ useRoleIds: () => ({ founderIds: new Set(), moderatorIds: new Set() }) }));

import GroupTimerPage from "../pages/GroupTimer";
import { useFocusTimer } from "../hooks/useFocusTimer";
import { useGroupTimerRoom } from "../hooks/useGroupTimerRoom";

const PUBLIC = [{ id: "g1", name: "Physics Focus", member_count: 3, is_member: false }];
const ROOM = { id: "g1", name: "Physics Focus", is_public: true, join_code: null, created_by: null };

beforeEach(() => {
  localStorage.clear();
  rpc.mockReset();
  rpc.mockImplementation(async (name) => {
    if (name === "gt_list_public_groups") return { data: PUBLIC, error: null };
    if (name === "gt_my_groups") return { data: [], error: null };
    if (name === "gt_join_public") return { data: ROOM, error: null };
    return { data: null, error: null };
  });
});

function Harness() {
  const focusTimer = useFocusTimer({});
  const groupRoom = useGroupTimerRoom({ timer: focusTimer, userId: "u1" });
  return <GroupTimerPage focusTimer={focusTimer} groupRoom={groupRoom} userId="u1" mascot="bunny" profile={{ name: "Arijit" }} addSession={() => {}} setPage={() => {}} showToast={() => {}} />;
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe("Group Timer page", () => {
  it("lobby lists public groups, private tab has join/create, joining opens the room", async () => {
    render(<Harness />);
    expect(screen.getByText("Group Timer")).toBeInTheDocument();
    expect(screen.getByText(/Select a/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Physics Focus")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("tab", { name: /Private/ }));
    expect(screen.getByText("Join with a code")).toBeInTheDocument();
    expect(screen.getByText("Create a group")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Public/ }));

    fireEvent.click(screen.getByLabelText("Join Physics Focus"));
    await waitFor(() => expect(screen.getByLabelText("Group timer")).toBeInTheDocument());
    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Start")).toBeInTheDocument();

    // settings popup, then back to lobby
    fireEvent.click(screen.getByLabelText("Room settings"));
    expect(screen.getByText("Timer colour")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Close"));
    fireEvent.click(screen.getByLabelText("Back to groups"));
    await flush();
    expect(screen.getByText(/Select a/)).toBeInTheDocument();
  });

  it("shows the migration hint when the SQL hasn't been run", async () => {
    rpc.mockImplementation(async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" } }));
    render(<Harness />);
    await waitFor(() => expect(screen.getByText(/migration_group_timer\.sql/)).toBeInTheDocument());
  });
});
