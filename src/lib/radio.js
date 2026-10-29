// Direct, specific video/livestream IDs — NOT the "live_stream?channel=..."
// lookup trick. That embed only resolves if the channel happens to have an
// active broadcast at the exact moment the iframe loads; the moment a
// channel's stream ends, goes private, or gets taken down (which is exactly
// what happened to Lofi Girl's main stream), the embed just shows "Video
// unavailable" with nothing we can detect or recover from client-side.
// Pinning to a specific, currently-live video id is more reliable, and
// pairing it with "My music" means a dead preset is never a dead end for the
// user.
export const RADIO_OPTIONS = [
  {
    id: "chillhop",
    label: "Chillhop radio",
    hint: "Jazzy chillhop beats — 24/7",
    videoId: "5yx6BWlEVcY",
  },
  {
    id: "lofi-24-7",
    label: "Lofi study radio",
    hint: "24/7 lofi hip hop beats",
    videoId: "uMntpJdjrbM",
  },
];

export const RADIO_LINKS = [
  { label: "Rain sounds", query: "rain sounds for studying 24/7" },
  { label: "Piano lofi", query: "piano lofi study radio" },
  { label: "Synthwave radio", query: "synthwave radio 24/7" },
];

// Sane ceilings so a playlist can't grow without bound (the DB enforces the
// field-length ones too -- see supabase/migration_focus_music.sql).
export const MAX_PLAYLISTS = 12;
export const MAX_TRACKS_PER_PLAYLIST = 50;
export const MAX_PLAYLIST_NAME = 60;

const VIDEO_ID_RE = /^[\w-]{11}$/;

function parseUrl(raw) {
  let input = String(raw || "").trim();
  if (!input) return null;
  // People paste "youtu.be/abc" / "www.youtube.com/..." without a scheme.
  if (!/^https?:\/\//i.test(input)) input = `https://${input}`;
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

// Turns pretty much anything a person might paste — a full watch URL, a
// youtu.be short link, a /live/ or /embed/ link, or just the bare
// 11-character video id — into a proper embeddable video id.
export function extractYouTubeId(raw) {
  if (!raw) return null;
  const input = String(raw).trim();
  if (VIDEO_ID_RE.test(input)) return input; // bare id
  const url = parseUrl(input);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, "");
  let id = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] || null;
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.searchParams.get("v")) {
      id = url.searchParams.get("v");
    } else {
      const parts = url.pathname.split("/").filter(Boolean);
      // /live/VIDEOID , /embed/VIDEOID , /shorts/VIDEOID
      if (["live", "embed", "shorts"].includes(parts[0]) && parts[1]) id = parts[1];
    }
  }
  return id && VIDEO_ID_RE.test(id) ? id : null;
}

// A youtube.com/playlist?list=... link (no single video in it). We can't
// enumerate those without an API key, so callers use this to give a helpful
// message instead of a vague "invalid link".
export function isPlaylistOnlyLink(raw) {
  const url = parseUrl(raw);
  if (!url) return false;
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "music.youtube.com") return false;
  return !!url.searchParams.get("list") && !url.searchParams.get("v") && url.pathname.startsWith("/playlist");
}

export function thumbUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

// Looks a video up through YouTube's public oEmbed endpoint (CORS-enabled,
// no API key). Doubles as validation: 401 = the owner disabled embedding,
// 404 = private/removed/nonexistent. A network hiccup or timeout is NOT
// treated as a bad link -- the track can still be added, just without a
// fetched title (the player itself will report a real problem on play).
export async function fetchVideoMeta(videoId, { fetchImpl, timeoutMs = 6000 } = {}) {
  const doFetch = fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (!doFetch) return { ok: true, title: null, author: null, unverified: true };
  const watch = `https://www.youtube.com/watch?v=${videoId}`;
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`;
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await doFetch(endpoint, ctrl ? { signal: ctrl.signal } : undefined);
    if (res.status === 401) return { ok: false, reason: "unembeddable" };
    if (res.status === 404 || res.status === 400) return { ok: false, reason: "notfound" };
    if (!res.ok) return { ok: true, title: null, author: null, unverified: true };
    const data = await res.json();
    return {
      ok: true,
      title: typeof data.title === "string" ? data.title.slice(0, 200) : null,
      author: typeof data.author_name === "string" ? data.author_name.slice(0, 120) : null,
    };
  } catch {
    return { ok: true, title: null, author: null, unverified: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function ytErrorMessage(code) {
  switch (code) {
    case 2: return "That video link isn't valid.";
    case 5: return "The player hit a snag with this video.";
    case 100: return "This video was removed or is private.";
    case 101:
    case 150:
    case 153: return "The owner doesn't allow this video to play outside YouTube.";
    default: return "This video couldn't be played.";
  }
}

/* ---------------- play order (pure, unit-tested) ---------------- */

// The order tracks will be played in. Without shuffle it's just the list
// order; with shuffle it's a random permutation that keeps the CURRENT
// track first, so turning shuffle on never yanks you off what's playing.
export function buildOrder(ids, currentId, shuffle, rand = Math.random) {
  const list = ids.slice();
  if (!shuffle) return list;
  const rest = list.filter((id) => id !== currentId);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return list.includes(currentId) ? [currentId, ...rest] : rest;
}

// Which track comes next (dir = 1) or previous (dir = -1) after `currentId`.
// `wrap` = whether running off either end wraps around. Returns null when
// there's nowhere to go (end of the list with wrap off) so the caller can
// decide what "the playlist finished" means.
export function stepOrder(order, currentId, dir, wrap) {
  if (!order.length) return null;
  const idx = order.indexOf(currentId);
  if (idx < 0) return order[0];
  const n = idx + dir;
  if (n >= order.length) return wrap ? order[0] : null;
  if (n < 0) return wrap ? order[order.length - 1] : order[0];
  return order[n];
}
