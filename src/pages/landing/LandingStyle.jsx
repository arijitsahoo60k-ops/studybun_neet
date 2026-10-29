import React from "react";

/*
 * Styles for the pre-auth landing page (src/pages/landing).
 *
 * Self-contained on purpose: this page renders before Auth mounts and must
 * not depend on the per-theme sticker language (outlines + hard shadows)
 * used inside the app. Everything is namespaced `lp-` and tokens are
 * `--lp-*`, so nothing here collides with the theme variables the mascot
 * SVGs and ScratchReveal still read from the wrapper in AppRoot.
 *
 * The page is a single sky: dusk hero -> cream daylight -> night.
 */
export default function LandingStyle() {
  return (
    <style>{`
      .lp {
        --lp-night: #0A1138; --lp-night-2: #0E1750; --lp-night-3: #16206A;
        --lp-coral: #E8735F; --lp-coral-ink: #B8412D; --lp-peach: #F6A98F;
        --lp-cream: #FFF4E8; --lp-ink: #2A1B4D; --lp-ink-soft: #6B5878;
        --lp-line: rgba(42, 27, 77, .14);
        --lp-seam: #E38B83; /* bottom edge colour of the wide sky image */
        --lp-display: 'Baloo 2', system-ui, sans-serif;
        --lp-body: 'Nunito', system-ui, sans-serif;
        position: relative; min-height: 100vh;
        overflow-x: hidden; overflow-x: clip; /* clip, not hidden: keeps position:sticky working */
        font-family: var(--lp-body); color: var(--lp-ink); background: var(--lp-cream);
        -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
      }
      @media (max-aspect-ratio: 1/1) { .lp { --lp-seam: #F79B81; } } /* tall sky image */
      /* resets live in :where() so they have zero specificity and never beat a component class */
      :where(.lp) *, :where(.lp) *::before, :where(.lp) *::after { box-sizing: border-box; }
      :where(.lp) :where(img) { display: block; max-width: 100%; height: auto; }
      :where(.lp) :where(h1, h2, h3, p, ul, figure) { margin: 0; padding: 0; }
      :where(.lp) :where(ul) { list-style: none; }
      .lp button:focus-visible, .lp [tabindex]:focus-visible { outline: 3px solid var(--lp-coral); outline-offset: 3px; }

      .lp-wrap { width: 100%; max-width: 1120px; margin: 0 auto; padding: 0 clamp(20px, 5vw, 40px); }

      .lp-h2 { font: 800 clamp(32px, 4.8vw, 54px)/1.04 var(--lp-display); letter-spacing: -.01em; color: var(--lp-ink); text-wrap: balance; }
      .lp-h2-light { color: var(--lp-cream); }
      .lp-lede { margin-top: 16px; max-width: 36ch; text-wrap: pretty; font: 600 18px/1.6 var(--lp-body); color: var(--lp-ink-soft); }

      /* ---------- buttons ---------- */
      .lp-btn {
        display: inline-flex; align-items: center; justify-content: center; border: 0; cursor: pointer;
        padding: 17px 30px; border-radius: 999px; font: 800 16px/1 var(--lp-body);
        transition: transform .2s cubic-bezier(.22, 1, .36, 1), box-shadow .2s ease, background .2s ease;
      }
      .lp-btn-primary {
        color: var(--lp-ink); background: linear-gradient(180deg, #FFF3DF 0%, #FFD9A6 100%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.9), inset 0 -3px 0 rgba(224,140,80,.35), 0 14px 34px rgba(255,170,100,.30);
      }
      .lp-btn-primary:hover { transform: translateY(-2px); box-shadow: inset 0 1px 0 rgba(255,255,255,.9), inset 0 -3px 0 rgba(224,140,80,.35), 0 20px 44px rgba(255,170,100,.42); }
      .lp-btn-primary:active { transform: translateY(1px); }
      .lp-btn-ghost { color: var(--lp-cream); background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1px rgba(255,244,232,.45); }
      .lp-btn-ghost:hover { background: rgba(255,255,255,.17); }

      /* ---------- hero ---------- */
      .lp-hero {
        position: relative; z-index: 3; min-height: max(700px, 100svh); display: grid; place-items: center; text-align: center;
        padding: clamp(96px, 14vh, 128px) 20px clamp(190px, 26vh, 260px);
      }
      .lp-hero-sky { position: absolute; inset: 0; overflow: hidden; background: var(--lp-night); }
      .lp-hero-sky img { width: 100%; height: 100%; object-fit: cover; object-position: center bottom; }

      /* every floating layer reads --sy (scroll) and --d (depth) from the hero */
      .lp-layer {
        position: absolute; pointer-events: none;
        transform: translate3d(0, calc(var(--sy, 0) * var(--d, 0) * 1px), 0); will-change: transform;
      }
      .lp-cloud { height: auto; }
      .lp-cloud-behind { z-index: 1; left: 4vw; top: 34%; width: clamp(200px, 26vw, 400px); }
      .lp-cloud-mid-r  { z-index: 1; right: -2vw; top: 47%; width: clamp(150px, 19vw, 290px); }
      .lp-cloud-far    { z-index: 1; right: 16vw; top: 18%; width: clamp(90px, 10vw, 150px); opacity: .9; }
      .lp-cloud-mid-l  { z-index: 1; left: -5vw; top: 62%; width: clamp(160px, 20vw, 300px); }

      .lp-front-l { z-index: 6; left: -7vw; bottom: -6vw; width: clamp(280px, 40vw, 620px); }
      .lp-front-r { z-index: 6; right: -5vw; bottom: -4.5vw; width: clamp(240px, 34vw, 500px); }
      .lp-front-r-cloud { width: 100%; }
      .lp-front-r-bunny {
        position: absolute; left: 30%; bottom: 52%; width: 44%;
        filter: drop-shadow(0 16px 18px rgba(6, 8, 40, .4));
      }

      .lp-spark { z-index: 2; }
      .lp-spark img { filter: drop-shadow(0 0 10px rgba(255, 190, 90, .65)); animation: lp-twinkle 3.6s ease-in-out var(--t, 0s) infinite; }
      @keyframes lp-twinkle { 0%, 100% { scale: .82; opacity: .7; } 50% { scale: 1.08; opacity: 1; } }

      .lp-hero-stage { position: relative; z-index: 5; width: 100%; max-width: 760px; }
      .lp-hero-title { width: min(760px, 88vw); margin: 0 auto; }
      .lp-hero-title img { width: 100%; filter: drop-shadow(0 22px 30px rgba(6, 8, 40, .5)); }
      .lp-hero-tag { margin-top: 14px; text-wrap: balance; font: 700 clamp(22px, 3.1vw, 34px)/1.15 var(--lp-display); color: var(--lp-cream); }
      .lp-hero-sub { margin: 10px auto 0; max-width: 46ch; text-wrap: balance; font: 600 clamp(15.5px, 1.6vw, 18px)/1.6 var(--lp-body); color: rgba(255, 244, 232, .88); }
      .lp-hero-ctas { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 28px; }
      .lp-hero-ctas .lp-btn { min-width: 220px; }
      .lp-hero-notes { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 24px; margin-top: 28px; }
      .lp-hero-notes li { display: inline-flex; align-items: center; gap: 7px; font: 700 13.5px/1.2 var(--lp-body); color: rgba(255, 244, 232, .8); }

      /* One orchestrated entrance. The wordmark also bobs, slowly; nothing else idles
         except the sparkles' twinkle. */
      @keyframes lp-rise { from { opacity: 0; transform: translateY(26px) scale(.95); } to { opacity: 1; transform: none; } }
      @keyframes lp-bob { 0%, 100% { translate: 0 0; } 50% { translate: 0 -9px; } }
      .lp-hero-title img { animation: lp-rise .9s cubic-bezier(.22, 1, .36, 1) .1s both, lp-bob 7s ease-in-out 1.2s infinite; }
      .lp-hero-tag   { animation: lp-rise .7s cubic-bezier(.22, 1, .36, 1) .4s both; }
      .lp-hero-sub   { animation: lp-rise .7s cubic-bezier(.22, 1, .36, 1) .5s both; }
      .lp-hero-ctas  { animation: lp-rise .7s cubic-bezier(.22, 1, .36, 1) .6s both; }
      .lp-hero-notes { animation: lp-rise .7s cubic-bezier(.22, 1, .36, 1) .72s both; }

      /* ---------- features (daylight, sunrise glow at the top) ---------- */
      .lp-features {
        position: relative; z-index: 1;
        padding: clamp(150px, 18vw, 230px) 0 clamp(72px, 9vw, 120px);
        background: linear-gradient(180deg, var(--lp-seam) 0, #F7BBA4 150px, #FFE0CD 330px, var(--lp-cream) 520px);
      }
      .lp-features-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: clamp(32px, 6vw, 88px); align-items: start; }
      .lp-features-lead { position: sticky; top: 104px; }
      .lp-features-bunny { margin: 28px 0 0 -8px; height: min(44vh, 400px); width: auto; filter: drop-shadow(0 22px 22px rgba(160, 70, 60, .22)); }

      .lp-features-list li { display: grid; grid-template-columns: 104px 1fr; gap: 24px; align-items: center; padding: 26px 0; border-top: 1px solid var(--lp-line); }
      .lp-features-list li:first-child { border-top: 0; padding-top: 0; }
      .lp-features-list h3 { font: 700 24px/1.15 var(--lp-display); color: var(--lp-ink); margin-bottom: 6px; }
      .lp-features-list p { max-width: 46ch; font: 600 16px/1.6 var(--lp-body); color: var(--lp-ink-soft); }
      .lp-prop { width: 104px; height: 104px; display: grid; place-items: center; }
      .lp-prop img {
        width: auto; height: auto; max-width: 92px; max-height: 92px;
        filter: drop-shadow(0 12px 12px rgba(150, 70, 60, .24));
        transition: transform .4s cubic-bezier(.34, 1.56, .64, 1);
      }
      .lp-prop img.is-head { width: 92px; height: 92px; object-fit: cover; object-position: 50% 0; }
      .lp-features-list li:hover .lp-prop img { transform: rotate(-7deg) translateY(-4px) scale(1.06); }

      /* ---------- themes ---------- */
      /* container-type lets the rail measure the page width *without* the scrollbar (100cqw),
         so the three-card group is centred exactly under the heading, not 7px off. */
      .lp-themes { position: relative; z-index: 1; container-type: inline-size; background: var(--lp-cream); padding: clamp(40px, 6vw, 80px) 0 clamp(64px, 8vw, 110px); }
      .lp-section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap; margin-bottom: 36px; }

      /* Arrows live on the showcase itself, sitting on the edges of the card group. */
      .lp-rail-stage { position: relative; }
      .lp-rail-btn {
        position: absolute; top: calc(50% - 36px); z-index: 2;
        width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
        border: 1px solid var(--lp-line); background: #fff; color: var(--lp-ink);
        box-shadow: 0 10px 24px rgba(60, 30, 70, .22);
        transition: background .2s ease, color .2s ease, opacity .2s ease, transform .2s ease;
      }
      .lp-rail-btn:hover:not(:disabled) { background: var(--lp-ink); color: var(--lp-cream); }
      .lp-rail-btn:active:not(:disabled) { transform: scale(.94); }
      .lp-rail-btn:disabled { opacity: 0; pointer-events: none; }
      .lp-rail-prev { left: max(6px, calc(var(--rail-pad) - 24px)); }
      .lp-rail-next { right: max(6px, calc(var(--rail-pad) - 24px)); }

      /* Six mascots in one even row, two to a card column, so the block mirrors the cards below. */
      .lp-mascots { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); justify-items: center; gap: 20px 0; margin-bottom: clamp(36px, 5vw, 56px); }
      .lp-mascot { display: grid; justify-items: center; gap: 8px; }
      .lp-mascot > span:last-child { font: 700 13px/1 var(--lp-body); color: var(--lp-ink-soft); }
      .lp-mascot-plate {
        width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center; background: #fff;
        box-shadow: 0 10px 24px rgba(120, 60, 70, .14), inset 0 0 0 1px rgba(42, 27, 77, .06);
      }

      /* --rail-pad is exactly where .lp-wrap's content starts, so the first card lines up with the heading.
         Desktop shows 3 cards; the 4th peeks into the right margin and fades out (mirrored on the left once scrolled). */
      .lp-rail {
        --gap: 18px; --cards: 3;
        display: flex; gap: var(--gap); overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none;
        padding: 6px var(--rail-pad) 30px; scroll-padding-inline: var(--rail-pad);
        -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 var(--rail-pad), #000 calc(100% - var(--rail-pad)), transparent 100%);
                mask-image: linear-gradient(90deg, transparent 0, #000 var(--rail-pad), #000 calc(100% - var(--rail-pad)), transparent 100%);
      }
      .lp-rail-stage { --rail-pad: calc(max(0px, (100cqw - 1120px) / 2) + clamp(20px, 5vw, 40px)); }
      .lp-rail::-webkit-scrollbar { display: none; }
      .lp-theme-card {
        position: relative; flex: 0 0 calc((100cqw - 2 * var(--rail-pad) - (var(--cards) - 1) * var(--gap)) / var(--cards));
        aspect-ratio: 4 / 3; scroll-snap-align: start;
        border-radius: 26px; overflow: hidden; background: var(--lp-night); box-shadow: 0 18px 40px rgba(60, 30, 70, .22);
      }
      .lp-theme-card img { width: 100%; height: 100%; object-fit: cover; }
      .lp-theme-card figcaption {
        position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: space-between; gap: 10px;
        padding: 46px 16px 14px; background: linear-gradient(180deg, transparent, rgba(10, 12, 40, .85)); color: #fff; font: 800 15px/1.2 var(--lp-body);
      }
      .lp-dots { display: inline-flex; flex-shrink: 0; }
      .lp-dots i { width: 14px; height: 14px; border-radius: 50%; margin-left: -4px; border: 2px solid rgba(255, 255, 255, .92); }
      .lp-dots i:first-child { margin-left: 0; }

      .lp-note { margin-top: 8px; font: 700 15px/1.4 var(--lp-body); color: var(--lp-ink-soft); }
      .lp-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
      .lp-chip {
        display: inline-flex; align-items: center; gap: 9px; padding: 7px 14px 7px 10px; border-radius: 999px; background: #fff;
        border: 1px solid var(--lp-line); font: 700 13px/1 var(--lp-body); color: var(--lp-ink);
      }
      .lp-chip .lp-dots i { width: 12px; height: 12px; border-color: #fff; }

      /* ---------- trust ---------- */
      .lp-trust { position: relative; z-index: 1; background: var(--lp-cream); padding: 0 0 clamp(72px, 9vw, 120px); }
      .lp-trust-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 36px; border-top: 1px solid var(--lp-line); }
      .lp-trust-item { padding: 30px clamp(16px, 3vw, 36px) 0 0; }
      .lp-trust-item + .lp-trust-item { padding-left: clamp(16px, 3vw, 36px); border-left: 1px solid var(--lp-line); }
      .lp-trust-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; margin-bottom: 14px; background: rgba(232, 115, 95, .14); color: var(--lp-coral-ink); }
      .lp-trust-item h3 { font: 700 21px/1.2 var(--lp-display); color: var(--lp-ink); margin-bottom: 8px; }
      .lp-trust-item p { font: 600 15.5px/1.6 var(--lp-body); color: var(--lp-ink-soft); }

      /* ---------- dusk bridge: cream -> peach -> violet -> night ---------- */
      .lp-dusk {
        position: relative; z-index: 2; height: clamp(240px, 30vw, 360px); overflow: visible;
        background:
          url(/landing/grain.webp),
          linear-gradient(180deg, var(--lp-cream) 0%, #FBD5C0 22%, #F2A58F 42%, #9A78A8 68%, #3A3F8A 88%, var(--lp-night) 100%);
      }
      .lp-dusk-cloud { position: absolute; height: auto; }
      .lp-dusk-a { left: 6vw; bottom: 18%; width: clamp(130px, 17vw, 250px); }
      .lp-dusk-b { right: -3vw; bottom: 6%; width: clamp(200px, 28vw, 420px); }
      .lp-dusk-c { left: 44vw; bottom: 34%; width: clamp(80px, 9vw, 130px); opacity: .9; }

      /* ---------- night ---------- */
      /* The ten stars are drawn as tiny 6px no-repeat tiles (positioned by the same
         percentages as before) rather than ten full-height radial gradients. Looks
         identical, but opening or closing an FAQ item resizes this box, and the old
         version re-rasterised every star across the whole section on each toggle,
         which is what made the FAQ lag on desktop and tablet. */
      .lp-night {
        position: relative; z-index: 1; margin-top: -1px;
        background-color: var(--lp-night-3);
        background-image:
          radial-gradient(circle at 50% 50%, rgba(255,232,190,0.95) 0 1.2px, transparent 2px),
          radial-gradient(circle at 50% 50%, rgba(255,232,190,0.8) 0 1px, transparent 1.8px),
          radial-gradient(circle at 50% 50%, rgba(255,232,190,0.7) 0 1px, transparent 1.8px),
          radial-gradient(circle at 50% 50%, rgba(255,232,190,0.95) 0 1.4px, transparent 2.2px),
          radial-gradient(circle at 50% 50%, rgba(255,232,190,0.7) 0 1px, transparent 1.8px),
          radial-gradient(circle at 50% 50%, rgba(255,232,190,0.8) 0 1.1px, transparent 1.9px),
          radial-gradient(circle at 50% 50%, rgba(255,232,190,0.6) 0 1px, transparent 1.8px),
          radial-gradient(circle at 50% 50%, rgba(255,232,190,0.85) 0 1.2px, transparent 2px),
          radial-gradient(circle at 50% 50%, rgba(255,232,190,0.7) 0 1px, transparent 1.8px),
          radial-gradient(circle at 50% 50%, rgba(255,232,190,0.8) 0 1.1px, transparent 1.9px),
          url(/landing/grain.webp),
          linear-gradient(180deg, var(--lp-night) 0%, var(--lp-night-2) 45%, var(--lp-night-3) 100%);
        background-size: 6px 6px, 6px 6px, 6px 6px, 6px 6px, 6px 6px, 6px 6px, 6px 6px, 6px 6px, 6px 6px, 6px 6px, auto, auto;
        background-repeat: no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, repeat, no-repeat;
        background-position:
          calc(12% - 3px) calc(6% - 3px),
          calc(83% - 3px) calc(4% - 3px),
          calc(31% - 3px) calc(13% - 3px),
          calc(66% - 3px) calc(17% - 3px),
          calc(92% - 3px) calc(27% - 3px),
          calc(5% - 3px) calc(34% - 3px),
          calc(48% - 3px) calc(41% - 3px),
          calc(88% - 3px) calc(55% - 3px),
          calc(18% - 3px) calc(63% - 3px),
          calc(74% - 3px) calc(72% - 3px),
          0 0, 0 0;
      }

      .lp-faq { padding: clamp(36px, 6vw, 72px) 0 clamp(64px, 8vw, 110px); }
      .lp-faq-grid { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 7fr); gap: clamp(28px, 6vw, 80px); align-items: start; }
      .lp-faq-grid .lp-h2 { position: sticky; top: 104px; }
      .lp-faq-list { display: grid; gap: 10px; }
      .lp-faq-item { border-radius: 20px; overflow: hidden; background: rgba(255, 255, 255, .05); border: 1px solid rgba(255, 244, 232, .14); transition: background .25s ease; }
      .lp-faq-item.open { background: rgba(255, 255, 255, .1); }
      .lp-faq-q {
        width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px; text-align: left; cursor: pointer;
        padding: 20px 22px; background: none; border: 0; color: var(--lp-cream); font: 700 17px/1.35 var(--lp-body);
      }
      .lp-faq-chevron { flex-shrink: 0; color: rgba(255, 244, 232, .7); transition: transform .25s ease; }
      .lp-faq-item.open .lp-faq-chevron { transform: rotate(180deg); }
      .lp-faq-a { padding: 0 22px 22px; color: rgba(255, 244, 232, .82); font: 600 15.5px/1.65 var(--lp-body); }
      .lp-faq-a p { max-width: 62ch; margin-bottom: 14px; }
      .lp-faq-a p:last-child { margin-bottom: 0; }

      .lp-closing { padding: clamp(24px, 4vw, 56px) 0 clamp(56px, 7vw, 96px); text-align: center; }
      .lp-closing-inner { display: flex; flex-direction: column; align-items: center; }
      .lp-closing-scene {
        position: relative; width: min(440px, 80vw); aspect-ratio: 1 / .82; margin-bottom: 8px;
        background: radial-gradient(closest-side, rgba(255, 170, 120, .26), transparent);
      }
      .lp-closing-cloud { position: absolute; left: 0; bottom: 0; width: 100%; }
      .lp-closing-bunny { position: absolute; left: 22%; bottom: 26%; width: 56%; filter: drop-shadow(0 14px 18px rgba(5, 8, 40, .45)); }
      .lp-closing-spark { position: absolute; filter: drop-shadow(0 0 10px rgba(255, 190, 90, .65)); animation: lp-twinkle 3.6s ease-in-out infinite; }
      .lp-cs-a { width: 26px; top: 8%; right: 14%; }
      .lp-cs-b { width: 20px; top: 24%; left: 10%; animation-delay: 1.4s; }
      .lp-closing-sub { max-width: 40ch; margin: 16px auto 28px; font: 600 17px/1.6 var(--lp-body); color: rgba(255, 244, 232, .85); }

      .lp-footer { padding: 8px 20px 56px; text-align: center; color: rgba(255, 244, 232, .72); font: 600 14px/1.5 var(--lp-body); }
      .lp .sb-scratch-wrap { background: rgba(255, 255, 255, .08); border-color: rgba(255, 244, 232, .32); box-shadow: none; }
      .lp .sb-scratch-content { color: var(--lp-cream); }
      .lp .sb-scratch-placeholder { color: rgba(255, 244, 232, .6); }
      .lp .sb-scratch-email { color: #FFD9A6; }

      /* ---------- small screens ---------- */
      @media (max-width: 700px) {
        .lp-hide-sm { display: none; }
        .lp-cloud-behind { left: -8vw; top: 22%; width: 46vw; }
        .lp-hero-ctas { flex-direction: column; align-items: center; }
        .lp-hero-ctas .lp-btn { width: min(320px, 100%); }
        .lp-hero-notes { flex-direction: column; align-items: center; gap: 10px; }
      }
      @media (max-width: 880px) {
        .lp-features-grid, .lp-faq-grid { grid-template-columns: minmax(0, 1fr); }
        .lp-features-lead, .lp-faq-grid .lp-h2 { position: static; }
        .lp-features-bunny { height: 240px; margin-top: 20px; }
        .lp-features-list li { grid-template-columns: 84px 1fr; gap: 16px; }
        .lp-prop { width: 84px; height: 84px; }
        .lp-prop img { max-width: 74px; max-height: 74px; }
        .lp-prop img.is-head { width: 74px; height: 74px; }
        .lp-features-list h3 { font-size: 21px; }
        .lp-trust-grid { grid-template-columns: minmax(0, 1fr); }
        .lp-trust-item, .lp-trust-item + .lp-trust-item { padding: 26px 0 0; border-left: 0; }
        .lp-trust-item + .lp-trust-item { margin-top: 26px; border-top: 1px solid var(--lp-line); }
      }
      /* tablet: two cards, third peeks in and fades */
      @media (max-width: 999px) {
        .lp-rail { --cards: 2; }
      }
      /* phones: one card with a peek of the next (unchanged behaviour), mascots as a 3 x 2 grid */
      @media (max-width: 640px) {
        .lp-rail { -webkit-mask-image: none; mask-image: none; }
        .lp-theme-card { flex-basis: 78vw; }
        .lp-rail-btn { width: 40px; height: 40px; top: calc(50% - 32px); }
        .lp-rail-btn svg { width: 20px; height: 20px; }
        .lp-mascots { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px 0; }
      }

      @media (prefers-reduced-motion: reduce) {
        .lp *, .lp *::before, .lp *::after { animation: none !important; transition-duration: .01ms !important; }
        .lp-layer { transform: none !important; }
      }
    `}</style>
  );
}
