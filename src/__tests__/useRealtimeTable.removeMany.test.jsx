import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Minimal Supabase stub: select() returns 200 seeded rows; delete().in() is
// recorded per call and can be made to fail on the Nth call.
const h = vi.hoisted(() => ({ deleteCalls: [], failOnCall: null }));
vi.mock("../lib/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("../data/syllabus", () => ({ weightageFor: () => 1 }));
vi.mock("../lib/supabaseClient", () => {
  const rows = Array.from({ length: 200 }, (_, i) => ({ id: `r${i}`, user_id: "u1" }));
  const chan = { on: () => chan, subscribe: () => chan };
  return {
    supabase: {
      channel: () => chan,
      removeChannel: () => {},
      from: () => ({
        select: () => ({ eq: () => ({ order: async () => ({ data: rows, error: null }) }) }),
        delete: () => ({
          in: async (_col, ids) => {
            h.deleteCalls.push(ids);
            if (h.failOnCall === h.deleteCalls.length) return { error: { message: "boom" } };
            return { error: null };
          },
          eq: async () => ({ error: null }),
        }),
      }),
    },
  };
});

import { useRealtimeTable } from "../hooks/useRealtimeTable";

describe("useRealtimeTable.removeMany", () => {
  it("chunks big deletes, removes rows from state, returns true", async () => {
    h.deleteCalls.length = 0; h.failOnCall = null;
    const { result } = renderHook(() => useRealtimeTable("tasks"));
    await waitFor(() => expect(result.current.rows).toHaveLength(200));
    let ok;
    await act(async () => { ok = await result.current.removeMany(Array.from({ length: 170 }, (_, i) => `r${i}`)); });
    expect(ok).toBe(true);
    expect(h.deleteCalls.map((c) => c.length)).toEqual([80, 80, 10]);
    expect(result.current.rows).toHaveLength(30);
    expect(await result.current.removeMany([])).toBe(true); // no request for empty
    expect(h.deleteCalls).toHaveLength(3);
  });
  it("a failing chunk returns false and only drops rows that were really deleted", async () => {
    h.deleteCalls.length = 0; h.failOnCall = 2;
    const { result } = renderHook(() => useRealtimeTable("tasks"));
    await waitFor(() => expect(result.current.rows).toHaveLength(200));
    let ok;
    await act(async () => { ok = await result.current.removeMany(Array.from({ length: 170 }, (_, i) => `r${i}`)); });
    expect(ok).toBe(false);
    expect(result.current.rows).toHaveLength(120); // first chunk of 80 gone, the rest still shown
  });
});
