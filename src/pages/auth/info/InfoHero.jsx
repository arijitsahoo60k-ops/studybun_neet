import React from "react";
import Mascot from "../../../components/Mascot";

const SPARKLES = [
  { emoji: "🌸", top: "4%", right: "8%", delay: "0.6s" },
  { emoji: "✨", top: "2%", right: "22%", delay: "2s" },
];

export default function InfoHero() {
  return (
    <div className="sb-info-hero">
      <div className="sb-flow-sparkles" aria-hidden="true">
        {SPARKLES.map((s, i) => (
          <span key={i} className="sb-flow-sparkle" style={{ ...s, animationDelay: s.delay }}>{s.emoji}</span>
        ))}
      </div>
      <Mascot species="bunny" mood="happy" size={56} hopLoop />
      <div>
        <div className="sb-info-title">What's StudyBun NEET? 🌸</div>
        <p className="sb-info-sub">A cozy little companion for NEET prep — timers, trackers, and a mascot rooting for you, wrapped in a kawaii bow.</p>
      </div>
    </div>
  );
}
