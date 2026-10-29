import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import FocusTimer from "../pages/FocusTimer";
import { useFocusTimer } from "../hooks/useFocusTimer";

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

function Harness(props) {
  const focusTimer = useFocusTimer({});
  return <FocusTimer focusTimer={focusTimer} mascot="bunny" studyingIds={new Set()} addSession={() => {}} {...props} />;
}

async function flush() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }

describe("FocusTimer page — real render smoke test", () => {
  it("renders idle, starts, opens reset-confirm mid-session, cancels, then confirms reset", async () => {
    render(<Harness />);

    expect(screen.getByText("Start")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Start"));
    await flush();

    expect(screen.getByText("Pause")).toBeInTheDocument();

    // Reset while running -> should open a confirm dialog, not reset instantly.
    fireEvent.click(screen.getByText("Reset"));
    await flush();
    expect(screen.getByText("Reset this session?")).toBeInTheDocument();
    // Session must still be running underneath (not wiped yet).
    expect(screen.getByText("Pause")).toBeInTheDocument();

    // Cancel -> dialog closes, session untouched.
    fireEvent.click(screen.getByText("Cancel"));
    await flush();
    expect(screen.queryByText("Reset this session?")).not.toBeInTheDocument();
    expect(screen.getByText("Pause")).toBeInTheDocument();

    // Reset again, this time confirm.
    fireEvent.click(screen.getByText("Reset"));
    await flush();
    fireEvent.click(screen.getByText("Reset anyway"));
    await flush();

    expect(screen.queryByText("Reset this session?")).not.toBeInTheDocument();
    expect(screen.getByText("Start")).toBeInTheDocument();
  });

  it("info toggle shows and hides the one-browser-only guilt banner, without touching the running session", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Start"));
    await flush();

    expect(screen.queryByText(/quietly lying to a leaderboard/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Why can I only run one timer per device?"));
    await flush();
    expect(screen.getByText(/quietly lying to a leaderboard/i)).toBeInTheDocument();
    // Purely informational -- must not pause/reset the session underneath.
    expect(screen.getByText("Pause")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Close"));
    await flush();
    expect(screen.queryByText(/quietly lying to a leaderboard/i)).not.toBeInTheDocument();
    expect(screen.getByText("Pause")).toBeInTheDocument();
  });

  it("idle Reset (no session) never shows a confirm dialog", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Reset"));
    await flush();
    expect(screen.queryByText("Reset this session?")).not.toBeInTheDocument();
  });

  it("second mounted instance (second tab) is blocked from starting and shows the lock message", async () => {
    // Mount both "tabs" while idle, before either starts anything.
    render(<Harness />);
    render(<Harness />);
    const startButtons = screen.getAllByText("Start");
    expect(startButtons).toHaveLength(2);

    fireEvent.click(startButtons[0]);
    await flush();

    // Tab A now shows Pause; only Tab B's Start button remains in the DOM.
    const remainingStart = screen.getByText("Start");
    fireEvent.click(remainingStart);
    await flush();

    expect(screen.getByText(/already running in another tab\/window/i)).toBeInTheDocument();
  });
});
