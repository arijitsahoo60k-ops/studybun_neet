import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import GoalsPage from "../pages/Goals";

afterEach(cleanup);

const baseGoal = (over = {}) => ({
  id: "g1",
  title: "Finish Physics Rotation chapter",
  deadline: "2026-09-01",
  starred: false,
  notes: "some paragraph note",
  status: "Active",
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});

function setup(goals = []) {
  const addGoal = vi.fn().mockResolvedValue();
  const completeGoal = vi.fn().mockResolvedValue();
  const deleteGoal = vi.fn().mockResolvedValue();
  const updateGoal = vi.fn().mockResolvedValue();
  const utils = render(
    <GoalsPage
      goals={goals}
      addGoal={addGoal}
      completeGoal={completeGoal}
      deleteGoal={deleteGoal}
      updateGoal={updateGoal}
      mascot="Bunny"
    />
  );
  return { ...utils, addGoal, completeGoal, deleteGoal, updateGoal };
}

async function openJournal() {
  fireEvent.click(screen.getByText("My Goals"));
  // AnimatePresence exit/enter transitions are async even at ~0ms duration
  await waitFor(() => expect(screen.getByText("Close")).toBeTruthy(), { timeout: 3000 });
}

describe("Goals journal", () => {
  it("renders the cover with correct counts", () => {
    setup([baseGoal(), baseGoal({ id: "g2", status: "Completed" })]);
    expect(screen.getByText("My Goals")).toBeTruthy();
    expect(screen.getByText("1 in progress")).toBeTruthy();
    expect(screen.getByText("1 done")).toBeTruthy();
  });

  it("opens the journal and shows a paragraph note on an existing goal", async () => {
    setup([baseGoal()]);
    await openJournal();
    expect(await screen.findByText("some paragraph note")).toBeTruthy();
  });

  it("renders bullet-formatted notes as a list", async () => {
    setup([baseGoal({ notes: "• Revise kinematics\n• Solve 20 rotation problems" })]);
    await openJournal();
    const item = await screen.findByText("Revise kinematics");
    expect(item).toBeTruthy();
    expect(screen.getByText("Solve 20 rotation problems")).toBeTruthy();
    const li = item.closest("li");
    expect(li).toBeTruthy();
    const ul = li.closest("ul.sb-goal-notes-list");
    expect(ul).toBeTruthy();
  });

  it("lets the user add bullet points on a new goal and submits them correctly", async () => {
    const { addGoal } = setup([]);
    await openJournal();

    fireEvent.change(await screen.findByPlaceholderText("I want to..."), {
      target: { value: "Crack JEE Mains Physics" },
    });

    fireEvent.click(screen.getByText("Bullets"));

    const firstInput = screen.getByPlaceholderText("First point...");
    fireEvent.change(firstInput, { target: { value: "Finish rotation chapter" } });
    fireEvent.keyDown(firstInput, { key: "Enter" });

    const nextInput = screen.getByPlaceholderText("Next point...");
    fireEvent.change(nextInput, { target: { value: "Do 50 PYQs" } });

    fireEvent.click(screen.getByText("Write this page"));

    expect(addGoal).toHaveBeenCalledTimes(1);
    const arg = addGoal.mock.calls[0][0];
    expect(arg.title).toBe("Crack JEE Mains Physics");
    expect(arg.notes).toBe("• Finish rotation chapter\n• Do 50 PYQs");
  });

  it("removes an empty bullet row on Backspace and refocuses previous row", async () => {
    setup([]);
    await openJournal();
    fireEvent.click(await screen.findByText("Bullets"));

    const firstInput = screen.getByPlaceholderText("First point...");
    fireEvent.change(firstInput, { target: { value: "Point A" } });
    fireEvent.keyDown(firstInput, { key: "Enter" });

    const secondInput = screen.getByPlaceholderText("Next point...");
    expect(screen.getAllByPlaceholderText(/point/i).length).toBe(2);

    fireEvent.keyDown(secondInput, { key: "Backspace" });
    expect(screen.getAllByPlaceholderText(/point/i).length).toBe(1);
  });

  it("does not submit an empty-titled goal, and omits empty notes as null", async () => {
    const { addGoal } = setup([]);
    await openJournal();

    const submitBtn = await screen.findByText("Write this page");
    expect(submitBtn.closest("button").disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("I want to..."), {
      target: { value: "Just a title" },
    });
    fireEvent.click(submitBtn.closest("button"));
    expect(addGoal).toHaveBeenCalledTimes(1);
    expect(addGoal.mock.calls[0][0].notes).toBe(null);
  });

  it("switching from paragraph to bullets carries over existing text as bullets", async () => {
    setup([]);
    await openJournal();
    const textarea = await screen.findByPlaceholderText("Any notes? (optional)");
    fireEvent.change(textarea, { target: { value: "line one\nline two" } });
    fireEvent.click(screen.getByText("Bullets"));
    expect(screen.getByDisplayValue("line one")).toBeTruthy();
    expect(screen.getByDisplayValue("line two")).toBeTruthy();
  });

  it("switching from bullets back to paragraph carries bullets into the textarea", async () => {
    setup([]);
    await openJournal();
    fireEvent.click(await screen.findByText("Bullets"));
    const firstInput = screen.getByPlaceholderText("First point...");
    fireEvent.change(firstInput, { target: { value: "Alpha" } });
    fireEvent.keyDown(firstInput, { key: "Enter" });
    const secondInput = screen.getByPlaceholderText("Next point...");
    fireEvent.change(secondInput, { target: { value: "Beta" } });

    fireEvent.click(screen.getByText("Notes"));
    const textarea = screen.getByPlaceholderText("Any notes? (optional)");
    expect(textarea.value).toBe("Alpha\nBeta");
  });

  it("does not throw when completing a goal (pencil-strike animation path)", async () => {
    const { completeGoal } = setup([baseGoal()]);
    await openJournal();
    const completeBtn = await screen.findByText("Mark complete");
    fireEvent.click(completeBtn.closest("button"));
    await waitFor(() => expect(completeGoal).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });
});

describe("Goals journal — edge cases", () => {
  it("treats legacy multi-line paragraph notes (no bullet marker) as a paragraph, not a list", async () => {
    setup([baseGoal({ notes: "Line one\nLine two" })]);
    await openJournal();
    // Should render as a single <p>, not split into <li> items
    const p = await screen.findByText((content, node) => node.tagName === "P" && node.className === "sb-goal-notes");
    expect(p.textContent).toBe("Line one\nLine two");
    expect(document.querySelector("ul.sb-goal-notes-list")).toBeNull();
  });

  it("omits notes entirely (null) when all bullets are deleted down to empty", async () => {
    const { addGoal } = setup([]);
    await openJournal();
    fireEvent.change(await screen.findByPlaceholderText("I want to..."), {
      target: { value: "Goal with empty bullets" },
    });
    fireEvent.click(screen.getByText("Bullets"));
    const submitBtn = screen.getByText("Write this page").closest("button");
    fireEvent.click(submitBtn);
    expect(addGoal).toHaveBeenCalledTimes(1);
    expect(addGoal.mock.calls[0][0].notes).toBe(null);
  });

  it("resets the bullet editor back to a single empty row after a successful submit", async () => {
    setup([]);
    await openJournal();
    fireEvent.change(await screen.findByPlaceholderText("I want to..."), {
      target: { value: "Goal one" },
    });
    fireEvent.click(screen.getByText("Bullets"));
    fireEvent.change(screen.getByPlaceholderText("First point..."), { target: { value: "Only point" } });
    fireEvent.click(screen.getByText("Write this page"));
    // after submit, GoalsPage re-renders with the new goal and jumps to a fresh blank page;
    // the blank page's bullet editor should be back to a single empty row
    await waitFor(() => {
      expect(screen.getByPlaceholderText("First point...").value).toBe("");
    });
    expect(screen.queryByPlaceholderText("Next point...")).toBeNull();
  });

  it("keeps the star toggle and reopen/complete affordances working alongside notes changes", async () => {
    const { updateGoal, completeGoal } = setup([baseGoal({ status: "Completed", notes: "• Done thing" })]);
    await openJournal();
    expect(await screen.findByText("Reopen")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/star/i));
    expect(updateGoal).toHaveBeenCalledWith("g1", { starred: true });
    fireEvent.click(screen.getByText("Reopen").closest("button"));
    await waitFor(() => expect(completeGoal).toHaveBeenCalledTimes(1));
  });
});
