import React from "react";

/* Rendered only while FocusModeOverlay is mounted (see FocusTimer.jsx) --
   same on-demand pattern as CommunityStyle/AuthOnboardStyle, so this never
   adds weight to pages that never open Focus Mode.

   Plain CSS, no libraries. Theme variables (--card, --outline, --accent,
   --font-display...) resolve because the overlay is portaled into .sb-app. */
export default function FocusModeStyle() {
  return (
    <style>{`
      .sb-focusmode-root {
        position: fixed; inset: 0; z-index: 99999;
        display: flex; align-items: center; justify-content: center;
        background: var(--fm-base, #0b0b12); transition: background-color .6s ease;
        overflow: hidden; outline: none; color: #fff;
        font-family: var(--font-body, system-ui, sans-serif);
        overscroll-behavior: none; -webkit-tap-highlight-color: transparent;
      }
      .sb-focusmode-root.is-idle { cursor: none; }

      .sb-focusmode-canvas {
        position: absolute; inset: 0; width: 100%; height: 100%;
        z-index: 0; pointer-events: none; transition: opacity .42s ease;
      }
      .sb-focusmode-vignette {
        position: absolute; inset: 0; z-index: 1; pointer-events: none;
        background: radial-gradient(ellipse at center, transparent 48%, rgba(0,0,0,.42) 100%);
      }
      /* keeps digits + quote legible over bright scenes (snow moon, fire, blossoms) */
      .sb-focusmode-scrim {
        position: absolute; inset: 0; z-index: 1; pointer-events: none;
        background: radial-gradient(ellipse 52% 60% at 50% 50%, rgba(0,0,0,.34), transparent 72%);
      }

      .sb-focusmode-content {
        position: relative; z-index: 2;
        display: flex; flex-direction: column; align-items: center; gap: 12px;
        padding: 24px; width: 100%; max-width: 600px; text-align: center;
      }

      .sb-focusmode-mode-label {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 6px 14px; border-radius: 999px;
        font-weight: 800; font-size: 11.5px; letter-spacing: .2em; text-transform: uppercase;
        color: rgba(255,255,255,.85);
        background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.16);
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      }
      .sb-focusmode-live-dot {
        width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.45);
        transition: background-color .3s ease, box-shadow .3s ease;
      }
      .is-running .sb-focusmode-live-dot {
        background: #7dffb0; box-shadow: 0 0 10px #7dffb0; animation: sb-fm-pulse 1.8s ease-in-out infinite;
      }
      @keyframes sb-fm-pulse { 50% { opacity: .35; } }

      /* Mascot sits on the theme's own card colour, exactly like everywhere
         else in the app, so its outline/ink always have the contrast they
         were drawn for -- on any theme, over any scene. */
      .sb-focusmode-medallion {
        position: relative; width: 132px; height: 132px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center; margin: 4px 0 0;
        background: var(--card, #fff);
        border: 3px solid var(--outline, rgba(255,255,255,.7));
        box-shadow: 0 14px 44px rgba(0,0,0,.45), 0 0 0 8px rgba(255,255,255,.08);
      }
      .sb-focusmode-ring {
        position: absolute; inset: -14px; border-radius: 50%; pointer-events: none;
        border: 2px solid rgba(255,255,255,.28); opacity: 0;
      }
      .is-running .sb-focusmode-ring { animation: sb-fm-ring 3.6s ease-out infinite; }
      @keyframes sb-fm-ring {
        0% { transform: scale(.92); opacity: .55; }
        100% { transform: scale(1.22); opacity: 0; }
      }

      .sb-focusmode-time {
        font-family: var(--font-display, inherit); font-weight: 800; line-height: 1;
        font-size: clamp(76px, 15vw, 132px); letter-spacing: .01em; color: #fff;
        font-variant-numeric: tabular-nums;
        text-shadow: 0 2px 30px rgba(255,255,255,.28), 0 4px 18px rgba(0,0,0,.4);
        display: flex; align-items: baseline; margin-top: 2px;
      }
      .sb-focusmode-colon { opacity: .7; margin: 0 .04em; position: relative; top: -.06em; }
      .is-running .sb-focusmode-colon { animation: sb-fm-blink 1s steps(1) infinite; }
      @keyframes sb-fm-blink { 0%, 49% { opacity: .75; } 50%, 100% { opacity: .2; } }

      .sb-focusmode-hint { color: rgba(255,255,255,.72); font-size: 13px; font-weight: 700; margin: 0; }

      .sb-focusmode-track {
        width: min(86%, 380px); height: 7px; border-radius: 999px; margin-top: 2px;
        background: rgba(255,255,255,.16); overflow: hidden;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.12);
      }
      .sb-focusmode-fill {
        height: 100%; border-radius: 999px;
        background: linear-gradient(90deg, rgba(255,255,255,.75), #fff);
        box-shadow: 0 0 14px rgba(255,255,255,.55);
        transition: width .6s cubic-bezier(.4,0,.2,1);
      }

      .sb-focusmode-controls {
        display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 16px;
        transition: opacity .6s ease;
      }
      .sb-focusmode-btn {
        display: inline-flex; align-items: center; gap: 7px;
        padding: 11px 20px; border-radius: 999px; font: inherit; font-weight: 800; font-size: 13.5px;
        border: 1.5px solid rgba(255,255,255,.3); background: rgba(255,255,255,.1); color: #fff;
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        cursor: pointer; transition: transform .15s ease, background-color .2s ease, opacity .2s ease;
      }
      .sb-focusmode-btn:hover:not(:disabled) { background: rgba(255,255,255,.2); transform: translateY(-1px); }
      .sb-focusmode-btn:disabled { opacity: .4; cursor: not-allowed; }
      .sb-focusmode-btn.icon { padding: 11px 13px; }
      .sb-focusmode-btn.primary { background: #fff; color: #14141c; border-color: #fff; box-shadow: 0 6px 22px rgba(0,0,0,.3); }
      .sb-focusmode-btn.primary:hover:not(:disabled) { background: rgba(255,255,255,.9); }
      .sb-focusmode-btn.danger { background: #ff5470; border-color: #ff5470; }
      .sb-focusmode-btn.danger:hover:not(:disabled) { background: #ff3457; }
      .sb-focusmode-btn:focus-visible, .sb-focusmode-env-toggle:focus-visible, .sb-focusmode-env-chip:focus-visible, .sb-focusmode-quote:focus-visible {
        outline: 2px solid #fff; outline-offset: 3px;
      }
      .sb-focusmode-reset-hint { max-width: 340px; margin: 6px 0 0; font-size: 12px; line-height: 1.5; color: rgba(255,255,255,.75); }

      /* ── quote / finish slot: fixed height so nothing jumps as lines change ── */
      .sb-focusmode-slot { min-height: 96px; width: 100%; display: flex; align-items: flex-start; justify-content: center; margin-top: 18px; }
      .sb-focusmode-quote {
        all: unset; box-sizing: border-box; cursor: pointer; max-width: 460px;
        display: flex; flex-direction: column; align-items: center; gap: 12px;
        transition: opacity .8s ease, transform .8s ease;
      }
      .sb-focusmode-quote.out { opacity: 0; transform: translateY(-6px); }
      .sb-focusmode-quote-rule { width: 34px; height: 2px; border-radius: 2px; background: rgba(255,255,255,.55); }
      .sb-focusmode-quote-text {
        font-size: clamp(15px, 2.1vw, 19px); line-height: 1.5; font-weight: 600; font-style: italic;
        color: rgba(255,255,255,.96); text-shadow: 0 2px 14px rgba(0,0,0,.6), 0 0 2px rgba(0,0,0,.35);
      }
      .sb-focusmode-word { display: inline-block; opacity: 0; animation: sb-fm-word .9s cubic-bezier(.2,.7,.2,1) forwards; }
      @keyframes sb-fm-word {
        from { opacity: 0; transform: translateY(8px); filter: blur(5px); }
        to   { opacity: 1; transform: none; filter: blur(0); }
      }

      .sb-focusmode-done { display: flex; flex-direction: column; gap: 4px; align-items: center; animation: sb-fm-word .7s ease both; }
      .sb-focusmode-done strong { font-family: var(--font-display, inherit); font-size: 22px; font-weight: 800; text-shadow: 0 2px 14px rgba(0,0,0,.5); }
      .sb-focusmode-done span { font-size: 13px; font-weight: 700; color: rgba(255,255,255,.8); }

      /* ── scene picker ── */
      .sb-focusmode-env-picker {
        position: absolute; left: 18px; bottom: 18px; z-index: 3;
        display: flex; flex-direction: column; align-items: flex-start; gap: 10px;
        transition: opacity .6s ease;
      }
      .sb-focusmode-env-toggle {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 9px 14px; border-radius: 999px; font: inherit; font-weight: 800; font-size: 12.5px;
        background: rgba(10,12,20,.45); border: 1.5px solid rgba(255,255,255,.24); color: #fff;
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        cursor: pointer; transition: background-color .2s ease;
      }
      .sb-focusmode-env-toggle:hover:not(:disabled) { background: rgba(10,12,20,.65); }
      .sb-focusmode-env-toggle:disabled { opacity: .4; cursor: not-allowed; }
      .sb-focusmode-env-toggle svg.flip { transform: rotate(180deg); }
      .sb-focusmode-env-label { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .sb-focusmode-env-list {
        display: grid; grid-template-columns: repeat(3, 92px); gap: 8px;
        max-height: min(64vh, 360px); overflow-y: auto; padding: 10px; border-radius: 18px;
        background: rgba(10,12,20,.78); border: 1.5px solid rgba(255,255,255,.18);
        backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
        box-shadow: 0 16px 40px rgba(0,0,0,.45); animation: sb-fm-word .25s ease both;
      }
      .sb-focusmode-env-chip {
        display: flex; flex-direction: column; align-items: center; gap: 4px;
        padding: 10px 4px 8px; border-radius: 12px; font: inherit; color: #fff;
        background: rgba(255,255,255,.06); border: 1.5px solid transparent; cursor: pointer;
        transition: transform .12s ease, background-color .2s ease, border-color .2s ease;
      }
      .sb-focusmode-env-chip:hover { transform: translateY(-2px); background: rgba(255,255,255,.14); }
      .sb-focusmode-env-chip.active { border-color: #fff; background: rgba(255,255,255,.2); }
      .sb-focusmode-env-emoji { font-size: 22px; line-height: 1; }
      .sb-focusmode-env-name { font-size: 10.5px; font-weight: 800; line-height: 1.15; text-align: center; opacity: .9; }

      /* chrome fades away while the timer runs and you're not touching anything */
      .is-idle .sb-focusmode-controls,
      .is-idle .sb-focusmode-env-picker,
      .is-idle .sb-focusmode-float-btn { opacity: 0; pointer-events: none; }

      /* ── float button: drop out of OS fullscreen without closing Focus
         Mode -- the overlay keeps filling the browser window exactly as
         before and the timer keeps running, but the OS taskbar/other apps
         become reachable again (see the bottom-row "Exit" for a full close
         instead). Tapping it again restores fullscreen. */
      .sb-focusmode-float-btn {
        position: absolute; top: 14px; right: 14px; z-index: 5;
        width: 34px; height: 34px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        background: rgba(10,12,20,.45); border: 1.5px solid rgba(255,255,255,.24); color: #fff;
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        cursor: pointer; transition: background-color .2s ease, transform .15s ease, opacity .6s ease;
      }
      .sb-focusmode-float-btn:hover:not(:disabled) { background: rgba(10,12,20,.65); transform: translateY(-1px); }
      .sb-focusmode-float-btn:disabled { opacity: .4; cursor: not-allowed; }
      .sb-focusmode-float-btn:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }

      @media (max-width: 520px) {
        .sb-focusmode-content { padding: 16px; gap: 10px; }
        .sb-focusmode-medallion { width: 112px; height: 112px; }
        .sb-focusmode-btn { padding: 10px 15px; font-size: 12.5px; }
        .sb-focusmode-env-picker { left: 50%; transform: translateX(-50%); align-items: center; bottom: 14px; }
        .sb-focusmode-env-list { grid-template-columns: repeat(3, 84px); }
        .sb-focusmode-slot { min-height: 110px; }
      }
      @media (max-height: 640px) {
        .sb-focusmode-medallion { width: 92px; height: 92px; }
        .sb-focusmode-slot { min-height: 80px; margin-top: 8px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .sb-focusmode-word { animation: none; opacity: 1; }
        .sb-focusmode-ring, .is-running .sb-focusmode-live-dot, .is-running .sb-focusmode-colon { animation: none; }
      }
    `}</style>
  );
}
