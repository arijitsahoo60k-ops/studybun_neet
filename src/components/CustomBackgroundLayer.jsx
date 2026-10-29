import React, { useEffect } from "react";
import { useCustomBackground } from "../hooks/useCustomBackground";

const BODY_CLASS = "sb-custom-bg-active";

/* Purely decorative, self-contained layer — mounted once in App.jsx and
   otherwise touches nothing. It reads the same localStorage setting the
   Settings > Background card writes to (via useCustomBackground) and paints
   a fixed, full-viewport image behind the entire app.

   How it stays out of every other page's way:
   - It's `position: fixed` with a negative z-index (see GlobalStyle's
     .sb-custom-bg-layer rule), so it never affects layout anywhere.
   - It toggles a class on <body> instead of threading an "active" prop
     through App.jsx. GlobalStyle only makes .sb-app's own background
     transparent when that class is present, so cards/sidebar/every other
     surface keep their normal opaque backgrounds exactly as before —
     the photo only shows through the gaps around them. */
export default function CustomBackgroundLayer() {
  const { settings } = useCustomBackground();
  const active = Boolean(settings.enabled && settings.url);

  useEffect(() => {
    document.body.classList.toggle(BODY_CLASS, active);
    return () => document.body.classList.remove(BODY_CLASS);
  }, [active]);

  if (!active) return null;

  const filter = `brightness(${settings.brightness}%) saturate(${settings.saturate}%) blur(${settings.blur}px)`;

  return (
    <div className="sb-custom-bg-layer" aria-hidden="true">
      <div
        className="sb-custom-bg-img"
        style={{ backgroundImage: `url("${settings.url.replace(/"/g, '\\"')}")`, filter }}
      />
      {settings.dim > 0 && (
        <div className="sb-custom-bg-overlay" style={{ opacity: settings.dim / 100 }} />
      )}
    </div>
  );
}
