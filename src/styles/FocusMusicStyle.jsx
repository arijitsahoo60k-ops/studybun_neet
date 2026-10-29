import React from "react";

// Styles for Focus Music (the root-level player stage, the Sound section of
// Timer Settings, and the little now-playing bar on the timer card). Rendered
// by FocusMusicStage, which lives at the app root, so they're always
// available. Theme vars (--card, --soft, --accent, --mascot-outline...)
// resolve because everything lives inside .sb-app.
export default function FocusMusicStyle() {
  return (
    <style>{`
      /* ----- the one real player ----- */
      /* Tucked = audio only. YouTube asks embeds to be at least 200x200, so
         it's a real-size player parked off-screen rather than a 1px sliver. */
      .sb-music-stage {
        position: fixed; left: -10000px; top: 0; width: 200px; height: 200px;
        overflow: hidden; opacity: 0; pointer-events: none; z-index: 1;
      }
      .sb-music-stage iframe { display: block; width: 100%; height: 100%; border: 0; }
      /* above .sb-pt-overlay (90) so the video shows on top of the dialog;
         pointer-events stay off so every click falls through to the dialog. */
      .sb-music-stage.in-slot { left: 0; opacity: 1; z-index: 95; border-radius: 12px; will-change: transform; }

      /* ----- Sound section in Timer Settings ----- */
      .sb-music {
        display: flex; flex-direction: column; gap: 14px;
        padding: 16px 0 2px; border-top: 2px dashed var(--mascot-outline);
      }
      .sb-music-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
      .sb-music-hint { margin: -6px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--muted); }

      .sb-music-preview {
        position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 14px;
        border: 2px solid var(--mascot-outline); background: var(--soft) center / cover no-repeat;
        box-shadow: 3px 3px 0 var(--sticker-shadow, var(--mascot-outline)); display: flex; align-items: center; justify-content: center;
        color: var(--muted); font-size: 13px; font-weight: 700; text-align: center; padding: 12px;
        box-sizing: border-box;
      }
      .sb-music-preview.dim::after { content: ""; position: absolute; inset: 0; border-radius: 12px; background: rgba(20,16,14,.28); }

      .sb-music-now { display: flex; align-items: center; gap: 10px; }
      .sb-music-now-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
      .sb-music-now-title { font-weight: 800; font-size: 14px; color: var(--mascot-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sb-music-now-sub { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sb-music-ctrls { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; }
      .sb-music-ico {
        width: 34px; height: 34px; border-radius: 50%; border: 2px solid var(--mascot-outline);
        background: var(--card); color: var(--mascot-ink); cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center; padding: 0;
        transition: transform .12s ease, background-color .2s ease;
      }
      .sb-music-ico:hover:not(:disabled) { transform: translateY(-1px); }
      .sb-music-ico:disabled { opacity: .45; cursor: not-allowed; }
      .sb-music-ico.primary { background: var(--accent); color: #fff; width: 40px; height: 40px; }
      .sb-music-ico.small { width: 26px; height: 26px; }
      .sb-music-ico.danger:hover:not(:disabled) { background: rgba(209,73,91,.16); }

      .sb-music-volume { display: flex; align-items: center; gap: 10px; color: var(--muted); }
      .sb-music-volume input[type="range"] { flex: 1; accent-color: var(--accent); min-width: 0; }
      .sb-music-volume span { font-size: 12px; font-weight: 800; width: 34px; text-align: right; }

      .sb-music-note { margin: 0; display: flex; align-items: flex-start; gap: 6px; font-size: 12.5px; line-height: 1.45; font-weight: 700; color: var(--muted); }
      .sb-music-note.err { color: #d1495b; }
      .sb-music-note button { margin-left: 6px; }

      /* ----- Stations | My music pill ----- */
      .sb-music-pill {
        position: relative; display: grid; grid-template-columns: 1fr 1fr; padding: 4px;
        border-radius: 999px; border: 2px solid var(--mascot-outline); background: var(--soft);
      }
      .sb-music-pill-thumb {
        position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 4px);
        border-radius: 999px; background: var(--accent); border: 2px solid var(--mascot-outline);
        box-shadow: 2px 2px 0 var(--sticker-shadow, var(--mascot-outline)); box-sizing: border-box;
        transition: transform .28s cubic-bezier(.4,1.3,.5,1);
      }
      .sb-music-pill[data-active="own"] .sb-music-pill-thumb { transform: translateX(100%); }
      .sb-music-pill button {
        position: relative; z-index: 1; border: 0; background: none; cursor: pointer;
        padding: 8px 10px; border-radius: 999px; font-weight: 800; font-size: 13.5px; color: var(--muted);
        display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: color .2s ease;
      }
      .sb-music-pill button[aria-selected="true"] { color: #fff; }

      /* ----- panels ----- */
      .sb-music-panel { display: flex; flex-direction: column; gap: 12px; animation: sb-pop .18s ease; }
      .sb-music-chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .sb-music-chip-sub { display: block; font-size: 11px; font-weight: 600; opacity: .8; }
      .sb-radio-chip.sb-music-chip-add { border-style: dashed; color: var(--muted); }

      .sb-music-inline-form { display: flex; gap: 8px; align-items: center; }
      .sb-music-inline-form .sb-input { flex: 1; min-width: 0; font-size: 14px; padding: 10px 12px; }

      .sb-music-empty {
        display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;
        padding: 18px 14px; border-radius: 14px; border: 2px dashed var(--mascot-outline);
        color: var(--muted); font-size: 13px; line-height: 1.5;
      }

      .sb-music-plcard {
        display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 16px;
        border: 2px solid var(--mascot-outline); background: var(--card);
      }
      .sb-music-plhead { display: flex; align-items: center; gap: 8px; }
      .sb-music-plname { flex: 1; min-width: 0; font-family: var(--font-display); font-weight: 800; font-size: 16px; color: var(--mascot-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sb-music-plopts { display: flex; gap: 8px; flex-wrap: wrap; }
      .sb-music-plopts .sb-sound-toggle { padding: 6px 12px; font-size: 12.5px; }
      .sb-music-confirm { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12.5px; font-weight: 700; color: #d1495b; }

      .sb-music-tracks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; overscroll-behavior: contain; padding-right: 2px; }
      .sb-music-track {
        display: flex; align-items: center; gap: 6px; padding: 6px; border-radius: 12px;
        border: 2px solid transparent; background: var(--soft);
      }
      .sb-music-track.current { border-color: var(--accent); }
      .sb-music-track-main {
        flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; text-align: left;
        border: 0; background: none; padding: 0; cursor: pointer; color: inherit; font: inherit;
      }
      .sb-music-track-main img { width: 62px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 8px; border: 1.5px solid var(--mascot-outline); flex-shrink: 0; background: var(--card); }
      .sb-music-track-text { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
      .sb-music-track-title { font-weight: 800; font-size: 13px; color: var(--mascot-ink); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.25; }
      .sb-music-track-author { font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sb-music-track-actions { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }

      /* equaliser bars */
      .sb-music-eq { display: inline-flex; align-items: flex-end; gap: 2px; height: 14px; flex-shrink: 0; }
      .sb-music-eq i { width: 3px; height: 4px; border-radius: 2px; background: var(--accent); }
      .sb-music-eq.on i { animation: sb-music-eq 0.9s ease-in-out infinite; }
      .sb-music-eq.on i:nth-child(2) { animation-delay: -.3s; }
      .sb-music-eq.on i:nth-child(3) { animation-delay: -.6s; }
      @keyframes sb-music-eq { 0%, 100% { height: 4px; } 50% { height: 14px; } }

      /* ----- now-playing bar under the timer controls ----- */
      .sb-music-mini {
        display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;
        margin: 12px auto 0; padding: 7px 12px; max-width: 100%; box-sizing: border-box;
        border-radius: 999px; border: 2px solid var(--mascot-outline); background: var(--soft);
        font-size: 12.5px; font-weight: 700; color: var(--mascot-ink);
      }
      .sb-music-mini-title { min-width: 0; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sb-music-mini-muted { color: var(--muted); font-weight: 700; }
      .sb-music-mini-link { border: 0; background: none; cursor: pointer; padding: 0; font: inherit; color: var(--muted); text-decoration: underline; text-underline-offset: 3px; }
      .sb-music-mini-link:hover { color: var(--mascot-ink); }
      .sb-music-mini-cta { border: 2px solid var(--mascot-outline); background: var(--accent); color: #fff; border-radius: 999px; padding: 4px 12px; font: inherit; font-weight: 800; cursor: pointer; }
      .sb-music-mini-solo { display: flex; justify-content: center; margin-top: 10px; }

      @media (max-width: 420px) {
        .sb-music-track-main img { width: 50px; }
        .sb-music-mini-title { max-width: 140px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .sb-music-eq.on i { animation: none; height: 9px; }
        .sb-music-pill-thumb { transition: none; }
      }

      /* ---------- Dark Mode overrides for Focus Music ---------- */
      [data-dark="true"] .sb-music-mini,
      [data-dark="true"] .sb-music-track-row {
        background: var(--card-hi);
        border: 1px solid var(--border-subtle);
        box-shadow: var(--clay-raised-sm);
      }
      [data-dark="true"] .sb-music-mini-cta {
        background: linear-gradient(150deg, var(--accent-light, var(--accent)), var(--accent));
        color: var(--on-accent, #26100C);
        border-color: rgba(255, 255, 255, 0.18);
        box-shadow: var(--clay-raised-sm);
      }

    `}</style>
  );
}
