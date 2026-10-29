import { describe, it, expect, vi } from "vitest";
import { createTimerSessionTracker } from "../lib/timerSessionTracker";

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}
function deferred() {
  let resolve; const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}
function setup(over = {}) {
  const storage = memStorage();
  let n = 0;
  const insert = vi.fn(async () => ({ id: `row${++n}` }));
  const remove = vi.fn(async () => true);
  const onInsertFailed = vi.fn();
  const onRemoveFailed = vi.fn();
  const tracker = createTimerSessionTracker({
    getUserId: () => "u1", insert, remove, onInsertFailed, onRemoveFailed,
    newToken: () => "tok", storage, ...over,
  });
  return { tracker, insert, remove, onInsertFailed, onRemoveFailed, storage };
}
const payload = { mode: "Pomodoro", planned_minutes: 25, actual_minutes: 25, completed: true };

describe("timerSessionTracker", () => {
  it("discard deletes the auto-logged row", async () => {
    const { tracker, remove } = setup();
    await tracker.log(payload);
    await tracker.settle({ discarded: true });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith("row1");
  });

  it("keeping the session never deletes anything and clears the pending id", async () => {
    const { tracker, remove, storage } = setup();
    await tracker.log(payload);
    await tracker.settle({ discarded: false });
    expect(remove).not.toHaveBeenCalled();
    expect(storage._m.size).toBe(0);
    // a later discard (with nothing pending) must be a no-op, not delete the kept row
    await tracker.settle({ discarded: true });
    expect(remove).not.toHaveBeenCalled();
  });

  it("discard while the insert is still in flight waits and then deletes it", async () => {
    const d = deferred();
    const { tracker, remove } = setup({ insert: vi.fn(() => d.promise) });
    const logP = tracker.log(payload);
    const settleP = tracker.settle({ discarded: true });
    d.resolve({ id: "late" });
    await Promise.all([logP, settleP]);
    expect(remove).toHaveBeenCalledWith("late");
  });

  it("keep while insert in flight leaves no stale id for a later discard to hit", async () => {
    const d = deferred();
    const { tracker, remove, storage } = setup({ insert: vi.fn(() => d.promise) });
    const logP = tracker.log(payload);
    await tracker.settle({ discarded: false });
    d.resolve({ id: "kept" });
    await logP;
    expect(storage._m.size).toBe(0);
    await tracker.settle({ discarded: true });
    expect(remove).not.toHaveBeenCalled();
  });

  it("discard survives a reload (id recovered from storage when in-memory state is gone)", async () => {
    const { tracker, storage, insert, remove } = setup();
    await tracker.log(payload);
    const reloaded = createTimerSessionTracker({
      getUserId: () => "u1", insert, remove, onInsertFailed: vi.fn(), onRemoveFailed: vi.fn(), storage,
    });
    await reloaded.settle({ discarded: true });
    expect(remove).toHaveBeenCalledWith("row1");
  });

  it("never deletes a row remembered for a different account", async () => {
    const { tracker, storage, insert, remove } = setup();
    await tracker.log(payload);
    const other = createTimerSessionTracker({
      getUserId: () => "u2", insert, remove, onInsertFailed: vi.fn(), onRemoveFailed: vi.fn(), storage,
    });
    await other.settle({ discarded: true });
    expect(remove).not.toHaveBeenCalled();
  });

  it("double-tapping Discard deletes once", async () => {
    const { tracker, remove } = setup();
    await tracker.log(payload);
    await Promise.all([tracker.settle({ discarded: true }), tracker.settle({ discarded: true })]);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("a failed insert offers Retry; Retry re-inserts with the same token", async () => {
    const insert = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "r2" });
    const { tracker, onInsertFailed } = setup({ insert });
    await tracker.log(payload);
    expect(onInsertFailed).toHaveBeenCalledTimes(1);
    onInsertFailed.mock.calls[0][0]();
    await Promise.resolve(); await Promise.resolve();
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[1][1]).toEqual({ idempotencyKey: "tok" });
  });

  it("Retry after the session was discarded does nothing (no resurrected row)", async () => {
    const insert = vi.fn().mockResolvedValue(null);
    const { tracker, onInsertFailed, remove } = setup({ insert });
    await tracker.log(payload);
    await tracker.settle({ discarded: true });
    onInsertFailed.mock.calls[0][0]();
    await Promise.resolve();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it("a failed delete offers Retry that deletes again", async () => {
    const remove = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { tracker, onRemoveFailed } = setup({ remove });
    await tracker.log(payload);
    await tracker.settle({ discarded: true });
    expect(onRemoveFailed).toHaveBeenCalledTimes(1);
    await onRemoveFailed.mock.calls[0][0]();
    expect(remove).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenLastCalledWith("row1");
  });

  it("each new session only ever targets its own row", async () => {
    const { tracker, remove } = setup();
    await tracker.log(payload);
    await tracker.settle({ discarded: false });   // session 1 kept
    await tracker.log(payload);                   // session 2
    await tracker.settle({ discarded: true });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith("row2");
  });
});
