import React, { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, CheckCircle2, XCircle, Trash2, Sun, Droplets, Wind, Contrast } from "lucide-react";
import { Card, SectionTitle, Btn } from "../../components/ui";
import { useCustomBackground, BG_LIMITS, DEFAULT_BG_SETTINGS } from "../../hooks/useCustomBackground";

// idle -> nothing typed yet / matches what's already applied
// checking -> preloading the pasted URL to confirm it's a real image
// ok -> preload succeeded, ready to apply (or already applied)
// error -> preload failed
function useUrlPreload(url) {
  const [status, setStatus] = useState("idle");
  const tokenRef = useRef(0);

  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed) { setStatus("idle"); return; }
    const token = ++tokenRef.current;
    setStatus("checking");
    const img = new Image();
    img.onload = () => { if (tokenRef.current === token) setStatus("ok"); };
    img.onerror = () => { if (tokenRef.current === token) setStatus("error"); };
    img.src = trimmed;
    return () => { tokenRef.current++; };
  }, [url]);

  return status;
}

function Slider({ icon: Icon, label, valueLabel, id, min, max, step, value, onChange }) {
  return (
    <div className="sb-bg-slider-row">
      <label htmlFor={id} className="sb-bg-slider-label">
        <Icon size={14} /> {label}
        <span className="sb-bg-slider-value">{valueLabel}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="sb-bg-range"
      />
    </div>
  );
}

export default function BackgroundCard({ currentTheme }) {
  const { settings, update, reset } = useCustomBackground();
  const [draftUrl, setDraftUrl] = useState(settings.url);
  const preloadStatus = useUrlPreload(draftUrl);
  const isDirty = draftUrl.trim() !== (settings.url || "");
  const themeHasOwnPhoto = Boolean(currentTheme?.photoBg);

  // If the setting changes elsewhere (e.g. "Remove background"), keep the
  // input in sync instead of showing a stale URL.
  useEffect(() => { setDraftUrl(settings.url); }, [settings.url]);

  const applyUrl = () => {
    const trimmed = draftUrl.trim();
    if (!trimmed || preloadStatus !== "ok") return;
    update({ url: trimmed, enabled: true });
  };

  const removeBackground = () => {
    setDraftUrl("");
    reset();
  };

  const active = settings.enabled && settings.url;

  return (
    <Card>
      <SectionTitle icon={ImagePlus}>Custom background</SectionTitle>
      <p className="sb-muted" style={{ fontSize: 12.5, marginTop: 2, marginBottom: 16 }}>
        Paste an image URL to use it as the app's backdrop. Every card, the sidebar, and every page stay exactly
        as they are — only the space behind them changes. This is saved on this device only, not synced to your account.
      </p>
      {themeHasOwnPhoto && !active && (
        <p className="sb-muted" style={{ fontSize: 12.5, marginTop: -10, marginBottom: 16 }}>
          Your current theme already has its own backdrop — applying a custom one here will replace it.
        </p>
      )}

      <div className="sb-bg-url-row">
        <input
          className="sb-input"
          placeholder="https://images.unsplash.com/photo-…"
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") applyUrl(); }}
          spellCheck={false}
        />
        <Btn onClick={applyUrl} disabled={!isDirty || preloadStatus !== "ok"}>
          {preloadStatus === "checking" && isDirty
            ? <Loader2 size={15} className="sb-spin" style={{ marginRight: 6, verticalAlign: "-2px" }} />
            : null}
          Apply
        </Btn>
      </div>

      {isDirty && draftUrl.trim() && (
        <div className="sb-bg-status-row">
          {preloadStatus === "checking" && <span className="sb-muted">Checking image…</span>}
          {preloadStatus === "ok" && <span className="sb-bg-status-ok"><CheckCircle2 size={14} /> Looks good — hit Apply</span>}
          {preloadStatus === "error" && <span className="sb-bg-status-error"><XCircle size={14} /> Couldn't load that image. Check the URL (it must be direct, publicly viewable, and end in an image).</span>}
        </div>
      )}

      {active && (
        <>
          <div className="sb-bg-preview" style={{
            backgroundImage: `url("${settings.url}")`,
            filter: `brightness(${settings.brightness}%) saturate(${settings.saturate}%) blur(${Math.min(settings.blur, 8)}px)`,
          }}>
            {settings.dim > 0 && <div className="sb-bg-preview-dim" style={{ opacity: settings.dim / 100 }} />}
          </div>

          <div className="sb-bg-sliders">
            <Slider
              icon={Sun} label="Brightness" id="bg-brightness" valueLabel={`${settings.brightness}%`}
              min={BG_LIMITS.brightness.min} max={BG_LIMITS.brightness.max} step={BG_LIMITS.brightness.step}
              value={settings.brightness} onChange={(v) => update({ brightness: v })}
            />
            <Slider
              icon={Contrast} label="Dim overlay" id="bg-dim" valueLabel={`${settings.dim}%`}
              min={BG_LIMITS.dim.min} max={BG_LIMITS.dim.max} step={BG_LIMITS.dim.step}
              value={settings.dim} onChange={(v) => update({ dim: v })}
            />
            <Slider
              icon={Droplets} label="Saturation" id="bg-saturate" valueLabel={`${settings.saturate}%`}
              min={BG_LIMITS.saturate.min} max={BG_LIMITS.saturate.max} step={BG_LIMITS.saturate.step}
              value={settings.saturate} onChange={(v) => update({ saturate: v })}
            />
            <Slider
              icon={Wind} label="Blur" id="bg-blur" valueLabel={`${settings.blur}px`}
              min={BG_LIMITS.blur.min} max={BG_LIMITS.blur.max} step={BG_LIMITS.blur.step}
              value={settings.blur} onChange={(v) => update({ blur: v })}
            />
          </div>

          <div className="sb-bg-actions">
            <Btn variant="ghost" onClick={() => update({
              brightness: DEFAULT_BG_SETTINGS.brightness,
              saturate: DEFAULT_BG_SETTINGS.saturate,
              blur: DEFAULT_BG_SETTINGS.blur,
              dim: DEFAULT_BG_SETTINGS.dim,
            })}>
              Reset adjustments
            </Btn>
            <Btn variant="ghost" onClick={removeBackground}>
              <Trash2 size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />Remove background
            </Btn>
          </div>
        </>
      )}
    </Card>
  );
}
