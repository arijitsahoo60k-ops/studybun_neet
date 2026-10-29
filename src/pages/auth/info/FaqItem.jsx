import React from "react";
import { ChevronDown } from "lucide-react";
import ScratchReveal from "../../../components/ScratchReveal";

export default function FaqItem({ q, a, emoji, custom, open, onToggle }) {
  return (
    <div className={`sb-info-faq-item${open ? " open" : ""}`}>
      <button type="button" className="sb-info-faq-q" onClick={onToggle} aria-expanded={open}>
        <span>{emoji ? `${emoji} ` : ""}{q}</span>
        <ChevronDown size={15} className="sb-info-faq-chevron" />
      </button>
      {open && (
        <div className="sb-info-faq-a">
          <p>{a}</p>
          {custom === "scratch" && <ScratchReveal />}
        </div>
      )}
    </div>
  );
}
