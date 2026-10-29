import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ users: [], calls: [], inflight: 0, maxInflight: 0, failFor: new Set(), throwFor: new Set(), onCall: null, listError: null }));

vi.mock("../../api/_lib/supabaseAdmin.js", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({ select: async () => (h.listError ? { data: null, error: { message: h.listError } } : { data: h.users.map((u) => ({ user_id: u })), error: null }) }),
    rpc: async (_name, args) => {
      h.calls.push(args.target_uid);
      h.inflight += 1; h.maxInflight = Math.max(h.maxInflight, h.inflight);
      h.onCall?.();
      await new Promise((r) => setTimeout(r, 1));
      h.inflight -= 1;
      if (h.throwFor.has(args.target_uid)) throw new Error("network");
      return { error: h.failFor.has(args.target_uid) ? { message: "bad" } : null };
    },
  }),
}));

import handler from "../../api/cron/leaderboard-reconcile.js";

const run = async () => {
  let status = 200, body;
  const res = { status: (s) => { status = s; return res; }, json: (b) => { body = b; return res; } };
  await handler({ headers: {}, url: "/api/cron/leaderboard-reconcile" }, res);
  return { status, body };
};

beforeEach(() => { Object.assign(h, { users: [], calls: [], inflight: 0, maxInflight: 0, failFor: new Set(), throwFor: new Set(), onCall: null, listError: null }); delete process.env.CRON_SECRET; });
afterEach(() => vi.restoreAllMocks());

describe("leaderboard-reconcile", () => {
  it("reconciles every user exactly once, a few at a time", async () => {
    h.users = Array.from({ length: 40 }, (_, i) => `u${i}`);
    const r = await run();
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ totalUsers: 40, usersReconciled: 40, skipped: 0, failed: [] });
    expect(new Set(h.calls).size).toBe(40);
    expect(h.calls).toHaveLength(40);
    expect(h.maxInflight).toBeGreaterThan(1);
    expect(h.maxInflight).toBeLessThanOrEqual(5);
  });

  it("records per-user failures (rpc error or thrown) without stopping the rest", async () => {
    h.users = ["a", "b", "c", "d"];
    h.failFor.add("b"); h.throwFor.add("c");
    const r = await run();
    expect(r.status).toBe(200);
    expect(r.body.usersReconciled).toBe(2);
    expect(r.body.failed.map((f) => f.user_id).sort()).toEqual(["b", "c"]);
  });

  it("stops starting new users when the time budget is spent and reports skipped", async () => {
    h.users = Array.from({ length: 30 }, (_, i) => `u${i}`);
    let t = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => t);
    h.onCall = () => { t += 30000; };
    const r = await run();
    expect(r.status).toBe(200);
    expect(r.body.skipped).toBeGreaterThan(0);
    expect(r.body.usersReconciled + r.body.failed.length + r.body.skipped).toBe(30);
  });

  it("handles zero users and a list error", async () => {
    expect((await run()).body).toMatchObject({ totalUsers: 0, usersReconciled: 0, skipped: 0 });
    h.listError = "nope";
    expect((await run()).status).toBe(500);
  });

  it("enforces CRON_SECRET", async () => {
    process.env.CRON_SECRET = "x";
    expect((await run()).status).toBe(401);
  });
});
