import React, { useState } from "react";
import { FAQS } from "../../auth/info/faqs";
import LandingFaqItem from "./LandingFaqItem";

export default function FaqSection() {
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <section className="lp-faq" id="sb-land-faq">
      <div className="lp-wrap lp-faq-grid">
        <h2 className="lp-h2 lp-h2-light">Questions, answered kawaii-ly</h2>
        <div className="lp-faq-list">
          {FAQS.map((f, i) => (
            <LandingFaqItem
              key={f.q}
              id={i}
              q={f.q}
              a={f.a}
              custom={f.custom}
              open={openIdx === i}
              onToggle={() => setOpenIdx(openIdx === i ? -1 : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
