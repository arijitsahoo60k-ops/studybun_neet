import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ goalsQueried: 0, rows: [], removed: [], deleteCalls: [], delError: null, rmError: null, selError: null, maxIn: 0 }));

vi.mock("../../api/_lib/supabaseAdmin.js", () => {
  const messages = () => {
    const q = { _mode: "select", _limit: 1000, _ids: null };
    q.select = () => { q._mode = "select"; return q; };
    q.lte = () => q;
    q.order = () => q;
    q.limit = (n) => { q._limit = n; return q; };
    q.delete = () => { q._mode = "delete"; return q; };
    q.in = (_c, ids) => { q._ids = ids; h.maxIn = Math.max(h.maxIn, ids.length); return q; };
    q.then = (resolve) => {
      if (q._mode === "select") {
        if (h.selError) return resolve({ data: null, error: { message: h.selError } });
        return resolve({ data: h.rows.slice(0, q._limit).map((r) => ({ ...r })), error: null });
      }
      if (h.delError) return resolve({ error: { message: h.delError }, count: null });
      h.deleteCalls.push(q._ids);
      h.rows = h.rows.filter((r) => !q._ids.includes(r.id));
      return resolve({ error: null, count: q._ids.length });
    };
    return q;
  };
  const goals = () => {
    h.goalsQueried += 1;
    const q = {};
    for (const m of ["select", "gte", "lt", "in", "update"]) q[m] = () => q;
    q.then = (resolve) => resolve({ data: [], error: null, count: 0 });
    return q;
  };
  return {
    getSupabaseAdmin: () => ({
      from: (t) => (t === "community_messages" ? messages() : goals()),
      storage: { from: () => ({ remove: async (paths) => { if (h.rmError) return { error: { message: h.rmError } }; h.removed.push(...paths); return { error: null }; } }) },
    }),
  };
});

import handler, { storagePathFromUrl } from "../../api/cron/community-cleanup.js";

const U = "11111111-1111-4111-8111-111111111111";
const F = "22222222-2222-4222-8222-222222222222";
const run = async () => {
  let status = 200, body;
  const res = { status: (s) => { status = s; return res; }, json: (b) => { body = b; return res; } };
  await handler({ headers: {}, url: "/api/cron/community-cleanup" }, res);
  return { status, body };
};
const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: `id-${i}`, image_url: null }));

beforeEach(() => { Object.assign(h, { goalsQueried: 0, rows: [], removed: [], deleteCalls: [], delError: null, rmError: null, selError: null, maxIn: 0 }); delete process.env.CRON_SECRET; vi.spyOn(console, "error").mockImplementation(() => {}); });

describe("storagePathFromUrl", () => {
  it("extracts the uploader's path shape only", () => {
    const base = "https://x.supabase.co/storage/v1/object/public/community-chat-images/";
    expect(storagePathFromUrl(`${base}${U}/${F}.jpeg`)).toBe(`${U}/${F}.jpeg`);
    expect(storagePathFromUrl(`${base}${U}/${F}.png?t=1`)).toBe(`${U}/${F}.png`);
    expect(storagePathFromUrl(`${base}../${F}.jpeg`)).toBeNull();
    expect(storagePathFromUrl(`${base}${U}/../${U}/${F}.jpeg`)).toBeNull();
    expect(storagePathFromUrl(`${base}other/file.jpeg`)).toBeNull();
    expect(storagePathFromUrl("https://evil.com/a.jpeg")).toBeNull();
    expect(storagePathFromUrl(null)).toBeNull();
    expect(storagePathFromUrl(undefined)).toBeNull();
  });
});

describe("community-cleanup handler", () => {
  it("no-op when nothing is expired", async () => {
    const r = await run();
    expect(r.status).toBe(200);
    expect(r.body.deleted).toBe(0);
  });

  it("drains a backlog larger than 1000 in small batches (short URLs)", async () => {
    h.rows = mk(1250);
    const r = await run();
    expect(r.status).toBe(200);
    expect(r.body.deleted).toBe(1250);
    expect(h.rows).toHaveLength(0);
    expect(h.maxIn).toBeLessThanOrEqual(100);
  });

  it("removes expired chat photos from storage and tolerates bad URLs", async () => {
    const good = `https://x.supabase.co/storage/v1/object/public/community-chat-images/${U}/${F}.jpeg`;
    h.rows = [{ id: "a", image_url: good }, { id: "b", image_url: "https://evil.com/x.jpg" }, { id: "c", image_url: null }];
    const r = await run();
    expect(r.body.deleted).toBe(3);
    expect(r.body.imagesRemoved).toBe(1);
    expect(h.removed).toEqual([`${U}/${F}.jpeg`]);
  });

  it("still deletes the messages if photo removal fails", async () => {
    const good = `https://x.supabase.co/storage/v1/object/public/community-chat-images/${U}/${F}.jpeg`;
    h.rows = [{ id: "a", image_url: good }];
    h.rmError = "storage down";
    const r = await run();
    expect(r.status).toBe(200);
    expect(r.body.deleted).toBe(1);
    expect(r.body.imagesRemoved).toBe(0);
  });

  it("reports a delete failure instead of looping forever", async () => {
    h.rows = mk(5);
    h.delError = "boom";
    const r = await run();
    expect(r.status).toBe(500);
    expect(r.body.error).toBe("boom");
    expect(r.body.messagesDrained).toBe(false);
    // the independent goal-expiry step still ran
    expect(h.goalsQueried).toBeGreaterThan(0);
  });

  it("reports drained=true on a full clean run", async () => {
    h.rows = mk(250);
    const r = await run();
    expect(r.body.messagesDrained).toBe(true);
  });

  it("reports a select failure", async () => {
    h.selError = "nope";
    const r = await run();
    expect(r.status).toBe(500);
  });

  it("enforces CRON_SECRET", async () => {
    process.env.CRON_SECRET = "s3";
    expect((await run()).status).toBe(401);
  });
});
