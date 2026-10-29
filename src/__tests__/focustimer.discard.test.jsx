import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFocusTimer } from "../hooks/useFocusTimer";

// A finished session is auto-logged (onComplete) the instant the timer ends,
// before the "What did you study?" card is answered. These tests pin down
// that discarding it (Discard button, or Reset while the card is up) tells
// the app to remove that row, while keeping it (Save) or resetting a
// never-logged running session does not.

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function finishOneMinuteSession(hook) {
  act(() => { hook.result.current.setCustomMinutes("Pomodoro", 1); });
  act(() => { hook.result.current.start(); });
  act(() => { vi.advanceTimersByTime(61_000); });
  expect(hook.result.current.askDone).toBe(true);
}

describe("discarding an auto-logged focus session", () => {
  it("Discard reports discarded:true and clears the log card", () => {
    const onComplete = vi.fn();
    const onSessionSettled = vi.fn();
    const hook = renderHook(() => useFocusTimer({ onComplete, onSessionSettled }));
    finishOneMinuteSession(hook);
    expect(onComplete).toHaveBeenCalledTimes(1);

    act(() => { hook.result.current.discardSession(); });
    expect(onSessionSettled).toHaveBeenCalledTimes(1);
    expect(onSessionSettled).toHaveBeenCalledWith({ discarded: true });
    expect(hook.result.current.askDone).toBe(false);
    expect(hook.result.current.sessionActive).toBe(false);
  });

  it("Save session reports discarded:false (row is kept)", () => {
    const onSessionSettled = vi.fn();
    const hook = renderHook(() => useFocusTimer({ onComplete: vi.fn(), onSessionSettled }));
    finishOneMinuteSession(hook);

    act(() => { hook.result.current.resetForNewSession(); });
    expect(onSessionSettled).toHaveBeenCalledWith({ discarded: false });
    expect(hook.result.current.askDone).toBe(false);
  });

  it("Reset while the log card is up also discards the logged row", () => {
    const onSessionSettled = vi.fn();
    const hook = renderHook(() => useFocusTimer({ onComplete: vi.fn(), onSessionSettled }));
    finishOneMinuteSession(hook);

    act(() => { hook.result.current.reset(); });
    expect(onSessionSettled).toHaveBeenCalledWith({ discarded: true });
    expect(hook.result.current.askDone).toBe(false);
  });

  it("Reset on a running (never logged) session does not delete anything", () => {
    const onSessionSettled = vi.fn();
    const hook = renderHook(() => useFocusTimer({ onComplete: vi.fn(), onSessionSettled }));
    act(() => { hook.result.current.start(); });
    act(() => { hook.result.current.reset(); });
    expect(onSessionSettled).not.toHaveBeenCalled();
  });
});

describe("late finish is dated when the timer really ended", () => {
  const KEY = "sb.focusTimer.v1";

  it("on-time finish sends no endedAt (DB default now() is untouched)", () => {
    const onComplete = vi.fn();
    const hook = renderHook(() => useFocusTimer({ onComplete }));
    finishOneMinuteSession(hook);
    expect(onComplete.mock.calls[0][0].endedAt).toBeNull();
    expect(hook.result.current.finishedAt).toBeNull();
  });

  it("app reopened long after the end time reports the real end time", () => {
    vi.setSystemTime(new Date("2026-10-08T01:00:00+05:30")); // reopened next day, 1am IST
    const endAt = new Date("2026-10-07T23:50:00+05:30").getTime(); // timer ended 11:50pm
    localStorage.setItem(KEY, JSON.stringify({
      mode: "Pomodoro", running: true, endAt, startedMinutes: 25, sessionInProgress: true,
      secondsLeft: 600, modeMinutes: { Pomodoro: 25 },
    }));
    const onComplete = vi.fn();
    const hook = renderHook(() => useFocusTimer({ onComplete }));
    act(() => { vi.advanceTimersByTime(1100); });
    expect(hook.result.current.askDone).toBe(true);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].endedAt).toBe(new Date(endAt).toISOString());
    expect(hook.result.current.finishedAt).toBe(new Date(endAt).toISOString());
    // survives a reload while the card is still up
    expect(JSON.parse(localStorage.getItem(KEY)).finishedAt).toBe(new Date(endAt).toISOString());
  });

  it("finishedAt clears on Save and on Discard", () => {
    vi.setSystemTime(new Date("2026-10-08T01:00:00+05:30"));
    const endAt = new Date("2026-10-07T23:50:00+05:30").getTime();
    const seed = () => localStorage.setItem(KEY, JSON.stringify({
      mode: "Pomodoro", running: true, endAt, startedMinutes: 25, sessionInProgress: true, secondsLeft: 600, modeMinutes: { Pomodoro: 25 },
    }));
    for (const action of ["resetForNewSession", "discardSession"]) {
      seed();
      const hook = renderHook(() => useFocusTimer({ onComplete: vi.fn() }));
      act(() => { vi.advanceTimersByTime(1100); });
      expect(hook.result.current.finishedAt).not.toBeNull();
      act(() => { hook.result.current[action](); });
      expect(hook.result.current.finishedAt).toBeNull();
      hook.unmount();
    }
  });
});
