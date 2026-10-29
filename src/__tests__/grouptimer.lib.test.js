import { describe, it, expect } from "vitest";
import {
  sanitizeMeta, pickMeta, liveElapsed, fmtClock, normalizeCode, prettyCode, luminance, plateFor, isValidHex,
  loadGtSettings, saveGtSettings,
} from "../lib/groupTimer";

describe("group timer lib", () => {
  it("sanitizes hostile presence payloads", () => {
    const m = sanitizeMeta({ phase: "hax", studying: true, subject: "x".repeat(99), topic: "  a   b ", elapsed: -5, total: "nope", sentAt: 5 });
    expect(m.phase).toBe("studying");
    expect(m.subject.length).toBe(24);
    expect(m.topic).toBe("a b");
    expect(m.elapsed).toBe(0);
    expect(m.total).toBeNull();
    expect(sanitizeMeta(null)).toBeNull();
  });

  it("prefers a studying entry, else the newest", () => {
    const a = { phase: "idle", sentAt: 9 };
    const b = { phase: "studying", sentAt: 1, elapsed: 10 };
    expect(pickMeta([a, b]).phase).toBe("studying");
    expect(pickMeta([{ phase: "idle", sentAt: 1 }, { phase: "paused", sentAt: 2 }]).phase).toBe("paused");
    expect(pickMeta([])).toBeNull();
  });

  it("rejoining shows the TRUE elapsed time, not a restart (anchor based)", () => {
    const m = { phase: "studying", elapsed: 0, anchor: 1_000_000 };
    expect(liveElapsed(m, 1_000_000 + 754_000)).toBe(754);       // joined 12:34 after they started
    expect(liveElapsed(m, 1_000_000 - 5_000)).toBe(0);            // never negative
  });

  it("a stale same-tab entry can't outvote the newest one (pause must show)", () => {
    const stale = { tab: "t1", phase: "studying", sentAt: 1, anchor: 5 };
    const fresh = { tab: "t1", phase: "paused", sentAt: 9, elapsed: 300 };
    expect(pickMeta([stale, fresh]).phase).toBe("paused");
    // but studying on another device still wins
    expect(pickMeta([{ tab: "p", phase: "studying", sentAt: 1 }, { tab: "l", phase: "idle", sentAt: 9 }]).phase).toBe("studying");
  });

  it("ticks elapsed locally only while studying", () => {
    expect(liveElapsed({ phase: "studying", elapsed: 60, receivedAt: 1000 }, 6000)).toBe(65);
    expect(liveElapsed({ phase: "paused", elapsed: 60, receivedAt: 1000 }, 99000)).toBe(60);
  });

  it("formats clocks and codes", () => {
    expect(fmtClock(65)).toBe("01:05");
    expect(fmtClock(3725)).toBe("1:02:05");
    expect(normalizeCode("abc-12 3x")).toBe("ABC123");
    expect(prettyCode("ABC123")).toBe("ABC-123");
  });

  it("flips the plate for dark timer colours", () => {
    expect(isValidHex("#fff")).toBe(false);
    expect(luminance("#000000")).toBeLessThan(0.05);
    expect(plateFor("#111111").background).toContain("255");
    expect(plateFor("#FFFFFF").background).toContain("10,10,18");
  });

  it("persists settings and rejects junk", () => {
    localStorage.clear();
    expect(loadGtSettings().gif).toBe("star");
    saveGtSettings({ gif: "sneakers", color: "#FF9AAE" });
    expect(loadGtSettings()).toEqual({ gif: "sneakers", color: "#FF9AAE" });
    localStorage.setItem("sb.groupTimer.settings.v1", JSON.stringify({ gif: "nope", color: "red" }));
    expect(loadGtSettings()).toEqual({ gif: "star", color: "#FFFFFF" });
  });
});
