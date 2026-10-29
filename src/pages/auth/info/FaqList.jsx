import React, { useState } from "react";
import { FAQS } from "./faqs";
import FaqItem from "./FaqItem";

export default function FaqList() {
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <div className="sb-info-faq">
      <div className="sb-info-faq-title">Little FAQ 🎀</div>
      {FAQS.map((f, i) => (
        <FaqItem
          key={f.q}
          q={f.q}
          a={f.a}
          emoji={f.emoji}
          custom={f.custom}
          open={openIdx === i}
          onToggle={() => setOpenIdx(openIdx === i ? -1 : i)}
        />
      ))}
    </div>
  );
}
