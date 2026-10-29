import React from "react";
import { ChevronDown } from "lucide-react";
import ScratchReveal from "../../../components/ScratchReveal";

export default function LandingFaqItem({ id, q, a, custom, open, onToggle }) {
  const panelId = `lp-faq-a-${id}`;
  return (
    <div className={`lp-faq-item${open ? " open" : ""}`}>
      <button type="button" className="lp-faq-q" onClick={onToggle} aria-expanded={open} aria-controls={panelId}>
        <span>{q}</span>
        <ChevronDown size={20} className="lp-faq-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="lp-faq-a" id={panelId}>
          <p>{a}</p>
          {custom === "scratch" && <ScratchReveal />}
        </div>
      )}
    </div>
  );
}
