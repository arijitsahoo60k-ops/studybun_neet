import React, { useEffect, useMemo, useRef, useState } from "react";
import { Settings2, Image as ImageIcon, Youtube, Palette, X, RotateCcw } from "lucide-react";
import { useOverviewClockSettings, CLOCK_PALETTES, extractYouTubeId } from "../hooks/useOverviewClockSettings";
import { SectionTitle } from "./ui";

// IST-pinned "now", ticking every second — independent of the device's own
// timezone, same reasoning as the rest of the app's dateIST helpers, just
// live instead of date-only. Intl does the DST-free IST math for us.
function useISTNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const ist = (now, opts) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...opts }).format(now);

export default function OverviewClockCard() {
  const { settings, update, reset } = useOverviewClockSettings();
  const [panelOpen, setPanelOpen] = useState(false);
  const panelDialogRef = useRef(null);
  const now = useISTNow();

  // Same Escape-to-close + initial-focus pattern as Focus Timer's "Timer
  // Settings" dialog (see FocusTimer.jsx) and the Periodic Table's element
  // dialog -- so every popup dialog in the app behaves identically.
  useEffect(() => {
    if (!panelOpen) return;
    panelDialogRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") setPanelOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  // hourCycle: "h23" (rather than hour12: false) is the more explicit way
  // to ask for 0-23 — some browser/ICU combinations have historically
  // rendered midnight as "24" instead of "00" with hour12: false. The
  // `% 24` below is a cheap belt-and-suspenders guard against that same
  // class of bug even if it slips through on some engine.
  const hour24 = Number(ist(now, { hour: "2-digit", hourCycle: "h23" })) % 24;
  // Intl's `minute: "2-digit"` / `second: "2-digit"` only actually
  // zero-pads when formatted alongside an hour field — asked for on its
  // own (as here, since hour/minute/second are rendered as separate JSX
  // spans) it silently returns the un-padded number ("8" instead of "08").
  // Padding manually sidesteps that rather than relying on Intl for it.
  const minute = String(Number(ist(now, { minute: "numeric" }))).padStart(2, "0");
  const second = String(Number(ist(now, { second: "numeric" }))).padStart(2, "0");
  const hourDisplay = settings.format24h
    ? String(hour24).padStart(2, "0")
    : String(hour24 % 12 === 0 ? 12 : hour24 % 12).padStart(2, "0");
  const ampm = hour24 < 12 ? "AM" : "PM";
  const weekday = ist(now, { weekday: "long" });
  const dateLine = ist(now, { day: "numeric", month: "long", year: "numeric" });

  const palette = useMemo(() => {
    if (settings.customText) {
      return { text: settings.customText, sub: `${settings.customText}CC`, accent: settings.customText };
    }
    return CLOCK_PALETTES.find((p) => p.key === settings.palette) || CLOCK_PALETTES[0];
  }, [settings.palette, settings.customText]);

  const ytId = settings.bgMode === "video" ? extractYouTubeId(settings.videoUrl) : "";

  const bgFilter = `brightness(${settings.brightness}%) blur(${settings.blur}px)`;

  return (
    <div className="sb-clock-card">
      <div className="sb-clock-bg" aria-hidden="true">
        {settings.bgMode === "image" && settings.imageUrl && (
          <div className="sb-clock-bg-img" style={{ backgroundImage: `url("${settings.imageUrl.replace(/"/g, '\\"')}")`, filter: bgFilter }} />
        )}
        {settings.bgMode === "video" && ytId && (
          <div className="sb-clock-bg-video" style={{ filter: bgFilter }}>
            <iframe
              key={ytId}
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&showinfo=0&modestbranding=1&rel=0&disablekb=1&playsinline=1`}
              title="Clock card background video"
              allow="autoplay; encrypted-media"
              frameBorder="0"
            />
          </div>
        )}
        {(settings.bgMode === "theme" || (settings.bgMode === "image" && !settings.imageUrl) || (settings.bgMode === "video" && !ytId)) && (
          <div className="sb-clock-bg-theme" />
        )}
        <div className="sb-clock-bg-dim" style={{ opacity: settings.dim / 100 }} />
      </div>

      <button
        type="button"
        className="sb-clock-settings-btn"
        style={{ color: palette.text }}
        onClick={() => setPanelOpen((v) => !v)}
        title="Customize clock card"
        aria-label="Customize clock card"
      >
        {panelOpen ? <X size={16} /> : <Settings2 size={16} />}
      </button>

      <div className="sb-clock-face" style={{ color: palette.text }}>
        <div className="sb-clock-time">
          {hourDisplay}<span className="sb-clock-colon" style={{ color: palette.accent }}>:</span>{minute}
          {settings.showSeconds && (
            <span className="sb-clock-seconds" style={{ color: palette.sub }}>
              <span className="sb-clock-colon" style={{ color: palette.accent }}>:</span>{second}
            </span>
          )}
          {!settings.format24h && <span className="sb-clock-ampm" style={{ color: palette.sub }}>{ampm}</span>}
        </div>
        <div className="sb-clock-date" style={{ color: palette.sub }}>{weekday}, {dateLine}</div>
        <div className="sb-clock-tz" style={{ color: palette.sub, borderColor: palette.sub }}>IST · India</div>
      </div>

      {panelOpen && (
        <div className="sb-pt-overlay sb-clock-settings-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setPanelOpen(false); }}>
        <div
          className="sb-pt-dialog sb-clock-settings-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Customize clock card"
          ref={panelDialogRef}
          tabIndex={-1}
        >
          <button className="sb-pt-dialog-close" title="Close" aria-label="Close" onClick={() => setPanelOpen(false)}>
            <X size={15} />
          </button>
          <SectionTitle icon={Settings2}>Clock Card</SectionTitle>
          <div className="sb-clock-panel">
          <div className="sb-clock-panel-row sb-clock-panel-modes">
            <button type="button" className={`sb-clock-mode-chip ${settings.bgMode === "theme" ? "active" : ""}`} onClick={() => update({ bgMode: "theme" })}>
              <Palette size={13} /> Theme
            </button>
            <button type="button" className={`sb-clock-mode-chip ${settings.bgMode === "image" ? "active" : ""}`} onClick={() => update({ bgMode: "image" })}>
              <ImageIcon size={13} /> Image
            </button>
            <button type="button" className={`sb-clock-mode-chip ${settings.bgMode === "video" ? "active" : ""}`} onClick={() => update({ bgMode: "video" })}>
              <Youtube size={13} /> YouTube
            </button>
          </div>

          {settings.bgMode === "image" && (
            <input
              type="text"
              className="sb-clock-panel-input"
              placeholder="Paste an image URL…"
              value={settings.imageUrl}
              onChange={(e) => update({ imageUrl: e.target.value })}
            />
          )}
          {settings.bgMode === "video" && (
            <input
              type="text"
              className="sb-clock-panel-input"
              placeholder="Paste a YouTube video URL…"
              value={settings.videoUrl}
              onChange={(e) => update({ videoUrl: e.target.value })}
            />
          )}

          <div className="sb-clock-panel-label">Text colour</div>
          <div className="sb-clock-panel-row sb-clock-palette-row">
            {CLOCK_PALETTES.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`sb-clock-swatch ${!settings.customText && settings.palette === p.key ? "active" : ""}`}
                style={{ background: p.text, borderColor: p.accent }}
                title={p.label}
                onClick={() => update({ palette: p.key, customText: "" })}
              />
            ))}
            <label className="sb-clock-swatch sb-clock-swatch-custom" title="Custom colour" style={{ background: settings.customText || "conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red)" }}>
              <input
                type="color"
                value={settings.customText || "#ffffff"}
                onChange={(e) => update({ customText: e.target.value })}
              />
            </label>
          </div>

          <div className="sb-clock-panel-label">Darken background: {settings.dim}%</div>
          <input type="range" min={0} max={80} step={2} value={settings.dim} onChange={(e) => update({ dim: Number(e.target.value) })} />

          {settings.bgMode === "image" && (
            <>
              <div className="sb-clock-panel-label">Brightness: {settings.brightness}%</div>
              <input type="range" min={40} max={160} step={2} value={settings.brightness} onChange={(e) => update({ brightness: Number(e.target.value) })} />
            </>
          )}

          <div className="sb-clock-panel-row sb-clock-panel-toggles">
            <button type="button" className={`sb-clock-mode-chip ${settings.format24h ? "active" : ""}`} onClick={() => update({ format24h: !settings.format24h })}>
              {settings.format24h ? "24h" : "12h"}
            </button>
            <button type="button" className={`sb-clock-mode-chip ${settings.showSeconds ? "active" : ""}`} onClick={() => update({ showSeconds: !settings.showSeconds })}>
              Seconds {settings.showSeconds ? "on" : "off"}
            </button>
            <button type="button" className="sb-clock-mode-chip sb-clock-reset" onClick={reset}>
              <RotateCcw size={12} /> Reset
            </button>
          </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
