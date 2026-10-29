import React from "react";

/*
 * Styles just for the sign-in/sign-up and onboarding-wizard screens.
 * Kept separate from GlobalStyle.jsx (which covers the whole in-app
 * experience) so this one file is the single place to touch if either
 * flow's *look* needs to change again. Every rule below still leans on
 * the same CSS custom properties (--ink, --accent, --outline, --soft...)
 * the rest of the app uses, and the same offset hard-shadow "sticker"
 * language (border + box-shadow: Npx Npx 0 var(--outline)) — this is a
 * glow-up of the existing screens, not a new design system.
 */
export default function AuthOnboardStyle() {
  return (
    <style>{`
      /* ---------- shared shell: floaty sparkle backdrop ---------- */
      .sb-flow-sparkles { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
      .sb-flow-sparkle {
        position: absolute; font-size: 22px; opacity: .55;
        animation: sb-flow-float 7s ease-in-out infinite;
        filter: drop-shadow(0 2px 0 rgba(0,0,0,0.04));
      }
      @keyframes sb-flow-float {
        0%, 100% { transform: translateY(0) rotate(-6deg); }
        50% { transform: translateY(-16px) rotate(8deg); }
      }

      /* ---------- shared card chrome ---------- */
      .sb-flow-card {
        background: linear-gradient(180deg, var(--card) 0%, var(--soft) 145%);
        border-radius: 30px; padding: 32px 30px 28px; max-width: 440px; width: 100%;
        text-align: center; border: 2.5px solid var(--outline);
        box-shadow: 6px 6px 0 var(--sticker-shadow, var(--outline));
        position: relative; z-index: 1; overflow: hidden;
        animation: sb-flow-card-in .5s cubic-bezier(.22,1,.36,1) both;
      }
      .sb-flow-card::after {
        content: ""; position: absolute; top: -30px; right: -30px; width: 90px; height: 90px;
        background: var(--soft); border-radius: 50%; opacity: .6; z-index: -1;
      }
      @keyframes sb-flow-card-in {
        from { opacity: 0; transform: translateY(14px) scale(.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .sb-flow-mascot-wrap { position: relative; display: inline-block; margin-bottom: 6px; }

      /* cute little speech bubble under the mascot */
      .sb-flow-bubble {
        display: inline-block; margin: 2px auto 4px; padding: 6px 14px; max-width: 260px;
        background: var(--soft); border: 2px solid var(--outline); border-radius: 999px;
        font-weight: 800; font-size: 11.5px; color: var(--ink); position: relative;
        animation: sb-flow-bubble-in .35s cubic-bezier(.22,1,.36,1) both;
      }
      @keyframes sb-flow-bubble-in {
        from { opacity: 0; transform: translateY(-4px) scale(.9); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .sb-flow-title { font-family: var(--font-display); font-size: 22px; margin: 8px 0 4px; line-height: 1.25; }
      .sb-flow-sub { color: var(--muted); font-size: 13px; margin-bottom: 18px; font-weight: 700; line-height: 1.4; }

      /* ---------- messages ---------- */
      .sb-flow-msg { border-radius: 12px; padding: 9px 13px; font-size: 12.5px; font-weight: 700; margin-bottom: 14px; text-align: left; display: flex; gap: 7px; align-items: flex-start; }
      .sb-flow-msg-error { background: #FDECEC; color: #A3363B; border: 1.5px solid #E7A9AC; }
      .sb-flow-msg-info { background: var(--soft); color: var(--ink); border: 1.5px solid var(--outline); }

      /* ---------- step transition (onboarding) ---------- */
      .sb-flow-step-viewport { position: relative; }
      .sb-flow-step-enter {
        animation: sb-flow-step-in .32s cubic-bezier(.22,1,.36,1) both;
        text-align: left;
      }
      @keyframes sb-flow-step-in {
        from { opacity: 0; transform: translateX(14px); }
        to { opacity: 1; transform: translateX(0); }
      }
      .sb-flow-step-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
      .sb-flow-step-icon {
        width: 30px; height: 30px; border-radius: 50%; background: var(--soft); border: 2px solid var(--outline);
        display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0;
      }
      .sb-flow-step-head label { font-weight: 800; font-size: 13px; color: var(--ink); }

      /* ---------- onboarding progress trail ---------- */
      .sb-ob-trail { display: flex; align-items: center; justify-content: center; margin: 4px 0 22px; }
      .sb-ob-trail-node {
        width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--outline); background: var(--card);
        display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0;
        transition: transform .25s cubic-bezier(.34,1.56,.64,1), background-color .25s ease, box-shadow .25s ease;
      }
      .sb-ob-trail-node.done { background: var(--soft); }
      .sb-ob-trail-node.active { transform: scale(1.22); box-shadow: 2px 2px 0 var(--sticker-shadow, var(--outline)); background: var(--accent); }
      .sb-ob-trail-line { width: 18px; height: 2.5px; background: var(--outline); opacity: .18; border-radius: 2px; margin: 0 3px; }
      .sb-ob-trail-line.done { opacity: .55; background: var(--accent); }

      /* ---------- onboarding form bits ---------- */
      .sb-ob-input-icon-wrap { position: relative; }
      .sb-ob-input-icon-wrap svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
      .sb-ob-input-icon-wrap .sb-input { padding-left: 34px; }
      .sb-ob-hint { font-size: 11px; color: var(--muted); font-weight: 700; margin-top: 6px; }

      .sb-ob-stepper { display: flex; align-items: center; gap: 14px; justify-content: center; margin-top: 4px; }
      .sb-ob-stepper-btn {
        width: 38px; height: 38px; border-radius: 50%; border: 2.5px solid var(--outline); background: var(--card);
        font-size: 18px; font-weight: 800; color: var(--ink); cursor: pointer; display: flex; align-items: center; justify-content: center;
        box-shadow: 2px 2px 0 var(--sticker-shadow, var(--outline)); transition: transform .12s ease, box-shadow .12s ease;
      }
      .sb-ob-stepper-btn:hover { transform: translate(-1px,-1px); box-shadow: 3px 3px 0 var(--sticker-shadow, var(--outline)); }
      .sb-ob-stepper-btn:active { transform: scale(.9); }
      .sb-ob-stepper-btn:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; transform: none; }
      .sb-ob-stepper-value { min-width: 92px; text-align: center; }
      .sb-ob-stepper-num { font-family: var(--font-display); font-size: 30px; line-height: 1; }
      .sb-ob-stepper-label { font-size: 11px; font-weight: 800; color: var(--muted); margin-top: 2px; }

      .sb-ob-exam-days { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; padding: 5px 11px; border-radius: 999px; background: var(--soft); border: 1.5px solid var(--outline); font-size: 11px; font-weight: 800; color: var(--ink); }

      .sb-ob-mascot-grid, .sb-ob-theme-grid { display: grid; gap: 10px; }
      .sb-ob-mascot-grid { grid-template-columns: repeat(3, 1fr); }
      .sb-ob-theme-grid { grid-template-columns: 1fr 1fr; }

      .sb-ob-mascot-pick {
        display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 12px 6px 9px; border-radius: 18px;
        border: 2.5px solid var(--outline); background: var(--card); font-size: 11.5px; font-weight: 800; cursor: pointer;
        box-shadow: 2px 2px 0 var(--sticker-shadow, var(--outline)); transition: transform .15s cubic-bezier(.34,1.56,.64,1), box-shadow .15s ease, background-color .15s ease;
      }
      .sb-ob-mascot-pick:hover { transform: translateY(-2px); box-shadow: 3px 3px 0 var(--sticker-shadow, var(--outline)); }
      .sb-ob-mascot-pick.active { background: var(--soft); transform: translateY(-2px) scale(1.03); box-shadow: 3px 3px 0 var(--sticker-shadow, var(--outline)); }
      .sb-ob-mascot-pick-check { position: absolute; }

      .sb-ob-theme-swatch {
        display: flex; align-items: center; gap: 8px; padding: 11px 12px; border-radius: 16px; border: 2.5px solid var(--outline);
        font-weight: 800; font-size: 12px; cursor: pointer; box-shadow: 2px 2px 0 var(--sticker-shadow, var(--outline)); text-align: left;
        transition: transform .15s cubic-bezier(.34,1.56,.64,1), box-shadow .15s ease; position: relative;
      }
      .sb-ob-theme-swatch:hover { transform: translateY(-2px); box-shadow: 3px 3px 0 var(--sticker-shadow, var(--outline)); }
      .sb-ob-theme-swatch.active { box-shadow: 3px 3px 0 var(--sticker-shadow, var(--outline)); transform: translateY(-2px); }
      .sb-ob-theme-swatch.active::after { content: "✓"; position: absolute; top: 6px; right: 8px; font-size: 11px; }
      .sb-ob-theme-dot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--outline); flex-shrink: 0; }

      .sb-flow-actions { display: flex; justify-content: center; gap: 10px; margin-top: 22px; }
      .sb-flow-actions .sb-btn-primary { position: relative; }
      .sb-flow-actions .sb-btn-primary::before {
        content: ""; position: absolute; inset: -4px; border-radius: 999px; background: var(--accent);
        opacity: .35; z-index: -1; animation: sb-flow-cta-pulse 2.4s ease-in-out infinite;
      }
      @keyframes sb-flow-cta-pulse {
        0%, 100% { transform: scale(1); opacity: .3; }
        50% { transform: scale(1.09); opacity: 0; }
      }

      /* ---------- auth: "What's StudyBun?" info panel (pages/auth/info/) ---------- */
      .sb-info-panel { text-align: left; display: flex; flex-direction: column; gap: 20px; cursor: default; }
      .sb-info-panel::after { display: none; } /* skip the corner-circle decor on this card — too busy alongside the feature grid */

      .sb-info-hero { display: flex; align-items: center; gap: 14px; }
      .sb-info-title { font-family: var(--font-display); font-weight: 800; font-size: 18px; color: var(--ink); }
      .sb-info-sub { color: var(--muted); font-size: 12px; font-weight: 700; margin-top: 4px; line-height: 1.5; }

      .sb-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .sb-info-feature {
        display: flex; flex-direction: column; gap: 6px; background: var(--card); border: 2px solid var(--outline);
        border-radius: 18px; padding: 12px 12px 11px; box-shadow: 2px 2px 0 var(--sticker-shadow, var(--outline));
        transition: transform .15s cubic-bezier(.34,1.56,.64,1), box-shadow .15s ease;
        animation: sb-flow-bubble-in .4s cubic-bezier(.22,1,.36,1) both;
      }
      .sb-info-feature:hover { transform: translateY(-3px) rotate(-1deg); box-shadow: 3px 3px 0 var(--sticker-shadow, var(--outline)); }
      .sb-info-feature-icon {
        width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--outline);
        display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0;
      }
      .sb-info-feature-label { font-weight: 800; font-size: 12px; color: var(--ink); }
      .sb-info-feature-blurb { font-weight: 600; font-size: 10.5px; color: var(--muted); line-height: 1.4; }

      .sb-info-note { display: flex; gap: 11px; align-items: flex-start; background: var(--soft); border: 2px dashed var(--outline); border-radius: 20px; padding: 13px 15px; }
      .sb-info-note-icon {
        width: 28px; height: 28px; border-radius: 999px; background: var(--card); border: 2px solid var(--outline);
        display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0;
      }
      .sb-info-note-title { font-weight: 800; font-size: 12.5px; color: var(--ink); margin-bottom: 6px; }
      .sb-info-note-row { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 11px; color: var(--muted); margin-top: 4px; }

      .sb-info-faq { display: flex; flex-direction: column; gap: 8px; }
      .sb-info-faq-title { font-family: var(--font-display); font-weight: 800; font-size: 14px; color: var(--ink); margin-bottom: 2px; }
      .sb-info-faq-item { border: 2px solid var(--outline); border-radius: 16px; background: var(--card); overflow: hidden; box-shadow: 2px 2px 0 var(--sticker-shadow, var(--outline)); transition: box-shadow .15s ease, transform .15s ease; }
      .sb-info-faq-item.open { box-shadow: 3px 3px 0 var(--sticker-shadow, var(--outline)); }
      .sb-info-faq-q {
        width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; text-align: left;
        background: none; border: none; cursor: pointer; padding: 11px 14px; font-weight: 800; font-size: 12px; color: var(--ink); font-family: inherit;
      }
      .sb-info-faq-item.open .sb-info-faq-q { color: var(--accent); background: var(--soft); }
      .sb-info-faq-chevron { transition: transform .2s ease; color: var(--muted); flex-shrink: 0; }
      .sb-info-faq-item.open .sb-info-faq-chevron { transform: rotate(180deg); color: var(--accent); }
      .sb-info-faq-a { padding: 10px 14px 13px; font-size: 11.5px; font-weight: 600; color: var(--muted); line-height: 1.55; animation: sb-flow-step-in .18s ease; }
      .sb-info-faq-a p { margin: 0 0 9px; }

      @media (max-width: 480px) {
        .sb-info-grid { grid-template-columns: 1fr; }
      }

      /* ---------- auth: sliding segmented mode toggle ---------- */
      .sb-au-toggle { position: relative; display: grid; grid-template-columns: 1fr 1fr; width: 100%; max-width: 260px; margin: 0 auto 20px; padding: 4px; background: var(--soft); border: 2px solid var(--outline); border-radius: 999px; }
      .sb-au-toggle-pill { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 4px); background: var(--card); border: 2px solid var(--outline); border-radius: 999px; box-shadow: 2px 2px 0 var(--sticker-shadow, var(--outline)); transition: transform .28s cubic-bezier(.34,1.56,.64,1); z-index: 0; }
      .sb-au-toggle[data-mode="signup"] .sb-au-toggle-pill { transform: translateX(100%); }
      .sb-au-toggle-btn { position: relative; z-index: 1; border: none; background: transparent; padding: 7px 10px; font-weight: 800; font-size: 12.5px; color: var(--muted); cursor: pointer; border-radius: 999px; transition: color .2s ease; }
      .sb-au-toggle-btn.active { color: var(--ink); }

      .sb-au-field { text-align: left; margin-bottom: 14px; }
      .sb-au-field label { display: flex; align-items: center; gap: 5px; font-weight: 800; font-size: 12.5px; color: var(--muted); margin-bottom: 6px; }
      .sb-au-form { text-align: left; }
      .sb-au-link-row { display: flex; justify-content: flex-end; margin-top: -4px; margin-bottom: 6px; }
      .sb-au-link { background: none; border: none; color: var(--accent); font-weight: 800; font-size: 12px; cursor: pointer; padding: 0; text-decoration: underline; }

      .sb-au-divider { display: flex; align-items: center; gap: 10px; margin: 4px 0 14px; }
      .sb-au-divider span { font-size: 10.5px; font-weight: 800; color: var(--muted); }
      .sb-au-divider::before, .sb-au-divider::after { content: ""; flex: 1; height: 1.5px; background: var(--outline); opacity: .2; }

      .sb-au-swap { margin-top: 16px; font-size: 12px; font-weight: 700; color: var(--muted); }
      .sb-au-swap button { background: none; border: none; color: var(--accent); font-weight: 800; cursor: pointer; padding: 0 0 0 4px; text-decoration: underline; }

      .sb-au-check-badge {
        width: 64px; height: 64px; border-radius: 50%; background: var(--soft); border: 2.5px solid var(--outline);
        display: flex; align-items: center; justify-content: center; margin: 4px auto 10px; animation: sb-flow-bubble-in .4s cubic-bezier(.34,1.56,.64,1) both;
      }

      /* ---------- auth info side panel polish (keeps prior structure) ---------- */
      .sb-flow-shell { display: flex; gap: 26px; align-items: flex-start; justify-content: center; flex-wrap: wrap; width: 100%; }
      .sb-flow-shell .sb-flow-card { max-width: 440px; flex: 1 1 380px; }

      @media (max-width: 900px) {
        .sb-flow-card { padding: 26px 20px 22px; border-radius: 24px; }
        .sb-ob-mascot-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
      }

      /* ---------- back-to-explore pill (shown above the auth card) ---------- */
      .sb-land-back-btn {
        position: fixed; top: 16px; left: 16px; z-index: 50; display: inline-flex; align-items: center; gap: 6px;
        background: var(--card); border: 2.5px solid var(--outline); border-radius: 999px; padding: 9px 16px;
        font-family: var(--font-body); font-weight: 800; font-size: 12.5px; color: var(--ink); cursor: pointer;
        box-shadow: 3px 3px 0 var(--sticker-shadow, var(--outline)); transition: transform .15s cubic-bezier(.34,1.56,.64,1), box-shadow .15s ease;
        animation: sb-flow-bubble-in .4s cubic-bezier(.34,1.56,.64,1) both;
      }
      .sb-land-back-btn:hover { transform: translate(-2px,-2px); box-shadow: 5px 5px 0 var(--sticker-shadow, var(--outline)); }
      @media (max-width: 480px) { .sb-land-back-btn { top: 10px; left: 10px; padding: 8px 13px; font-size: 11.5px; } }

      /* ---------- Onboarding Appearance Toggle & Dark Mode Overrides ---------- */
      .sb-ob-mode-row {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }
      .sb-ob-mode-btn {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 9px 14px;
        border-radius: 999px;
        border: 2px solid var(--outline);
        background: var(--card);
        color: var(--ink);
        font-family: var(--font-body);
        font-weight: 800;
        font-size: 12.5px;
        cursor: pointer;
        box-shadow: 2px 2px 0 var(--sticker-shadow, var(--outline));
        transition: transform .12s ease, box-shadow .12s ease, background .15s ease;
      }
      .sb-ob-mode-btn.active {
        background: var(--accent);
        color: #fff;
        border-color: var(--outline);
      }
      [data-dark="true"] .sb-flow-card,
      [data-dark="true"] .sb-onboard-card {
        background: var(--card);
        border: 1px solid var(--border-hi);
        box-shadow: var(--clay-raised);
      }
      [data-dark="true"] .sb-flow-bubble {
        background: var(--card-hi);
        border: 1px solid var(--border-hi);
        box-shadow: var(--clay-raised-sm);
      }
      [data-dark="true"] .sb-flow-msg-error {
        background: rgba(255, 110, 108, 0.14);
        color: #FF9492;
        border-color: rgba(255, 110, 108, 0.36);
      }
      [data-dark="true"] .sb-ob-mode-btn {
        background: var(--card-hi);
        border: 1px solid var(--border-subtle);
        color: var(--ink-secondary);
        box-shadow: var(--clay-raised-sm);
      }
      [data-dark="true"] .sb-ob-mode-btn.active {
        background: linear-gradient(150deg, var(--accent-light, var(--accent)), var(--accent));
        color: var(--on-accent, #26100C);
        border-color: rgba(255, 255, 255, 0.2);
        box-shadow: var(--clay-raised-sm);
      }
      [data-dark="true"] .sb-ob-theme-swatch {
        background: var(--card-hi) !important;
        color: var(--ink) !important;
        border: 1.5px solid color-mix(in srgb, var(--swatch-accent, var(--accent)) 42%, rgba(255, 255, 255, 0.08)) !important;
        box-shadow: var(--clay-raised-sm) !important;
      }
      [data-dark="true"] .sb-ob-theme-swatch.active {
        background: color-mix(in srgb, var(--swatch-accent, var(--accent)) 22%, var(--card-hi)) !important;
        border-color: var(--swatch-accent, var(--accent)) !important;
        box-shadow: var(--clay-raised-sm), 0 0 0 2px color-mix(in srgb, var(--swatch-accent, var(--accent)) 32%, transparent) !important;
      }
      [data-dark="true"] .sb-land-back-btn {
        background: var(--card-hi);
        border: 1px solid var(--border-hi);
        box-shadow: var(--clay-raised-sm);
      }

    `}</style>
  );
}
