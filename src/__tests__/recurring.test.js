import { describe, it, expect, vi } from "vitest";
import {
  nextRecurringDate, addDaysToDateStr, recurringParentId, findActiveTemplate, canSkipOccurrence,
  parseRecurringSkipDates, encodeRecurringSkipDates, createRecurringDeleters,
} from "../lib/recurring";

const TODAY = "2026-09-19"; // Saturday

// In-memory stand-in for the tasks table hook with the same edge semantics as
// the real one: update() fails (null) on a missing row (.single() errors),
// deleting missing ids is NOT an error, insert() assigns a brand-new id.
function makeEnv(rows, fail = {}) {
  let seq = 100;
  const state = { rows: rows.map((r) => ({ user_id: "u", created_at: "c", status: "Pending", recurring: null, description: null, title: "T", ...r })) };
  const tasksQ = {
    update: vi.fn(async (id, patch) => {
      if (fail.update) return null;
      const i = state.rows.findIndex((r) => r.id === id);
      if (i < 0) return null;
      state.rows[i] = { ...state.rows[i], ...patch };
      return state.rows[i];
    }),
    remove: vi.fn(async (id) => { if (fail.remove) return false; state.rows = state.rows.filter((r) => r.id !== id); return true; }),
    removeMany: vi.fn(async (ids) => { if (fail.removeMany) return false; state.rows = state.rows.filter((r) => !ids.includes(r.id)); return true; }),
    insert: vi.fn(async (row) => { const r = { id: `n${seq++}`, user_id: "u", created_at: "c2", ...row }; state.rows.push(r); return r; }),
  };
  const toasts = [];
  const showToast = (msg, undo, label) => toasts.push({ msg, undo, label });
  // Fresh snapshot per call, like a re-render.
  const deleters = () => createRecurringDeleters({ tasks: state.rows.map((r) => ({ ...r })), tasksQ, showToast, today: () => TODAY });
  const ids = () => state.rows.map((r) => r.id).sort();
  const row = (id) => state.rows.find((r) => r.id === id);
  const last = () => toasts[toasts.length - 1];
  return { state, tasksQ, toasts, deleters, ids, row, last };
}

describe("date helpers", () => {
  it("addDaysToDateStr crosses month/year", () => {
    expect(addDaysToDateStr("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateStr("2026-02-28", 1)).toBe("2026-03-01");
  });
  it("Daily -> next day", () => expect(nextRecurringDate("Daily", "2026-09-19")).toBe("2026-09-20"));
  it("Weekly -> next matching weekday, strictly after", () => {
    expect(nextRecurringDate("Weekly:Sat", "2026-09-19")).toBe("2026-09-26");
    // due date is a Sat but pattern is Mon: must land on Mon, not +7 (a Sat)
    expect(nextRecurringDate("Weekly:Mon", "2026-09-19")).toBe("2026-09-21");
    expect(nextRecurringDate("Weekly:Fri", "2026-09-19")).toBe("2026-09-25");
  });
  it("skip list round-trips", () => {
    expect(parseRecurringSkipDates(encodeRecurringSkipDates(["a", "b"]))).toEqual(["a", "b"]);
    expect(encodeRecurringSkipDates([])).toBeNull();
    expect(parseRecurringSkipDates(null)).toEqual([]);
  });
});

describe("template lookup", () => {
  const tpl = { id: "T", recurring: "Daily", due_date: "2026-09-10" };
  const kid = { id: "K", recurring: null, description: "__recurring_from:T", due_date: TODAY };
  it("child resolves to a live parent, template resolves to itself", () => {
    expect(findActiveTemplate([tpl, kid], kid)).toBe(tpl);
    expect(findActiveTemplate([tpl, kid], tpl)).toBe(tpl);
  });
  it("child of a deleted or Stop-ped parent is a plain row", () => {
    expect(findActiveTemplate([kid], kid)).toBeNull();
    expect(findActiveTemplate([{ ...tpl, recurring: null }, kid], kid)).toBeNull();
  });
  it("canSkipOccurrence", () => {
    expect(canSkipOccurrence(kid, TODAY)).toBe(true);
    expect(canSkipOccurrence({ ...tpl, status: "Pending", due_date: TODAY }, TODAY)).toBe(true);
    expect(canSkipOccurrence({ ...tpl, status: "Pending", due_date: "2026-09-25" }, TODAY)).toBe(true);
    expect(canSkipOccurrence({ ...tpl, status: "Pending", due_date: "2026-09-10" }, TODAY)).toBe(false); // stale
    expect(canSkipOccurrence({ ...tpl, status: "Completed", due_date: TODAY }, TODAY)).toBe(false);
  });
  it("recurringParentId ignores skip-list descriptions", () => {
    expect(recurringParentId({ description: "__recurring_skip:2026-09-19" })).toBeNull();
    expect(recurringParentId({ description: "__recurring_from:" })).toBeNull();
  });
});

describe("plain tasks", () => {
  it("delete removes the row; undo restores it", async () => {
    const e = makeEnv([{ id: "P", title: "plain", due_date: TODAY }]);
    await e.deleters().deleteTask("P");
    expect(e.ids()).toEqual([]);
    expect(e.last().msg).toBe("Task deleted");
    await e.last().undo();
    expect(e.state.rows).toHaveLength(1);
    expect(e.state.rows[0].title).toBe("plain");
  });
  it("failed delete shows Retry and never claims success", async () => {
    const e = makeEnv([{ id: "P", due_date: TODAY }], { remove: true });
    await e.deleters().deleteTask("P");
    expect(e.last().label).toBe("Retry");
    expect(e.toasts.some((t) => t.msg === "Task deleted")).toBe(false);
    expect(e.ids()).toEqual(["P"]);
  });
});

describe("template, just this one", () => {
  it("due today: advances, row survives, undo puts it back", async () => {
    const e = makeEnv([{ id: "T", recurring: "Daily", due_date: TODAY }]);
    await e.deleters().deleteTask("T", "occurrence");
    expect(e.row("T").due_date).toBe("2026-09-20");
    expect(e.row("T").recurring).toBe("Daily");
    await e.last().undo();
    expect(e.row("T").due_date).toBe(TODAY);
  });
  it("weekly with a due date that is NOT the pattern weekday lands on the pattern weekday", async () => {
    const e = makeEnv([{ id: "T", recurring: "Weekly:Mon", due_date: TODAY }]); // Sat
    await e.deleters().deleteTask("T", "occurrence");
    expect(e.row("T").due_date).toBe("2026-09-21"); // Monday
  });
  it("due in the future: skips to the occurrence after ITS date, not after today", async () => {
    const e = makeEnv([{ id: "T", recurring: "Daily", due_date: "2026-09-25" }]);
    await e.deleters().deleteTask("T", "occurrence");
    expect(e.row("T").due_date).toBe("2026-09-26");
  });
  it("stale pending template (no occurrence left to skip) is ended, children cleaned, NOT silently kept", async () => {
    const e = makeEnv([
      { id: "T", recurring: "Daily", due_date: "2026-09-10" },
      { id: "K", description: "__recurring_from:T", due_date: TODAY },
    ]);
    await e.deleters().deleteTask("T", "occurrence");
    expect(e.ids()).toEqual([]);
  });
  it("Completed template never gets its history row deleted by 'occurrence'", async () => {
    const e = makeEnv([{ id: "T", recurring: "Daily", status: "Completed", due_date: TODAY }]);
    await e.deleters().deleteTask("T", "occurrence");
    expect(e.row("T")).toBeTruthy();
    expect(e.row("T").recurring).toBeNull();
  });
});

describe("series delete", () => {
  it("pending template + pending children go, completed children stay", async () => {
    const e = makeEnv([
      { id: "T", recurring: "Daily", due_date: "2026-09-10" },
      { id: "K1", description: "__recurring_from:T", due_date: "2026-09-17" },
      { id: "K2", description: "__recurring_from:T", due_date: TODAY },
      { id: "KC", description: "__recurring_from:T", due_date: "2026-09-18", status: "Completed" },
      { id: "OTHER", description: "__recurring_from:X", due_date: TODAY },
      { id: "P", due_date: TODAY },
    ]);
    await e.deleters().deleteTask("K2", "series"); // clicked a CHILD
    expect(e.ids()).toEqual(["KC", "OTHER", "P"]);
    expect(e.tasksQ.removeMany).toHaveBeenCalledTimes(1); // one bulk request
  });
  it("Completed template keeps its row (streak history) but stops repeating", async () => {
    const e = makeEnv([
      { id: "T", recurring: "Daily", status: "Completed", due_date: "2026-09-16", description: "__recurring_skip:2026-09-17" },
      { id: "K", description: "__recurring_from:T", due_date: TODAY },
    ]);
    await e.deleters().deleteRecurringSeries("T");
    expect(e.row("T")).toBeTruthy();
    expect(e.row("T").recurring).toBeNull();
    expect(e.row("T").description).toBeNull();
    expect(e.row("K")).toBeUndefined();
    await e.last().undo();
    expect(e.row("T").recurring).toBe("Daily");
    expect(e.row("T").description).toBe("__recurring_skip:2026-09-17");
    expect(e.state.rows.filter((r) => r.description === "__recurring_from:T")).toHaveLength(1);
  });
  it("undo re-links restored children to the template's NEW id (no orphans / no duplicate spawn)", async () => {
    const e = makeEnv([
      { id: "T", recurring: "Daily", due_date: "2026-09-10" },
      { id: "K", description: "__recurring_from:T", due_date: TODAY },
    ]);
    await e.deleters().deleteRecurringSeries("T");
    expect(e.ids()).toEqual([]);
    await e.last().undo();
    const tpl = e.state.rows.find((r) => r.recurring === "Daily");
    const kid = e.state.rows.find((r) => r.due_date === TODAY);
    expect(tpl).toBeTruthy();
    expect(tpl.id).not.toBe("T");
    expect(kid.description).toBe(`__recurring_from:${tpl.id}`);
    expect(findActiveTemplate(e.state.rows, kid)).toEqual(tpl);
  });
  it("failure shows Retry; Retry after a partial outcome is safe", async () => {
    const e = makeEnv([
      { id: "T", recurring: "Daily", due_date: "2026-09-10" },
      { id: "K", description: "__recurring_from:T", due_date: TODAY },
    ], { removeMany: true });
    const d = e.deleters();
    await d.deleteRecurringSeries("T");
    expect(e.last().label).toBe("Retry");
    expect(e.ids()).toEqual(["K", "T"]);
    // network is back; the Retry closure (stale snapshot) still works
    const retry = e.last().undo;
    e.tasksQ.removeMany.mockImplementation(async (ids) => { e.state.rows = e.state.rows.filter((r) => !ids.includes(r.id)); return true; });
    await retry();
    expect(e.ids()).toEqual([]);
  });
  it("series on an orphaned child (template already gone) just deletes it — no silent no-op", async () => {
    const e = makeEnv([{ id: "K", description: "__recurring_from:GONE", due_date: TODAY }]);
    await e.deleters().deleteTask("K", "series");
    expect(e.ids()).toEqual([]);
  });
});

describe("children, just this one", () => {
  it("today's child: skip is recorded on the template BEFORE removal; undo un-skips", async () => {
    const e = makeEnv([
      { id: "T", recurring: "Daily", due_date: "2026-09-10", description: "__recurring_skip:2026-09-15" },
      { id: "K", description: "__recurring_from:T", due_date: TODAY },
    ]);
    await e.deleters().deleteTask("K", "occurrence");
    expect(e.row("K")).toBeUndefined();
    expect(parseRecurringSkipDates(e.row("T").description)).toEqual(["2026-09-15", TODAY]);
    await e.last().undo();
    expect(e.row("T").description).toBe("__recurring_skip:2026-09-15");
    expect(e.state.rows.some((r) => r.description === "__recurring_from:T")).toBe(true);
  });
  it("old completed child: removed without touching the template", async () => {
    const e = makeEnv([
      { id: "T", recurring: "Daily", due_date: "2026-09-01" },
      { id: "K", description: "__recurring_from:T", due_date: "2026-09-05", status: "Completed" },
    ]);
    await e.deleters().deleteTask("K", "occurrence");
    expect(e.row("K")).toBeUndefined();
    expect(e.tasksQ.update).not.toHaveBeenCalled();
  });
  it("template update failure blocks removal and offers Retry (no respawn-on-reload trap)", async () => {
    const e = makeEnv([
      { id: "T", recurring: "Daily", due_date: "2026-09-10" },
      { id: "K", description: "__recurring_from:T", due_date: TODAY },
    ], { update: true });
    await e.deleters().deleteTask("K", "occurrence");
    expect(e.last().label).toBe("Retry");
    expect(e.row("K")).toBeTruthy();
  });
  it("child of a Stop-ped template deletes like a plain task", async () => {
    const e = makeEnv([
      { id: "T", recurring: null, due_date: "2026-09-10" },
      { id: "K", description: "__recurring_from:T", due_date: TODAY },
    ]);
    await e.deleters().deleteTask("K", "occurrence");
    expect(e.row("K")).toBeUndefined();
    expect(e.tasksQ.update).not.toHaveBeenCalled();
  });
});
