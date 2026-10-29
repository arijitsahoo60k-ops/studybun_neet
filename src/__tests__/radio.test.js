import { describe, it, expect } from "vitest";
import {
  extractYouTubeId, isPlaylistOnlyLink, buildOrder, stepOrder, fetchVideoMeta, ytErrorMessage,
} from "../lib/radio";

describe("extractYouTubeId", () => {
  const id = "dQw4w9WgXcQ";
  it.each([
    [id],
    [`https://www.youtube.com/watch?v=${id}`],
    [`https://www.youtube.com/watch?v=${id}&list=PLabc&index=3`],
    [`https://youtu.be/${id}?si=xyz`],
    [`https://m.youtube.com/watch?v=${id}`],
    [`https://music.youtube.com/watch?v=${id}`],
    [`https://www.youtube.com/live/${id}?feature=share`],
    [`https://www.youtube.com/embed/${id}`],
    [`https://www.youtube.com/shorts/${id}`],
    [`youtu.be/${id}`],
    [`  www.youtube.com/watch?v=${id}  `],
  ])("reads %s", (input) => {
    expect(extractYouTubeId(input)).toBe(id);
  });

  it.each([[""], [null], ["hello world"], ["https://example.com/watch?v=dQw4w9WgXcQ"], ["https://www.youtube.com/watch?v=short"], ["https://www.youtube.com/playlist?list=PL123"]])(
    "rejects %s", (input) => { expect(extractYouTubeId(input)).toBeNull(); }
  );
});

describe("isPlaylistOnlyLink", () => {
  it("flags whole-playlist links but not a video inside a playlist", () => {
    expect(isPlaylistOnlyLink("https://www.youtube.com/playlist?list=PL123")).toBe(true);
    expect(isPlaylistOnlyLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123")).toBe(false);
    expect(isPlaylistOnlyLink("nonsense")).toBe(false);
  });
});

describe("play order", () => {
  const ids = ["a", "b", "c", "d"];
  it("keeps list order without shuffle", () => {
    expect(buildOrder(ids, "b", false)).toEqual(ids);
  });
  it("shuffle is a permutation that starts on the current track", () => {
    for (let i = 0; i < 20; i++) {
      const o = buildOrder(ids, "c", true);
      expect(o[0]).toBe("c");
      expect(o.slice().sort()).toEqual(ids);
    }
  });
  it("steps forward, wraps when asked, and reports the end when not", () => {
    expect(stepOrder(ids, "a", 1, false)).toBe("b");
    expect(stepOrder(ids, "d", 1, true)).toBe("a");
    expect(stepOrder(ids, "d", 1, false)).toBeNull();
  });
  it("steps back, wrapping to the last track or staying on the first", () => {
    expect(stepOrder(ids, "c", -1, true)).toBe("b");
    expect(stepOrder(ids, "a", -1, true)).toBe("d");
    expect(stepOrder(ids, "a", -1, false)).toBe("a");
  });
  it("falls back to the first track if current isn't in the order, and handles empty", () => {
    expect(stepOrder(ids, "zzz", 1, true)).toBe("a");
    expect(stepOrder([], "a", 1, true)).toBeNull();
  });
});

describe("fetchVideoMeta (oEmbed)", () => {
  const mk = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });
  it("returns title + author", async () => {
    const r = await fetchVideoMeta("dQw4w9WgXcQ", { fetchImpl: mk(200, { title: "T", author_name: "A" }) });
    expect(r).toEqual({ ok: true, title: "T", author: "A" });
  });
  it("401 = embedding disabled, 404 = not found", async () => {
    expect(await fetchVideoMeta("dQw4w9WgXcQ", { fetchImpl: mk(401) })).toEqual({ ok: false, reason: "unembeddable" });
    expect(await fetchVideoMeta("dQw4w9WgXcQ", { fetchImpl: mk(404) })).toEqual({ ok: false, reason: "notfound" });
  });
  it("a network failure doesn't reject the link, it just has no title", async () => {
    const r = await fetchVideoMeta("dQw4w9WgXcQ", { fetchImpl: async () => { throw new Error("offline"); } });
    expect(r.ok).toBe(true);
    expect(r.title).toBeNull();
  });
});

describe("ytErrorMessage", () => {
  it("has a friendly message for every documented code", () => {
    [2, 5, 100, 101, 150, 999].forEach((c) => expect(ytErrorMessage(c)).toMatch(/\w/));
  });
});
