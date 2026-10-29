import { useCallback, useEffect, useState } from "react";

// Bumping this key (not the app's Supabase schema) is enough if the shape
// ever needs to change — old/garbage values just get merged over by
// DEFAULT_BG_SETTINGS below and self-heal on next write.
const STORAGE_KEY = "sb-custom-bg-v1";
const EVENT_NAME = "sb-custom-bg-change";

export const BG_LIMITS = {
  brightness: { min: 40, max: 160, step: 2 },
  blur: { min: 0, max: 20, step: 1 },
  saturate: { min: 0, max: 200, step: 5 },
  dim: { min: 0, max: 80, step: 2 },
};

export const DEFAULT_BG_SETTINGS = {
  enabled: false,
  url: "",
  brightness: 100,
  blur: 0,
  saturate: 100,
  dim: 20,
};

function clamp(key, val) {
  const lim = BG_LIMITS[key];
  if (!lim) return val;
  const n = Number(val);
  if (Number.isNaN(n)) return DEFAULT_BG_SETTINGS[key];
  return Math.min(lim.max, Math.max(lim.min, n));
}

function readSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_BG_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BG_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_BG_SETTINGS,
      ...parsed,
      brightness: clamp("brightness", parsed.brightness ?? DEFAULT_BG_SETTINGS.brightness),
      blur: clamp("blur", parsed.blur ?? DEFAULT_BG_SETTINGS.blur),
      saturate: clamp("saturate", parsed.saturate ?? DEFAULT_BG_SETTINGS.saturate),
      dim: clamp("dim", parsed.dim ?? DEFAULT_BG_SETTINGS.dim),
    };
  } catch {
    return { ...DEFAULT_BG_SETTINGS };
  }
}

function writeSettings(next) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private-mode / quota-full localStorage: the preference just won't
    // survive a reload this session. Nothing else in the app depends on
    // this write succeeding, so fail silently rather than surface an error
    // for a purely cosmetic setting.
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
}

/**
 * Device-local "custom background image" preference used by the Settings >
 * Background card and <CustomBackgroundLayer />. Deliberately lives in
 * localStorage rather than the Supabase `profiles` row: it's a per-device
 * cosmetic skin, not study data, so it can never collide with backup
 * import/export, profile sync, or the account's schema.
 *
 * Any component can call this hook — writes from one instance (e.g. the
 * Settings card) are broadcast via a same-tab CustomEvent + the standard
 * cross-tab `storage` event, so every mounted instance (e.g. the layer
 * painting the actual background) re-renders immediately without any prop
 * drilling through App.jsx.
 */
export function useCustomBackground() {
  const [settings, setSettingsState] = useState(readSettings);

  useEffect(() => {
    const onLocalChange = (e) => setSettingsState(e.detail ? { ...e.detail } : readSettings());
    const onStorage = (e) => { if (!e.key || e.key === STORAGE_KEY) setSettingsState(readSettings()); };
    window.addEventListener(EVENT_NAME, onLocalChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onLocalChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((patch) => {
    setSettingsState((prev) => {
      const merged = { ...prev, ...patch };
      const next = {
        ...merged,
        brightness: clamp("brightness", merged.brightness),
        blur: clamp("blur", merged.blur),
        saturate: clamp("saturate", merged.saturate),
        dim: clamp("dim", merged.dim),
      };
      writeSettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const next = { ...DEFAULT_BG_SETTINGS };
    writeSettings(next);
    setSettingsState(next);
  }, []);

  return { settings, update, reset };
}
