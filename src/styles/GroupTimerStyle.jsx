import React from "react";

/* Styles for the Group Timer page (lobby, room, dialogs). Rendered by
   pages/GroupTimer.jsx only, so it adds nothing to pages that never open it
   -- same on-demand pattern as CommunityStyle / FocusModeStyle.

   Theme variables (--card, --bg, --soft, --accent, --mascot-outline,
   --mascot-ink, --muted, --font-display) resolve both in the page and inside
   the dialogs, because every dialog is portaled into .sb-app.

   Contrast rule used throughout: anything that sits ON the GIF / picture
   (status pill, subject line, timer plate, hero caption) carries its own
   dark translucent backing and fixed light text, so it reads the same in
   every theme. Anything on a card uses the theme's own ink-on-card pairs,
   exactly like the rest of the app.

   No backdrop-filter anywhere: the stage plays an animated GIF, and a live
   blur over moving pixels is re-computed every frame. */
export default function GroupTimerStyle() {
  return (
    <style>{`
      .sb-gt-page { gap: 16px; }

      /* ---------- shared bits ---------- */
      .sb-gt-dot { width: 8px; height: 8px; border-radius: 50%; background: #9aa0a6; flex: none; }
      .sb-gt-vis {
        display: inline-flex; align-items: center; gap: 5px; flex: none;
        padding: 4px 11px; border-radius: 999px; font-size: 12px; font-weight: 800;
        border: 2px solid var(--mascot-outline); background: var(--soft); color: var(--mascot-ink);
      }
      .sb-gt-vis.priv, .sb-gt-vis.neutral { background: var(--card); }
      .sb-gt-error {
        display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
        margin: 0; font-size: 13px; font-weight: 700; color: #d1495b;
      }
      .sb-gt-banner {
        display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 14px;
        border-radius: 16px; border: 2px solid var(--mascot-outline); background: var(--soft);
        color: var(--mascot-ink); font-size: 13px; font-weight: 700;
      }
      .sb-gt-banner-link {
        margin-left: auto; background: none; border: 0; padding: 2px 4px; cursor: pointer;
        font: inherit; font-weight: 800; color: var(--mascot-ink); text-decoration: underline;
        display: inline-flex; align-items: center; gap: 4px;
      }
      .sb-gt-banner-x {
        margin-left: auto; background: none; border: 0; cursor: pointer; font-size: 20px; line-height: 1;
        color: var(--mascot-ink); padding: 0 4px;
      }
      .sb-gt-loading { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 60px 0; color: var(--muted); font-weight: 700; }

      /* segmented pill -- full width of its pane */
      .sb-gt-seg {
        display: flex; width: 100%; gap: 4px; padding: 4px; flex: none;
        border-radius: 999px; border: 2.5px solid var(--mascot-outline); background: var(--bg);
      }
      .sb-gt-seg button {
        flex: 1 1 0; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
        padding: 10px 12px; border-radius: 999px; border: 0; background: transparent; color: var(--muted);
        font-family: var(--font-display); font-weight: 800; font-size: 14px; cursor: pointer;
        transition: background-color .18s ease, color .18s ease;
      }
      .sb-gt-seg button:hover { color: var(--mascot-ink); }
      .sb-gt-seg button.on { background: var(--mascot-outline); color: var(--bg); }
      .sb-gt-seg-sm button { padding: 7px 10px; font-size: 12.5px; }

      /* ---------- lobby ---------- */
      .sb-gt-lobby { display: flex; flex-direction: column; gap: 16px; width: 100%; }
      .sb-gt-titlebar { display: flex; align-items: baseline; gap: 6px 14px; flex-wrap: wrap; }
      .sb-gt-title {
        margin: 0; font-family: var(--font-display); font-weight: 800; line-height: 1.05;
        font-size: clamp(32px, 4.6vw, 48px); color: var(--mascot-ink); letter-spacing: .005em;
      }
      .sb-gt-tagline { font-size: 13.5px; font-weight: 700; color: var(--muted); }

      .sb-gt-lobby-grid { display: grid; grid-template-columns: 1fr; gap: 18px; }

      .sb-gt-hero {
        position: relative; overflow: hidden; padding: 0; min-height: 250px;
        background: #211819; display: flex; align-items: flex-end;
      }
      .sb-gt-hero-img {
        position: absolute; inset: 0; width: 100%; height: 100%;
        object-fit: cover; object-position: center 48%; image-rendering: pixelated;
        user-select: none; pointer-events: none;
      }
      .sb-gt-hero-scrim {
        position: absolute; inset: 0; pointer-events: none;
        background: linear-gradient(to top, rgba(14,10,12,.9) 0%, rgba(14,10,12,.6) 30%, rgba(14,10,12,0) 62%);
      }
      .sb-gt-hero-text {
        position: relative; z-index: 1; margin: 0; padding: 20px 24px 24px; max-width: 32ch;
        color: #fff; font-family: var(--font-display); font-weight: 700; line-height: 1.35;
        font-size: clamp(17px, 2vw, 23px); text-shadow: 0 2px 10px rgba(0,0,0,.65);
      }
      .sb-gt-hero-text b { color: #ffd66b; font-weight: 800; }

      .sb-gt-side { display: flex; flex-direction: column; gap: 14px; min-height: 0; overflow: hidden; padding: 18px; }
      .sb-gt-side-body {
        flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
        /* room for the pills' hard drop-shadows so they aren't clipped */
        padding: 2px 8px 8px 2px; margin-right: -4px;
      }

      .sb-gt-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
      .sb-gt-row {
        width: 100%; display: flex; align-items: center; gap: 12px; padding: 11px 14px 11px 11px;
        border-radius: 999px; border: 2.5px solid var(--mascot-outline); background: var(--bg);
        color: var(--mascot-ink); text-align: left; cursor: pointer; font-family: inherit;
        box-shadow: 3px 3px 0 var(--sticker-shadow, var(--mascot-outline));
        transition: transform .12s ease, box-shadow .12s ease, background-color .18s ease;
      }
      .sb-gt-row:hover:not(:disabled) { transform: translate(-1px,-1px); box-shadow: 4px 4px 0 var(--sticker-shadow, var(--mascot-outline)); background: var(--soft); }
      .sb-gt-row:active:not(:disabled) { transform: translate(1px,1px); box-shadow: 1px 1px 0 var(--sticker-shadow, var(--mascot-outline)); }
      .sb-gt-row:disabled { opacity: .65; cursor: wait; }
      .sb-gt-row-icon {
        flex: none; width: 36px; height: 36px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
        background: var(--soft); border: 2px solid var(--mascot-outline); color: var(--mascot-ink);
      }
      .sb-gt-row-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
      .sb-gt-row-name {
        font-family: var(--font-display); font-weight: 800; font-size: 15.5px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .sb-gt-row-meta { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: var(--muted); }
      .sb-gt-row-cta {
        flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 999px;
        background: var(--mascot-outline); color: var(--bg); font-weight: 800; font-size: 12.5px;
      }
      .sb-gt-row-cta.joined { background: var(--soft); color: var(--mascot-ink); box-shadow: inset 0 0 0 1.5px var(--mascot-outline); }
      .sb-gt-row-skeleton { height: 60px; box-shadow: none; background: var(--soft); border-color: transparent; animation: sb-gt-pulse 1.3s ease-in-out infinite; }
      @keyframes sb-gt-pulse { 0%, 100% { opacity: .45; } 50% { opacity: .85; } }

      .sb-gt-private { display: flex; flex-direction: column; }
      .sb-gt-options { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .sb-gt-option {
        display: flex; flex-direction: column; align-items: flex-start; gap: 5px; padding: 16px;
        border-radius: 20px; border: 2.5px solid var(--mascot-outline); background: var(--bg);
        color: var(--mascot-ink); text-align: left; cursor: pointer; font-family: inherit;
        box-shadow: 3px 3px 0 var(--sticker-shadow, var(--mascot-outline));
        transition: transform .12s ease, box-shadow .12s ease, background-color .18s ease;
      }
      .sb-gt-option:hover { transform: translate(-1px,-1px); box-shadow: 4px 4px 0 var(--sticker-shadow, var(--mascot-outline)); background: var(--soft); }
      .sb-gt-option-icon {
        width: 38px; height: 38px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;
        background: var(--soft); border: 2px solid var(--mascot-outline); margin-bottom: 4px;
      }
      .sb-gt-option-title { font-family: var(--font-display); font-weight: 800; font-size: 16px; }
      .sb-gt-option-sub { font-size: 12.5px; font-weight: 700; color: var(--muted); line-height: 1.35; }
      .sb-gt-subhead { margin: 20px 0 10px; font-family: var(--font-display); font-size: 14px; font-weight: 800; color: var(--muted); }
      .sb-gt-none { margin: 0; font-size: 13px; }

      /* ---------- room ---------- */
      .sb-gt-room { display: flex; flex-direction: column; gap: 14px; width: 100%; }
      .sb-gt-room-head { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .sb-gt-room-name {
        margin: 0; flex: 0 1 auto; min-width: 0; line-height: 1.1; color: var(--mascot-ink);
        font-family: var(--font-display); font-weight: 800; font-size: clamp(24px, 3.4vw, 36px);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .sb-gt-info-btn { margin-left: auto; flex: none; }
      .sb-gt-room-grid { display: grid; grid-template-columns: 1fr; gap: 18px; }

      /* timer pane */
      .sb-gt-timer { display: flex; flex-direction: column; padding: 0; overflow: hidden; min-height: 0; }
      .sb-gt-stage {
        position: relative; flex: 1 1 auto; min-height: 300px; overflow: hidden; background: #0d0b14;
        border-bottom: 2.5px solid var(--mascot-outline);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
      }
      .sb-gt-gif {
        position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
        image-rendering: pixelated; user-select: none; pointer-events: none;
      }
      .sb-gt-scrim {
        position: absolute; inset: 0; pointer-events: none;
        background:
          linear-gradient(to bottom, rgba(6,5,12,.4), rgba(6,5,12,0) 26%),
          radial-gradient(ellipse at center, rgba(6,5,12,.1) 28%, rgba(6,5,12,.48) 100%);
      }
      .sb-gt-stage-top {
        position: absolute; top: 12px; left: 12px; right: 12px; z-index: 2;
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
      }
      .sb-gt-status {
        display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 999px;
        background: rgba(10,10,18,.66); color: #fff; font-weight: 800; font-size: 12.5px;
        border: 1.5px solid rgba(255,255,255,.2);
      }
      .sb-gt-status.running .sb-gt-dot { background: #3ddc84; animation: sb-gt-dot 1.6s ease-in-out infinite; }
      .sb-gt-status.paused .sb-gt-dot { background: #ffd66b; }
      .sb-gt-status.done .sb-gt-dot { background: #7cc8ff; }
      @keyframes sb-gt-dot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.45); opacity: .6; } }
      .sb-gt-gear {
        width: 38px; height: 38px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
        background: rgba(10,10,18,.66); color: #fff; border: 1.5px solid rgba(255,255,255,.3); cursor: pointer;
        transition: transform .25s ease, background-color .2s ease;
      }
      .sb-gt-gear:hover { transform: rotate(60deg); background: rgba(10,10,18,.85); }

      .sb-gt-stage-center {
        position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center;
        gap: 12px; padding: 44px 14px 18px; max-width: 100%;
      }
      .sb-gt-plate {
        padding: 10px 26px 12px; border-radius: 24px; max-width: 100%;
        background: var(--gt-plate); border: 1.5px solid var(--gt-edge);
      }
      .sb-gt-time {
        display: block; font-family: var(--font-display); font-weight: 800; line-height: 1;
        font-size: clamp(52px, 8vw, 92px); color: var(--gt-color); letter-spacing: .01em;
        font-variant-numeric: tabular-nums; text-shadow: 0 2px 0 rgba(0,0,0,.32); white-space: nowrap;
      }
      .sb-gt-subject-line {
        margin: 0; display: inline-block; max-width: 100%; padding: 6px 14px; border-radius: 999px;
        background: rgba(10,10,18,.68); color: #fff; font-weight: 800; font-size: 13.5px;
        border: 1.5px solid rgba(255,255,255,.18); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .sb-gt-subject-line svg { vertical-align: -2px; margin-right: 6px; }
      .sb-gt-stage-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 6px; background: rgba(255,255,255,.2); z-index: 2; }
      .sb-gt-stage-bar > span { display: block; height: 100%; background: var(--gt-color); transition: width 1s linear; }

      .sb-gt-footer {
        flex: 0 0 auto; display: flex; flex-direction: column; gap: 12px; padding: 14px 16px 16px;
        background: var(--card); overflow-y: auto; overscroll-behavior: contain;
      }
      .sb-gt-modes { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px; }
      .sb-gt-pencil { width: 30px; height: 30px; }
      .sb-gt-duration { align-self: center; }
      .sb-gt-subject-row { display: flex; flex-direction: column; gap: 8px; }
      .sb-gt-subject-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
      .sb-gt-topic { width: 100%; }
      .sb-gt-controls { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
      .sb-gt-controls .sb-btn-primary { padding: 10px 28px; }
      .sb-gt-save { display: flex; flex-direction: column; gap: 6px; }
      .sb-gt-save .sb-section-title { margin-bottom: 2px; }
      .sb-gt-save-actions { display: flex; flex-wrap: wrap; gap: 10px; }

      /* members pane */
      .sb-gt-members { display: flex; flex-direction: column; min-height: 0; overflow: hidden; padding: 18px; }
      .sb-gt-members .sb-section-title { margin-bottom: 4px; }
      .sb-gt-members-sub { margin: 0 0 12px; font-size: 12.5px; font-weight: 700; color: var(--muted); }
      .sb-gt-offline {
        display: flex; align-items: center; gap: 6px; margin: 0 0 10px; padding: 8px 12px; border-radius: 12px;
        font-size: 12.5px; font-weight: 700; background: var(--soft); color: var(--mascot-ink);
        border: 1.5px dashed var(--mascot-outline);
      }
      .sb-gt-card-grid {
        list-style: none; margin: 0; padding: 2px 8px 8px 2px; flex: 0 1 auto; min-height: 0;
        display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 12px;
        align-content: start; overflow-y: auto; overscroll-behavior: contain;
      }
      .sb-gt-alone { flex: none; }
      .sb-gt-card {
        position: relative; display: flex; flex-direction: column; align-items: center; text-align: center;
        gap: 5px; padding: 12px 10px; min-width: 0; border-radius: 20px;
        border: 2.5px solid var(--mascot-outline); background: var(--bg); box-shadow: 3px 3px 0 var(--sticker-shadow, var(--mascot-outline));
        transition: opacity .2s ease;
      }
      .sb-gt-card.me { background: var(--soft); }
      .sb-gt-card.idle { opacity: .72; box-shadow: 2px 2px 0 var(--sticker-shadow, var(--mascot-outline)); }
      .sb-gt-card-avatar {
        display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%;
        background: var(--card); border: 2.5px solid var(--mascot-outline);
      }
      .sb-gt-card.studying .sb-gt-card-avatar { border-color: #2fbf71; box-shadow: 0 0 0 3px rgba(47,191,113,.25); }
      .sb-gt-card-name {
        max-width: 100%; font-family: var(--font-display); font-weight: 800; font-size: 14.5px; color: var(--mascot-ink);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .sb-gt-card-state { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 800; color: var(--muted); }
      .sb-gt-card.studying .sb-gt-card-state { color: var(--mascot-ink); }
      .sb-gt-card.studying .sb-gt-dot { background: #2fbf71; animation: sb-gt-dot 1.6s ease-in-out infinite; }
      .sb-gt-card.paused .sb-gt-dot { background: #e0a526; }
      .sb-gt-card.done .sb-gt-dot { background: #3b8fd9; }
      .sb-gt-card-time {
        font-family: var(--font-display); font-weight: 800; font-size: 22px; line-height: 1.1; color: var(--mascot-ink);
        font-variant-numeric: tabular-nums;
      }
      .sb-gt-card-time-idle { opacity: .3; }
      .sb-gt-card-bar {
        width: 100%; height: 7px; border-radius: 99px; overflow: hidden;
        background: var(--card); border: 1.5px solid var(--mascot-outline);
      }
      .sb-gt-card-bar > span { display: block; height: 100%; background: var(--accent); transition: width 1s linear; }
      .sb-gt-card-subject {
        max-width: 100%; padding: 3px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 800;
        color: #241E1A; background: var(--soft); border: 1.5px solid rgba(36,30,26,.55);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }

      /* ---------- dialogs ---------- */
      .sb-gt-dialog .sb-section-title { padding-right: 34px; }
      .sb-gt-settings-dialog { width: min(520px, 100%); display: flex; flex-direction: column; gap: 16px; }
      .sb-gt-info-dialog, .sb-gt-form-dialog, .sb-gt-confirm-dialog { width: min(420px, 100%); }
      .sb-gt-set-block { display: flex; flex-direction: column; gap: 10px; }
      .sb-gt-set-label { display: inline-flex; align-items: center; gap: 7px; font-weight: 800; font-size: 14px; color: var(--muted); }
      .sb-gt-gif-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
      .sb-gt-gif-opt {
        position: relative; display: flex; flex-direction: column; gap: 6px; padding: 6px; border-radius: 14px;
        border: 2.5px solid var(--mascot-outline); background: var(--bg); color: var(--mascot-ink); cursor: pointer;
        font-family: inherit; font-weight: 800; font-size: 12px; text-align: center;
        box-shadow: 2px 2px 0 var(--sticker-shadow, var(--mascot-outline));
      }
      .sb-gt-gif-opt img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 8px; image-rendering: pixelated; background: #111; }
      .sb-gt-gif-opt.on { background: var(--soft); outline: 3px solid var(--accent); outline-offset: 1px; }
      .sb-gt-gif-check {
        position: absolute; top: 10px; right: 10px; width: 20px; height: 20px; border-radius: 50%;
        background: var(--accent); color: #fff; display: inline-flex; align-items: center; justify-content: center;
      }
      .sb-gt-swatches { display: flex; flex-wrap: wrap; gap: 10px; }
      .sb-gt-swatch {
        width: 34px; height: 34px; padding: 0; border-radius: 50%; border: 2.5px solid var(--mascot-outline); cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center; box-shadow: 2px 2px 0 var(--sticker-shadow, var(--mascot-outline));
      }
      .sb-gt-swatch.on { outline: 3px solid var(--accent); outline-offset: 2px; }
      .sb-gt-swatch-custom {
        position: relative; overflow: hidden; color: #1b1620;
        background: conic-gradient(#ff7a7a, #ffd66b, #7bf1c0, #7cc8ff, #c4a6ff, #ff7a7a);
      }
      .sb-gt-swatch-custom input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: 0; padding: 0; }
      .sb-gt-preview {
        height: 96px; border-radius: 16px; border: 2.5px solid var(--mascot-outline);
        background-size: cover; background-position: center; image-rendering: pixelated;
        display: flex; align-items: center; justify-content: center;
      }
      .sb-gt-preview-plate {
        padding: 6px 18px; border-radius: 16px; border: 1.5px solid; line-height: 1.1;
        font-family: var(--font-display); font-weight: 800; font-size: 34px;
      }
      .sb-gt-info-badges { display: flex; gap: 8px; flex-wrap: wrap; margin: -6px 0 12px; }
      .sb-gt-info-text { font-size: 13px; line-height: 1.5; margin: 0 0 12px; }
      .sb-gt-code-box {
        display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 16px; margin-bottom: 14px;
        border-radius: 18px; border: 2.5px dashed var(--mascot-outline); background: var(--soft); text-align: center;
      }
      .sb-gt-code-label { font-size: 12px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
      .sb-gt-code {
        font-family: var(--font-display); font-weight: 800; line-height: 1; letter-spacing: .14em;
        font-size: clamp(32px, 9vw, 44px); color: var(--mascot-ink); user-select: all;
      }
      .sb-gt-info-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
      .sb-gt-confirm-q { margin-right: auto; font-weight: 800; font-size: 13.5px; color: var(--mascot-ink); }
      .sb-gt-form { display: flex; flex-direction: column; gap: 10px; }
      .sb-gt-form label { font-size: 12px; font-weight: 800; color: var(--muted); }
      .sb-gt-code-input { font-family: var(--font-display); font-size: 26px; font-weight: 800; letter-spacing: .18em; text-align: center; text-transform: uppercase; }

      /* ---------- layouts ---------- */
      @media (max-width: 899px) {
        .sb-gt-card-grid { max-height: 520px; }
        .sb-gt-footer { max-height: none; }
      }
      @media (min-width: 900px) {
        .sb-gt-lobby-grid {
          grid-template-columns: 1fr 1fr;
          height: 560px; height: clamp(460px, calc(100dvh - 215px), 780px);
        }
        .sb-gt-hero { min-height: 0; }
        .sb-gt-room-grid {
          grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr);
          height: 600px; height: clamp(520px, calc(100dvh - 185px), 800px);
        }
        .sb-gt-stage { min-height: 220px; }
        .sb-gt-footer { max-height: 66%; }
      }
      @media (max-width: 520px) {
        .sb-gt-options { grid-template-columns: 1fr; }
        .sb-gt-side, .sb-gt-members { padding: 14px; }
        .sb-gt-stage { min-height: 280px; }
        .sb-gt-plate { padding: 8px 18px 10px; }
        .sb-gt-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .sb-gt-hero { min-height: 210px; }
      }


      /* ---------- v2: header extras, stats, recap, roster, manage, cheers, feed ---------- */
      .sb-gt-head-pills { display: inline-flex; align-items: center; gap: 8px; flex: none; }
      .sb-gt-head-actions { margin-left: auto; display: inline-flex; gap: 8px; flex: none; }
      .sb-gt-info-btn { margin-left: 0; }
      .sb-gt-lock-pill { background: color-mix(in srgb, #7C5CD1 14%, var(--card)); }
      .sb-gt-link-btn {
        display: inline-flex; align-items: center; gap: 5px; background: none; border: 0; padding: 2px 4px; cursor: pointer;
        font: inherit; font-size: 12.5px; font-weight: 800; color: var(--mascot-ink); text-decoration: underline; text-underline-offset: 3px;
      }
      .sb-gt-foot { margin: 10px 0 0; font-size: 11.5px; line-height: 1.45; display: flex; align-items: center; gap: 5px; }
      .sb-gt-skel { height: 140px; border-radius: 16px; background: var(--soft); opacity: .6; animation: sb-gt-pulse 1.3s ease-in-out infinite; }

      .sb-gt-below { display: grid; grid-template-columns: 1fr; gap: 18px; }
      .sb-gt-stats, .sb-gt-recap { display: flex; flex-direction: column; gap: 12px; padding: 18px; min-width: 0; }
      .sb-gt-stats .sb-section-title, .sb-gt-recap .sb-section-title { margin-bottom: 0; }
      .sb-gt-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; }
      .sb-gt-tile {
        display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 16px;
        border: 2px solid var(--mascot-outline); background: var(--bg); color: var(--mascot-ink); min-width: 0;
      }
      .sb-gt-tile b { font-family: var(--font-display); font-size: 21px; line-height: 1.1; }
      .sb-gt-tile span { font-size: 11.5px; font-weight: 700; color: var(--muted); }
      .sb-gt-tile svg { color: var(--muted); }
      .sb-gt-tile.streak { background: var(--soft); }

      .sb-gt-goal { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border-radius: 16px; border: 2px solid var(--mascot-outline); background: var(--bg); color: var(--mascot-ink); }
      .sb-gt-goal-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 800; }
      .sb-gt-goal-head span { display: inline-flex; align-items: center; gap: 6px; }
      .sb-gt-goal-bar { height: 12px; border-radius: 99px; overflow: hidden; background: var(--card); border: 2px solid var(--mascot-outline); }
      .sb-gt-goal-bar > span { display: block; height: 100%; background: var(--accent); transition: width .5s ease; }

      .sb-gt-board { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      .sb-gt-board-row {
        display: flex; align-items: center; gap: 10px; padding: 8px 12px 8px 8px; border-radius: 18px;
        border: 2px solid var(--mascot-outline); background: var(--bg); color: var(--mascot-ink);
      }
      .sb-gt-board-row.me { background: var(--soft); }
      .sb-gt-rank {
        flex: none; width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
        font-family: var(--font-display); font-weight: 800; font-size: 13px; background: var(--card); border: 2px solid var(--mascot-outline); color: var(--mascot-ink);
      }
      .sb-gt-board-row.rank-1 .sb-gt-rank { background: #FFD66B; color: #241E1A; }
      .sb-gt-board-row.rank-2 .sb-gt-rank { background: #D5DBE3; color: #241E1A; }
      .sb-gt-board-row.rank-3 .sb-gt-rank { background: #E7B98C; color: #241E1A; }
      .sb-gt-board-avatar { flex: none; display: inline-flex; }
      .sb-gt-board-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
      .sb-gt-board-name { font-family: var(--font-display); font-weight: 800; font-size: 14.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sb-gt-board-bar { height: 7px; border-radius: 99px; background: var(--card); border: 1.5px solid var(--mascot-outline); overflow: hidden; }
      .sb-gt-board-bar > span { display: block; height: 100%; background: var(--accent); transition: width .4s ease; }
      .sb-gt-board-val { flex: none; display: flex; flex-direction: column; align-items: flex-end; line-height: 1.15; }
      .sb-gt-board-val b { font-family: var(--font-display); font-size: 15px; }
      .sb-gt-board-val small { font-size: 11px; font-weight: 700; color: var(--muted); }

      .sb-gt-recap-range { margin: -6px 0 0; font-size: 12.5px; font-weight: 700; color: var(--muted); }
      .sb-gt-recap-total { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; color: var(--mascot-ink); }
      .sb-gt-recap-total b { font-family: var(--font-display); font-size: 30px; line-height: 1; }
      .sb-gt-recap-total span { font-size: 12.5px; font-weight: 700; color: var(--muted); }
      .sb-gt-recap-goal { margin: 0; padding: 6px 12px; border-radius: 12px; font-size: 13px; font-weight: 800; border: 2px solid var(--mascot-outline); background: var(--bg); color: var(--mascot-ink); align-self: flex-start; }
      .sb-gt-recap-goal.hit { background: color-mix(in srgb, #2fbf71 18%, var(--card)); }
      .sb-gt-recap-bars { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; height: 96px; align-items: end; }
      .sb-gt-recap-bar { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 4px; min-width: 0; }
      .sb-gt-recap-bar .fill { display: block; width: 100%; max-width: 34px; border-radius: 8px 8px 3px 3px; background: var(--accent); border: 1.5px solid var(--mascot-outline); min-height: 0; }
      .sb-gt-recap-bar em { font-style: normal; font-size: 11px; font-weight: 800; color: var(--muted); }
      .sb-gt-recap-top { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
      .sb-gt-recap-top li { display: flex; align-items: center; gap: 10px; color: var(--mascot-ink); font-weight: 700; font-size: 13.5px; }
      .sb-gt-recap-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .sb-gt-rules-dialog { width: min(520px, 100%); }
      .sb-gt-rules { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 9px; font-size: 13px; line-height: 1.5; color: var(--mascot-ink); }
      .sb-gt-rules b { font-weight: 800; }
      .sb-gt-rules-box { padding: 10px 12px; margin-bottom: 12px; border-radius: 14px; border: 2px dashed var(--mascot-outline); background: var(--soft); display: flex; flex-direction: column; gap: 4px; }
      .sb-gt-desc { color: var(--mascot-ink); }

      /* roster */
      .sb-gt-roster-dialog, .sb-gt-manage-dialog { width: min(480px, 100%); max-height: 88vh; overflow-y: auto; }
      .sb-gt-roster { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      .sb-gt-roster-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 16px; border: 2px solid var(--mascot-outline); background: var(--bg); color: var(--mascot-ink); }
      .sb-gt-roster-row.offline .sb-gt-roster-avatar { opacity: .6; }
      .sb-gt-roster-avatar { flex: none; display: inline-flex; }
      .sb-gt-roster-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .sb-gt-roster-name { display: flex; align-items: center; gap: 7px; font-family: var(--font-display); font-weight: 800; font-size: 14.5px; min-width: 0; }
      .sb-gt-roster-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--muted); }
      .sb-gt-roster-status.live { color: var(--mascot-ink); }
      .sb-gt-roster-status .sb-gt-dot.on { background: #2fbf71; }
      .sb-gt-host-badge { display: inline-flex; align-items: center; gap: 3px; padding: 1px 7px; border-radius: 99px; font-size: 10.5px; font-weight: 800; background: var(--soft); border: 1.5px solid var(--mascot-outline); color: var(--mascot-ink); }
      .sb-gt-roster-actions { display: inline-flex; gap: 6px; flex: none; }
      .sb-gt-roster-confirm { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; font-size: 12.5px; font-weight: 800; color: var(--mascot-ink); }

      /* manage */
      .sb-gt-textarea { resize: vertical; min-height: 60px; font-family: inherit; }
      .sb-gt-form label small { font-weight: 700; opacity: .75; }
      .sb-gt-saved { margin-right: auto; font-size: 13px; font-weight: 800; color: var(--mascot-ink); }
      .sb-gt-manage-block { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; padding-top: 14px; border-top: 2px dashed var(--mascot-outline); }
      .sb-gt-manage-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .sb-gt-code-sm { font-size: 26px; letter-spacing: .12em; }

      /* cheers, nudges, goals */
      .sb-gt-card-grid .sb-gt-card { overflow: visible; }
      .sb-gt-cheer-btn {
        position: absolute; top: 6px; right: 6px; width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
        border: 1.5px solid var(--mascot-outline); background: var(--card); color: var(--mascot-ink); cursor: pointer;
      }
      .sb-gt-cheer-btn:hover { background: var(--soft); }
      .sb-gt-cheer-pop {
        position: absolute; top: 36px; right: 4px; z-index: 5; display: flex; flex-wrap: wrap; width: 112px; gap: 2px; padding: 5px; border-radius: 14px;
        border: 2px solid var(--mascot-outline); background: var(--card); box-shadow: 3px 3px 0 var(--sticker-shadow, var(--mascot-outline));
      }
      .sb-gt-cheer-pop button, .sb-gt-cheer-row button {
        width: 30px; height: 30px; border-radius: 10px; border: 0; background: transparent; cursor: pointer; font-size: 17px; line-height: 1;
      }
      .sb-gt-cheer-pop button:hover, .sb-gt-cheer-row button:hover { background: var(--soft); }
      .sb-gt-card-goal {
        max-width: 100%; display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 800;
        background: var(--card); border: 1.5px dashed var(--mascot-outline); color: var(--mascot-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .sb-gt-card-goal svg { flex: none; }
      .sb-gt-nudge-btn {
        display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 800; cursor: pointer;
        border: 2px solid var(--mascot-outline); background: var(--soft); color: var(--mascot-ink);
      }
      .sb-gt-nudge-btn:disabled { opacity: .6; cursor: default; }
      .sb-gt-goal-line { background: rgba(10,10,18,.68); }
      .sb-gt-goal-check { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 14px; border: 2px dashed var(--mascot-outline); background: var(--soft); color: var(--mascot-ink); }
      .sb-gt-goal-q { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800; }
      .sb-gt-goal-opts { display: flex; gap: 8px; }
      .sb-gt-locked-note {
        display: flex; align-items: center; gap: 6px; margin: 0 0 10px; padding: 8px 12px; border-radius: 12px; font-size: 12.5px; font-weight: 700;
        border: 1.5px solid #7C5CD1; background: color-mix(in srgb, #7C5CD1 12%, var(--card)); color: var(--mascot-ink);
      }
      .sb-gt-feed { flex: none; display: flex; flex-direction: column; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 2px dashed var(--mascot-outline); max-height: 190px; min-height: 0; }
      .sb-gt-feed-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12.5px; font-weight: 800; color: var(--mascot-ink); }
      .sb-gt-feed-head > span { display: inline-flex; align-items: center; gap: 6px; }
      .sb-gt-cheer-row { display: flex; gap: 2px; flex-wrap: wrap; }
      .sb-gt-feed-note { margin: 0; font-size: 12px; font-weight: 700; color: var(--muted); }
      .sb-gt-feed-empty { margin: 0; font-size: 12px; }
      .sb-gt-feed-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; overflow-y: auto; overscroll-behavior: contain; }
      .sb-gt-feed-list li { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; font-weight: 700; color: var(--mascot-ink); line-height: 1.35; }
      .sb-gt-feed-list time { flex: none; font-size: 11px; color: var(--muted); font-weight: 700; }
      .sb-gt-feed-list li.goal { font-weight: 800; }

      /* focus-lock switch (same rules as CommunityStyle, which only loads on the Community page) */
      .sb-focus-lock { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
      .sb-focus-lock-switch {
        display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px 5px 6px;
        border-radius: 999px; border: 2px solid var(--mascot-outline); background: var(--card);
        box-shadow: 2px 2px 0 var(--sticker-shadow, var(--mascot-outline)); cursor: pointer; font-weight: 800; font-size: 11.5px;
        color: var(--mascot-ink); transition: transform .12s ease;
      }
      .sb-focus-lock-switch:hover:not(:disabled) { transform: translateY(-1px); }
      .sb-focus-lock-switch:disabled { cursor: default; opacity: .75; }
      .sb-focus-lock-track { position: relative; width: 34px; height: 20px; border-radius: 999px; border: 2px solid var(--mascot-outline); flex-shrink: 0; background: #B9B0D8; transition: background .15s ease; }
      .sb-focus-lock-switch.locked .sb-focus-lock-track { background: #7C5CD1; }
      .sb-focus-lock-knob { position: absolute; top: 50%; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; color: #6B5B95; transform: translate(0, -50%); transition: transform .15s ease; }
      .sb-focus-lock-switch.locked .sb-focus-lock-knob { transform: translate(14px, -50%); color: #7C5CD1; }
      .sb-focus-lock-label { letter-spacing: .02em; text-transform: uppercase; }
      .sb-focus-lock-err { font-size: 10.5px; font-weight: 700; color: #C24444; max-width: 160px; text-align: right; }

      @media (min-width: 900px) {
        .sb-gt-below { grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); align-items: start; }
      }
      @media (max-width: 640px) {
        /* Name gets the whole first row (with back + actions); the Public/Private
           and Focus-lock pills drop to a second row instead of squeezing the name to "N.". */
        .sb-gt-room-head { flex-wrap: wrap; row-gap: 8px; }
        .sb-gt-room-name { flex: 1 1 0; }
        .sb-gt-head-actions { order: 2; }
        .sb-gt-head-pills { order: 3; flex-basis: 100%; }
      }
      @media (max-width: 520px) {
        .sb-gt-stats, .sb-gt-recap { padding: 14px; }
        .sb-gt-head-actions { gap: 6px; }
      }

      @media (prefers-reduced-motion: reduce) {
        .sb-gt-status.running .sb-gt-dot, .sb-gt-card.studying .sb-gt-dot, .sb-gt-row-skeleton { animation: none; }
        .sb-gt-gear:hover { transform: none; }
        .sb-gt-stage-bar > span, .sb-gt-card-bar > span { transition: none; }
      }

      /* ---------- Dark Mode overrides for Group Study Timer ---------- */
      [data-dark="true"] .sb-gt-card,
      [data-dark="true"] .sb-gt-stage,
      [data-dark="true"] .sb-gt-stats,
      [data-dark="true"] .sb-gt-recap,
      [data-dark="true"] .sb-gt-lobby-card,
      [data-dark="true"] .sb-gt-row {
        background: var(--card);
        border: 1px solid var(--border-subtle);
        box-shadow: var(--clay-raised);
      }
      [data-dark="true"] .sb-gt-card-subject {
        background: var(--soft);
        color: var(--ink);
        border: 1px solid var(--border-hi);
      }
      [data-dark="true"] .sb-gt-dialog {
        background: var(--card-hi);
        color: var(--ink);
        border: 1px solid var(--border-hi);
        box-shadow: var(--clay-raised);
      }

    `}</style>
  );
}
