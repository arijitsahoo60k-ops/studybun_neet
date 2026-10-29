import { useCallback, useEffect, useState } from "react";

// Device-local cosmetic preference for the Daily Overview page's live clock
// card — which background it shows (theme gradient / photo URL / YouTube
// embed) and which text palette to use over it. Lives in localStorage, same
// reasoning as useCustomBackground: it's a per-device skin for a card meant
// to look good in a screenshot, not study data, so it never touches
// Supabase or the backup export/import.
const STORAGE_KEY = "sb-overview-clock-v2";

export const CLOCK_LIMITS = {
  dim: { min: 0, max: 80, step: 2 },
  brightness: { min: 40, max: 160, step: 2 },
  blur: { min: 0, max: 12, step: 1 },
};

// A small curated set of palettes so the clock digits always stay legible
// against *some* background, no matter what photo/video the user drops in.
// "label" is shown in the picker; "text"/"sub"/"accent" are the CSS colors
// applied to the clock face. Users can still go fully custom via the color
// input, this just gives good one-tap defaults.
export const CLOCK_PALETTES = [
  { key: "cream", label: "Cream", text: "#FFF8EF", sub: "rgba(255,248,239,0.78)", accent: "#FFD98E" },
  { key: "ink", label: "Ink", text: "#26201C", sub: "rgba(38,32,28,0.68)", accent: "#B95732" },
  { key: "gold", label: "Gold", text: "#FFE9B0", sub: "rgba(255,233,176,0.75)", accent: "#FF9AAE" },
  { key: "mint", label: "Mint", text: "#EAF9EE", sub: "rgba(234,249,238,0.75)", accent: "#76B169" },
  { key: "sakura", label: "Sakura", text: "#FFF0F4", sub: "rgba(255,240,244,0.78)", accent: "#FF6FA8" },
  { key: "sky", label: "Sky", text: "#F0F8FF", sub: "rgba(240,248,255,0.78)", accent: "#7388F1" },
];

export const DEFAULT_CLOCK_SETTINGS = {
  bgMode: "theme", // "theme" | "image" | "video"
  imageUrl: "",
  videoUrl: "",
  dim: 30,
  brightness: 100,
  blur: 0,
  palette: "cream",
  customText: "",
  format24h: true,
  showSeconds: true,
};

function clamp(key, val) {
  const lim = CLOCK_LIMITS[key];
  if (!lim) return val;
  const n = Number(val);
  if (Number.isNaN(n)) return DEFAULT_CLOCK_SETTINGS[key];
  return Math.min(lim.max, Math.max(lim.min, n));
}

function readSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_CLOCK_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CLOCK_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CLOCK_SETTINGS,
      ...parsed,
      dim: clamp("dim", parsed.dim ?? DEFAULT_CLOCK_SETTINGS.dim),
      brightness: clamp("brightness", parsed.brightness ?? DEFAULT_CLOCK_SETTINGS.brightness),
      blur: clamp("blur", parsed.blur ?? DEFAULT_CLOCK_SETTINGS.blur),
    };
  } catch {
    return { ...DEFAULT_CLOCK_SETTINGS };
  }
}

function writeSettings(next) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota full — purely cosmetic, fail silently.
  }
}

export function useOverviewClockSettings() {
  const [settings, setSettings] = useState(readSettings);

  // Pick up changes made in another tab (rare, but cheap to support).
  useEffect(() => {
    const onStorage = (e) => { if (!e.key || e.key === STORAGE_KEY) setSettings(readSettings()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const merged = { ...prev, ...patch };
      const next = {
        ...merged,
        dim: clamp("dim", merged.dim),
        brightness: clamp("brightness", merged.brightness),
        blur: clamp("blur", merged.blur),
      };
      writeSettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const next = { ...DEFAULT_CLOCK_SETTINGS };
    writeSettings(next);
    setSettings(next);
  }, []);

  return { settings, update, reset };
}

// Accepts youtu.be, watch?v=, shorts/, and embed/ URLs and returns the bare
// 11-char video ID, or "" if the string doesn't look like a YouTube URL.
export function extractYouTubeId(url) {
  if (!url) return "";
  const patterns = [
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return "";
}
