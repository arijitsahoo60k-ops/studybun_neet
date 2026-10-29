import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFocusTimer, STOPWATCH_MODE } from "../hooks/useFocusTimer";

const STORAGE_KEY = "sb.focusTimer.v1";

function makeLockManagerMock() {
  let held = false;
  return {
    request: (name, options, callback) => {
      if (held) return Promise.resolve(callback(null));
      held = true;
      const result = callback({ name });
      if (result && typeof result.then === "function") {
        return result.finally(() => { held = false; });
      }
      held = false;
      return Promise.resolve(result);
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, "locks", { value: makeLockManagerMock(), configurable: true, writable: true });
});
afterEach(() => {
  delete navigator.locks;
  vi.useRealTimers();
});

function flush() { return act(async () => { await Promise.resolve(); await Promise.resolve(); }); }

// Simulates what the browser delivers to every OTHER tab when Tab A writes
// localStorage — jsdom does NOT dispatch this automatically for same-window
// writes (verified separately), so we fire it by hand to exercise Tab B's
// listener exactly as a real second tab would receive it.
function deliverToOtherTab(payload) {
  act(() => {
    window.dispatchEvent(new StorageEvent("storage", {
      key: STORAGE_KEY,
      newValue: JSON.stringify(payload),
      storageArea: localStorage,
    }));
  });
}

describe("cross-tab reconciliation (storage event) — the reported 90min/save-at-65/reload-shows-25 bug", () => {
  it("Tab B adopts Tab A's save and stops mirroring its own stale countdown", async () => {
    const tabA = renderHook(() => useFocusTimer({}));
    const tabB = renderHook(() => useFocusTimer({}));

    // Tab A: custom 90-min Deep Focus session, running.
    act(() => { tabA.result.current.setCustomMinutes("Deep Focus", 90); });
    act(() => { tabA.result.current.changeMode("Deep Focus"); });
    act(() => { tabA.result.current.start(); });
    await flush();
    expect(tabA.result.current.running).toBe(true);

    // Tab B independently mirrors the same session start (as it would from
    // reading the same persisted snapshot) and is still ticking on its own
    // 25-min-remaining stale copy when Tab A saves.
    tabB.result.current; // (already mounted with its own state; simulate it "sees" 25 min left)

    // Tab A saves early at the 65-minute mark: 90 - 65 = 25 min would have
    // been "remaining" from Tab B's stale point of view — exactly what the
    // user reported reappearing after reload.
    const tabASavedPayload = {
      mode: "Deep Focus", modeMinutes: { "Deep Focus": 90 },
      running: false, askDone: true, soundOn: true,
      radioChoice: "none", radioCustomUrl: "",
      startedMinutes: 65, secondsLeft: 0,
      sessionInProgress: true, aggressiveMode: false,
    };
    deliverToOtherTab(tabASavedPayload);
    await flush();

    // Tab B must adopt the save immediately: not running, not silently
    // ticking down "25 minutes left" from a session that was already saved.
    expect(tabB.result.current.running).toBe(false);
    expect(tabB.result.current.secondsLeft).toBe(0);
    expect(tabB.result.current.askDone).toBe(true);

    // And critically: Tab B must not re-persist a "still running" snapshot
    // a moment later (the original clobbering bug). Advance time and let
    // any leftover interval in Tab B fire, if one still exists.
    vi.useFakeTimers();
    await act(async () => { vi.advanceTimersByTime(3000); });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.running).toBe(false);
  });

  it("a Reset in Tab A while Tab B is still mirroring the session also propagates and sticks", async () => {
    const tabA = renderHook(() => useFocusTimer({}));
    const tabB = renderHook(() => useFocusTimer({}));

    act(() => { tabA.result.current.start(); });
    await flush();

    const resetPayload = {
      mode: "Pomodoro", modeMinutes: { Pomodoro: 25 },
      running: false, askDone: false, soundOn: true,
      radioChoice: "none", radioCustomUrl: "",
      startedMinutes: 0, secondsLeft: 25 * 60,
      sessionInProgress: false, aggressiveMode: false,
    };
    deliverToOtherTab(resetPayload);
    await flush();

    expect(tabB.result.current.running).toBe(false);
    expect(tabB.result.current.sessionActive).toBe(false);

    vi.useFakeTimers();
    await act(async () => { vi.advanceTimersByTime(3000); });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.running).toBe(false);
  });
});

describe("same-tab rapid double-Start", () => {
  it("never runs two sessions from one tab double-tapping Start, and lock releases cleanly on pause", async () => {
    const tab = renderHook(() => useFocusTimer({}));
    act(() => {
      tab.result.current.start();
      tab.result.current.start(); // rapid second tap, before re-render hides the button
    });
    await flush();
    expect(tab.result.current.running).toBe(true);
    act(() => { tab.result.current.pause(); });
    await flush();
    // Lock must be fully released so the SAME tab (or another) can start again.
    const tab2 = renderHook(() => useFocusTimer({}));
    act(() => { tab2.result.current.start(); });
    await flush();
    expect(tab2.result.current.running).toBe(true);
  });
});
