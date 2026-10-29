import React, { useRef } from "react";
import { Sparkles, Lock, Heart } from "lucide-react";
import useHeroParallax from "../useHeroParallax";

const A = "/landing/";

// Plush gold stars. Kept few and small so the wordmark stays the one thing
// you look at. `d` is parallax depth, `t` the twinkle offset.
const SPARKS = [
  { img: "spark-4", w: 124, h: 140, top: "17%", left: "21%", size: 34, d: 0.42, t: "0s" },
  { img: "spark-6", w: 120, h: 132, top: "11%", right: "29%", size: 24, d: 0.5, t: "1.1s" },
  { img: "spark-1", w: 182, h: 199, top: "31%", right: "7%", size: 44, d: 0.36, t: "2.1s", sm: false },
  { img: "spark-7", w: 120, h: 134, top: "55%", left: "9%", size: 28, d: 0.3, t: "0.6s", sm: false },
  { img: "spark-5", w: 119, h: 135, top: "9%", left: "52%", size: 20, d: 0.55, t: "1.7s" },
  { img: "spark-2", w: 178, h: 197, top: "58%", right: "20%", size: 34, d: 0.24, t: "2.7s", sm: false },
];

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Hero({ onGetStarted }) {
  const ref = useRef(null);
  useHeroParallax(ref);

  return (
    <section className="lp-hero" ref={ref}>
      <picture className="lp-hero-sky">
        <source media="(max-aspect-ratio: 1/1)" srcSet={`${A}sky-tall.webp`} />
        <img src={`${A}sky-wide.webp`} alt="" width="1920" height="1320" fetchpriority="high" decoding="async" />
      </picture>

      {SPARKS.map((s) => (
        <span
          key={s.img}
          className={`lp-layer lp-spark${s.sm === false ? " lp-hide-sm" : ""}`}
          aria-hidden="true"
          style={{ top: s.top, left: s.left, right: s.right, width: s.size, "--d": s.d, "--t": s.t }}
        >
          <img src={`${A}${s.img}.webp`} width={s.w} height={s.h} alt="" decoding="async" />
        </span>
      ))}

      {/* back clouds: one tucked behind the wordmark, like the reference */}
      <img className="lp-layer lp-cloud lp-cloud-behind" style={{ "--d": 0.28 }} src={`${A}cloud-3.webp`} width="787" height="243" alt="" decoding="async" aria-hidden="true" />
      <img className="lp-layer lp-cloud lp-cloud-mid-r lp-hide-sm" style={{ "--d": 0.2 }} src={`${A}cloud-4.webp`} width="453" height="288" alt="" decoding="async" aria-hidden="true" />
      <img className="lp-layer lp-cloud lp-cloud-far" style={{ "--d": 0.34 }} src={`${A}cloud-5.webp`} width="434" height="237" alt="" decoding="async" aria-hidden="true" />
      <img className="lp-layer lp-cloud lp-cloud-mid-l lp-hide-sm" style={{ "--d": 0.14 }} src={`${A}cloud-2.webp`} width="639" height="322" alt="" decoding="async" aria-hidden="true" />

      <div className="lp-hero-stage">
        <h1 className="lp-hero-title">
          <img src={`${A}wordmark.webp`} width="1200" height="324" alt="StudyBun" fetchpriority="high" decoding="async" />
        </h1>
        <p className="lp-hero-tag">Your cozy little NEET study buddy</p>
        <p className="lp-hero-sub">
          Timers, trackers, and a revision brain that never forgets, with a bunny rooting for you the whole way.
        </p>

        <div className="lp-hero-ctas">
          <button type="button" className="lp-btn lp-btn-primary" onClick={onGetStarted}>Get started free</button>
          <button type="button" className="lp-btn lp-btn-ghost" onClick={() => scrollToId("sb-land-features")}>See what's inside</button>
        </div>

        <ul className="lp-hero-notes">
          <li><Sparkles size={15} aria-hidden="true" /> 100% free, no ads, always</li>
          <li><Lock size={15} aria-hidden="true" /> Private by default</li>
          <li><Heart size={15} aria-hidden="true" /> Built for NEET UG aspirants</li>
        </ul>
      </div>

      {/* front clouds straddle the seam into the next section */}
      <img className="lp-layer lp-cloud lp-front-l" style={{ "--d": -0.1 }} src={`${A}cloud-1.webp`} width="800" height="386" alt="" decoding="async" aria-hidden="true" />
      <div className="lp-layer lp-front-r" style={{ "--d": -0.05 }} aria-hidden="true">
        <img className="lp-front-r-cloud" src={`${A}cloud-2.webp`} width="639" height="322" alt="" decoding="async" />
        <img className="lp-front-r-bunny" src={`${A}bunny-sit.webp`} width="560" height="835" alt="" decoding="async" />
      </div>
    </section>
  );
}
