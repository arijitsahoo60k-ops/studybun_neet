import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import Dashboard from "../pages/Dashboard";

const CUSTOM = [
  { id: "ce1", name: "AIATS 1", date: "2099-12-01", time: "14:00" },
  { id: "ce2", name: "Allen Major", date: "2099-12-15", time: "09:30" },
];

const baseProps = (over = {}) => ({
  profile: { name: "Ari", exam: "NEET UG", exam_date: "2099-05-02", exam_time: "14:00", daily_goal: 6, custom_exams: [], ...over.profile },
  saveProfile: "saveProfile" in over ? over.saveProfile : vi.fn(),
  todayHours: 0,
  todayLoggedHours: 0,
  todayTimerHours: 0,
  todayQuestions: 0,
  mascot: "Bunny",
  mascotMood: "idle",
  mascotEnergy: 0.6,
  daysToExam: 120,
  streak: 0,
  streakActiveToday: false,
  subjectPie: [],
  backlogItems: [],
  dueRevisions: [],
  overdueRevisions: [],
  weeklyData: [],
  setPage: vi.fn(),
});

const activeTitle = () => document.querySelector(".sb-cd-title.is-active")?.textContent;
const activeDot = () => [...document.querySelectorAll(".sb-cd-dot")].findIndex((d) => d.classList.contains("is-active"));

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Dashboard countdown card slideshow", () => {
  it("with no custom exams: single slide, no dots, never advances", () => {
    render(<Dashboard {...baseProps()} />);
    expect(document.querySelectorAll(".sb-cd-slide")).toHaveLength(1);
    expect(document.querySelector(".sb-cd-dots")).toBeNull();
    act(() => { vi.advanceTimersByTime(20000); });
    expect(activeTitle()).toBe("Countdown to NEET UG");
  });

  it("auto-advances every 4s through every exam and loops back", () => {
    render(<Dashboard {...baseProps({ profile: { custom_exams: CUSTOM } })} />);
    expect(document.querySelectorAll(".sb-cd-slide")).toHaveLength(3);
    expect(activeTitle()).toBe("Countdown to NEET UG");
    act(() => { vi.advanceTimersByTime(3900); });
    expect(activeTitle()).toBe("Countdown to NEET UG");
    act(() => { vi.advanceTimersByTime(200); });
    expect(activeTitle()).toBe("Countdown to AIATS 1");
    act(() => { vi.advanceTimersByTime(4000); });
    expect(activeTitle()).toBe("Countdown to Allen Major");
    act(() => { vi.advanceTimersByTime(4000); });
    expect(activeTitle()).toBe("Countdown to NEET UG");
  });

  it("only the active slide is exposed to assistive tech", () => {
    render(<Dashboard {...baseProps({ profile: { custom_exams: CUSTOM } })} />);
    const slides = [...document.querySelectorAll(".sb-cd-slide")];
    expect(slides.map((s) => s.getAttribute("aria-hidden"))).toEqual(["false", "true", "true"]);
  });

  it("dots jump to a slide and restart the 4s timer", () => {
    render(<Dashboard {...baseProps({ profile: { custom_exams: CUSTOM } })} />);
    act(() => { vi.advanceTimersByTime(3000); });
    fireEvent.click(screen.getByLabelText("Show Allen Major countdown"));
    expect(activeDot()).toBe(2);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(activeDot()).toBe(2); // 3s since click -> not yet
    act(() => { vi.advanceTimersByTime(1100); });
    expect(activeDot()).toBe(0); // wrapped
  });

  it("pauses while the mouse is over the card and resumes after", () => {
    render(<Dashboard {...baseProps({ profile: { custom_exams: CUSTOM } })} />);
    const inner = document.querySelector(".sb-countdown-card > div");
    fireEvent.pointerEnter(inner, { pointerType: "mouse" });
    act(() => { vi.advanceTimersByTime(12000); });
    expect(activeDot()).toBe(0);
    fireEvent.pointerLeave(inner, { pointerType: "mouse" });
    act(() => { vi.advanceTimersByTime(4100); });
    expect(activeDot()).toBe(1);
  });

  it("pauses while the add-custom-exam form is open", () => {
    render(<Dashboard {...baseProps({ profile: { custom_exams: CUSTOM } })} />);
    fireEvent.click(screen.getByText(/Custom exam/));
    act(() => { vi.advanceTimersByTime(12000); });
    expect(activeDot()).toBe(0);
    fireEvent.click(screen.getByText("Cancel"));
    act(() => { vi.advanceTimersByTime(4100); });
    expect(activeDot()).toBe(1);
  });

  it("saving a new exam keeps the existing payload shape and jumps to the new slide", () => {
    const saveProfile = vi.fn();
    render(<Dashboard {...baseProps({ profile: { custom_exams: CUSTOM }, saveProfile })} />);
    fireEvent.click(screen.getByText(/Custom exam/));
    fireEvent.change(screen.getByPlaceholderText(/AIATS 3/), { target: { value: "Pre-Boards" } });
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: "2099-11-11" } });
    fireEvent.click(screen.getByText("Save"));
    expect(saveProfile).toHaveBeenCalledTimes(1);
    const arg = saveProfile.mock.calls[0][0];
    expect(arg.custom_exams).toHaveLength(3);
    expect(arg.custom_exams[2]).toMatchObject({ name: "Pre-Boards", date: "2099-11-11", time: "14:00" });
    expect(arg.custom_exams.slice(0, 2)).toEqual(CUSTOM);
  });

  it("removing from a custom slide calls saveProfile without that exam; main slide has no remove button", () => {
    const saveProfile = vi.fn();
    render(<Dashboard {...baseProps({ profile: { custom_exams: CUSTOM }, saveProfile })} />);
    expect(screen.queryAllByLabelText("Remove custom tracker")).toHaveLength(2); // one per custom slide (hidden ones still in DOM)
    const slides = [...document.querySelectorAll(".sb-cd-slide")];
    expect(slides[0].querySelector(".sb-icon-btn.danger")).toBeNull();
    fireEvent.click(slides[1].querySelector(".sb-icon-btn.danger"));
    expect(saveProfile).toHaveBeenCalledWith({ custom_exams: [CUSTOM[1]] });
  });

  it("shows 'Done' for a custom exam that is already over, and survives a shrinking list", () => {
    const past = [{ id: "p1", name: "Old Test", date: "2020-01-01", time: "10:00" }];
    const { rerender } = render(<Dashboard {...baseProps({ profile: { custom_exams: past } })} />);
    expect(screen.getByText("Done")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Show Old Test countdown"));
    expect(activeDot()).toBe(1);
    rerender(<Dashboard {...baseProps({ profile: { custom_exams: [] } })} />);
    expect(activeTitle()).toBe("Countdown to NEET UG"); // clamped, no crash
  });

  it("hides add/remove controls when saveProfile isn't provided", () => {
    render(<Dashboard {...baseProps({ profile: { custom_exams: CUSTOM }, saveProfile: null })} />);
    expect(screen.queryByText(/Custom exam/)).toBeNull();
    expect(screen.queryAllByLabelText("Remove custom tracker")).toHaveLength(0);
  });

  it("goal + streak cards get the centred-body wrapper", () => {
    render(<Dashboard {...baseProps()} />);
    const cards = document.querySelectorAll(".sb-dash-stat-card");
    expect(cards).toHaveLength(2);
    cards.forEach((c) => expect(c.querySelector(".sb-dash-stat-body")).toBeTruthy());
  });
});
