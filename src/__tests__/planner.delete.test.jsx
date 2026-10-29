import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import PlannerPage from "../pages/Planner";
import { todayIST } from "../lib/dateIST";
import { addDaysToDateStr } from "../lib/recurring";

afterEach(cleanup);

const TODAY = todayIST();
const PAST = addDaysToDateStr(TODAY, -10);

const t = (over) => ({
  id: over.id, title: over.id, subject: "Physics", priority: "Medium", category: "Study",
  status: "Pending", due_date: TODAY, recurring: null, description: null, ...over,
});

function setup(tasks) {
  const props = {
    tasks, mascot: "bunny", streakActiveToday: false,
    addTask: vi.fn(), toggleTask: vi.fn(), updateTask: vi.fn(),
    deleteTask: vi.fn(), deleteRecurringSeries: vi.fn(),
  };
  render(<PlannerPage {...props} />);
  return props;
}
// The Repeating tasks card repeats a template's title, so pick the one inside a task row.
const rowOf = (title) => screen.getAllByText(title).map((el) => el.closest(".sb-task-row")).find(Boolean);
const clickDelete = (title) => fireEvent.click(within(rowOf(title)).getByTitle("Delete task"));

describe("Planner delete flows", () => {
  it("plain task deletes immediately, no dialog", () => {
    const p = setup([t({ id: "plain" })]);
    clickDelete("plain");
    expect(p.deleteTask).toHaveBeenCalledWith("plain");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("today's spawned child asks: just today vs entire series", () => {
    const p = setup([
      t({ id: "tpl", recurring: "Daily", due_date: PAST }),
      t({ id: "kid", description: "__recurring_from:tpl" }),
    ]);
    clickDelete("kid");
    const dlg = screen.getByRole("dialog");
    fireEvent.click(within(dlg).getByText("Just today"));
    expect(p.deleteTask).toHaveBeenLastCalledWith("kid", "occurrence");
    expect(screen.queryByRole("dialog")).toBeNull();

    clickDelete("kid");
    fireEvent.click(within(screen.getByRole("dialog")).getByText("Entire series"));
    expect(p.deleteTask).toHaveBeenLastCalledWith("kid", "series");
  });

  it("stale hidden template is reachable from the Repeating tasks card and hard-deletes", () => {
    const p = setup([t({ id: "ghost", recurring: "Daily", due_date: PAST })]);
    // hidden from the dated groups (that's the original 'no option' bug)...
    expect(screen.queryByTitle("Delete task")).toBeNull();
    // ...but the card always lists it
    fireEvent.click(screen.getByTitle("Stop repeating forever"));
    const dlg = screen.getByRole("dialog");
    expect(within(dlg).queryByText("Just today")).toBeNull();
    fireEvent.click(within(dlg).getByText("Delete forever"));
    expect(p.deleteRecurringSeries).toHaveBeenCalledWith("ghost");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Completed template: only 'Stop repeating' (row is kept), never a today option", () => {
    const p = setup([t({ id: "done-tpl", recurring: "Daily", status: "Completed", due_date: PAST })]);
    fireEvent.click(document.querySelector(".sb-plan-completed-head")); // open the Completed list
    clickDelete("done-tpl");
    const dlg = screen.getByRole("dialog");
    expect(within(dlg).queryByText("Just today")).toBeNull();
    fireEvent.click(within(dlg).getByText("Stop repeating"));
    expect(p.deleteTask).toHaveBeenCalledWith("done-tpl", "series");
  });

  it("future-dated pending template also asks (was a silent whole-series delete)", () => {
    const p = setup([t({ id: "fut", recurring: "Daily", due_date: addDaysToDateStr(TODAY, 1) })]);
    fireEvent.click(screen.getByText("Tomorrow")); // future groups start collapsed
    clickDelete("fut");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(p.deleteTask).not.toHaveBeenCalled();
  });

  it("orphaned child (template gone) is a plain row: no badge, immediate delete", () => {
    const p = setup([t({ id: "orphan", description: "__recurring_from:missing" })]);
    expect(within(rowOf("orphan")).queryByTitle("Spawned from a repeating task")).toBeNull();
    clickDelete("orphan");
    expect(p.deleteTask).toHaveBeenCalledWith("orphan");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Escape and backdrop close the dialog without deleting", () => {
    const p = setup([
      t({ id: "tpl", recurring: "Daily", due_date: PAST }),
      t({ id: "kid", description: "__recurring_from:tpl" }),
    ]);
    clickDelete("kid");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    clickDelete("kid");
    fireEvent.mouseDown(document.querySelector(".sb-pt-overlay"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(p.deleteTask).not.toHaveBeenCalled();
    expect(p.deleteRecurringSeries).not.toHaveBeenCalled();
  });
});
