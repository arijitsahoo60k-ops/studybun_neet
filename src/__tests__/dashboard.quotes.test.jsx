import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Dashboard, { MOTIVATIONAL } from "../pages/Dashboard";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const baseProps = () => ({
  profile: { name: "Ari", exam: "JEE Advanced", daily_goal: 6 },
  todayHours: 3,
  todayLoggedHours: 2,
  todayTimerHours: 1,
  todayQuestions: 40,
  mascot: "Bunny",
  mascotMood: "idle",
  mascotEnergy: 0.6,
  daysToExam: 120,
  streak: 5,
  streakActiveToday: true,
  subjectPie: [{ name: "Physics", value: 10 }, { name: "Chemistry", value: 5 }],
  backlogItems: [],
  dueRevisions: [],
  overdueRevisions: [],
  weeklyData: [],
  setPage: vi.fn(),
});

describe("Dashboard motivational quote pool", () => {
  it("has a large enough pool that repeats aren't noticeable (>=150 quotes)", () => {
    expect(MOTIVATIONAL.length).toBeGreaterThanOrEqual(150);
  });

  it("contains no duplicate quotes", () => {
    const unique = new Set(MOTIVATIONAL);
    expect(unique.size).toBe(MOTIVATIONAL.length);
  });

  it("keeps every quote non-empty and within a sane display length", () => {
    for (const q of MOTIVATIONAL) {
      expect(typeof q).toBe("string");
      expect(q.trim().length).toBeGreaterThan(10);
      // Generous ceiling so a stray long quote doesn't blow out the
      // hero/pinboard card layout on desktop or mobile.
      expect(q.length).toBeLessThanOrEqual(95);
    }
  });

  it("shows a different quote on consecutive calendar days (no same-date-every-month repeat)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T10:00:00+05:30"));
    const { unmount } = render(<Dashboard {...baseProps()} />);
    const day1 = screen.getByText((_, node) => node?.classList?.contains("sb-quote"))?.textContent;
    unmount();

    vi.setSystemTime(new Date("2026-08-26T10:00:00+05:30"));
    render(<Dashboard {...baseProps()} />);
    const day2 = screen.getByText((_, node) => node?.classList?.contains("sb-quote"))?.textContent;

    expect(day1).toBeTruthy();
    expect(day2).toBeTruthy();
    expect(day1).not.toBe(day2);
  });

  it("does not repeat the same quote on the same day-of-month across different months (regression check)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:00:00+05:30"));
    const { unmount } = render(<Dashboard {...baseProps()} />);
    const jan15 = screen.getByText((_, node) => node?.classList?.contains("sb-quote"))?.textContent;
    unmount();

    vi.setSystemTime(new Date("2026-02-15T10:00:00+05:30"));
    render(<Dashboard {...baseProps()} />);
    const feb15 = screen.getByText((_, node) => node?.classList?.contains("sb-quote"))?.textContent;

    // With the old day-of-month indexing these would always be identical.
    // With 192 quotes and a 31-day month gap, they should now differ.
    expect(jan15).not.toBe(feb15);
  });

  it("renders the same quote in both the hero and the pinboard note on a given day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T10:00:00+05:30"));
    render(<Dashboard {...baseProps()} />);
    const hero = screen.getByText((_, node) => node?.classList?.contains("sb-quote"))?.textContent;
    const pin = document.querySelector(".sb-pin-quote")?.textContent;
    expect(pin).toBe(`"${hero}"`);
  });
});
