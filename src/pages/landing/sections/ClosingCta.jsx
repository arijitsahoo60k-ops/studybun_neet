import React from "react";

const A = "/landing/";

export default function ClosingCta({ onGetStarted }) {
  return (
    <section className="lp-closing">
      <div className="lp-wrap lp-closing-inner">
        <div className="lp-closing-scene" aria-hidden="true">
          <img className="lp-closing-cloud" src={`${A}cloud-1.webp`} width="800" height="386" alt="" loading="lazy" decoding="async" />
          <img className="lp-closing-bunny" src={`${A}bunny-sleep.webp`} width="620" height="682" alt="" loading="lazy" decoding="async" />
          <img className="lp-closing-spark lp-cs-a" src={`${A}spark-5.webp`} width="119" height="135" alt="" loading="lazy" decoding="async" />
          <img className="lp-closing-spark lp-cs-b" src={`${A}spark-8.webp`} width="117" height="124" alt="" loading="lazy" decoding="async" />
        </div>
        <h2 className="lp-h2 lp-h2-light">Ready to fall in love with studying?</h2>
        <p className="lp-closing-sub">
          Free forever, ad-free, and built by two people grinding the exact same exam. Make an account and let's go.
        </p>
        <button type="button" className="lp-btn lp-btn-primary" onClick={onGetStarted}>Create your account</button>
      </div>
    </section>
  );
}
