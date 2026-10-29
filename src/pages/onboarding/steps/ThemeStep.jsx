import React from "react";
import { Moon, Sun } from "lucide-react";
import { THEMES, writeStoredDarkMode } from "../../../data/themes";

export default function ThemeStep({ form, setForm }) {
  const setDark = (val) => {
    const next = Boolean(val);
    writeStoredDarkMode(next);
    setForm({ ...form, dark_mode: next });
  };

  return (
    <>
      <div className="sb-flow-step-head">
        <span className="sb-flow-step-icon">🎨</span>
        <label>Pick a theme & appearance</label>
      </div>
      <div className="sb-ob-mode-row" role="radiogroup" aria-label="Appearance mode">
        <button
          type="button"
          className={`sb-ob-mode-btn ${!form.dark_mode ? "active" : ""}`}
          onClick={() => setDark(false)}
        >
          <Sun size={14} /> Light mode
        </button>
        <button
          type="button"
          className={`sb-ob-mode-btn ${form.dark_mode ? "active" : ""}`}
          onClick={() => setDark(true)}
        >
          <Moon size={14} /> Dark mode
        </button>
      </div>
      <div className="sb-ob-theme-grid">
        {Object.entries(THEMES).map(([name, val]) => (
          <button
            key={name}
            type="button"
            className={`sb-ob-theme-swatch ${form.theme === name ? "active" : ""}`}
            style={{ background: val.soft, borderColor: val.accent, "--swatch-accent": val.accent, "--swatch-soft": val.soft, "--swatch-ink": val.ink }}
            onClick={() => setForm({ ...form, theme: name })}
          >
            <span className="sb-ob-theme-dot" style={{ background: val.accent }} />
            {val.emoji} {name}
          </button>
        ))}
      </div>
    </>
  );
}
