import { useRef, useEffect, useState, useCallback } from "react";
import { AMBIENT_ENVIRONMENTS } from "../lib/focusAmbience";

/**
 * FocusModeAmbient — fullscreen ambient canvas background for Focus Mode.
 * Ported from Zenith's Environment.jsx: a single <canvas> driven by
 * requestAnimationFrame, cross-fading between renderers when `envKey`
 * changes instead of hard-cutting. Purely decorative (aria-hidden), sits
 * behind the timer content at z-index 0.
 */
export default function FocusModeAmbient({ envKey = "rain" }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const prevEnvRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const [fading, setFading] = useState(false);
  // Each scene declares how strongly it sits over its base colour: the Zenith
  // originals are translucent overlays, the rebuilt ones paint a full backdrop.
  const opacity = (AMBIENT_ENVIRONMENTS[envKey] || AMBIENT_ENVIRONMENTS.rain).opacity ?? 0.55;

  const startLoop = useCallback((renderer) => {
    cancelAnimationFrame(rafRef.current);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: false });
    canvas.width = canvas.offsetWidth || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;
    sizeRef.current = { w: canvas.width, h: canvas.height };
    const loop = (time) => {
      const { w, h } = sizeRef.current;
      if (w > 0 && h > 0) renderer(ctx, canvas, time);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    const env = AMBIENT_ENVIRONMENTS[envKey] || AMBIENT_ENVIRONMENTS.rain;
    prevEnvRef.current = envKey;
    startLoop(env.create());
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prevEnvRef.current === null || prevEnvRef.current === envKey) return;
    prevEnvRef.current = envKey;
    setFading(true);
    const tmo = setTimeout(() => {
      startLoop((AMBIENT_ENVIRONMENTS[envKey] || AMBIENT_ENVIRONMENTS.rain).create());
      setFading(false);
    }, 420);
    return () => clearTimeout(tmo);
  }, [envKey, startLoop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !window.ResizeObserver) return;
    let pending = false;
    const ro = new ResizeObserver((entries) => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const entry = entries[0];
        if (!entry) return;
        const w = Math.floor(entry.contentRect.width) || window.innerWidth;
        const h = Math.floor(entry.contentRect.height) || window.innerHeight;
        if (w !== sizeRef.current.w || h !== sizeRef.current.h) {
          canvas.width = w;
          canvas.height = h;
          sizeRef.current = { w, h };
        }
      });
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="sb-focusmode-canvas"
        style={{ opacity: fading ? 0 : opacity }}
      />
      {/* Soft vignette; the readability scrim lives in FocusModeOverlay */}
      <div aria-hidden="true" className="sb-focusmode-vignette" />
    </>
  );
}
