import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFocusTimer } from "../hooks/useFocusTimer";

// jsdom has no Web Locks API -- mock just enough of it (ifAvailable mode
// only, which is all this feature uses) to prove the exclusion logic works.
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
});

function flush() { return act(async () => { await Promise.resolve(); await Promise.resolve(); }); }

describe("single-active-timer lock (anti-misuse)", () => {
  it("second tab cannot start its own session while the first is running", async () => {
    const tabA = renderHook(() => useFocusTimer({}));
    const tabB = renderHook(() => useFocusTimer({}));

    act(() => { tabA.result.current.start(); });
    await flush();
    expect(tabA.result.current.running).toBe(true);

    act(() => { tabB.result.current.changeMode("Stopwatch"); });
    act(() => { tabB.result.current.start(); });
    await flush();

    console.log("Tab B running:", tabB.result.current.running, "lockBlocked:", tabB.result.current.lockBlocked);
    expect(tabB.result.current.running).toBe(false);
    expect(tabB.result.current.lockBlocked).toBe(true);
  });

  it("second tab can start once the first releases (pause)", async () => {
    const tabA = renderHook(() => useFocusTimer({}));
    const tabB = renderHook(() => useFocusTimer({}));

    act(() => { tabA.result.current.start(); });
    await flush();

    act(() => { tabB.result.current.start(); });
    await flush();
    expect(tabB.result.current.lockBlocked).toBe(true);

    act(() => { tabA.result.current.pause(); });
    await flush();

    act(() => { tabB.result.current.start(); });
    await flush();
    console.log("After Tab A paused -> Tab B running:", tabB.result.current.running);
    expect(tabB.result.current.running).toBe(true);
  });
});
