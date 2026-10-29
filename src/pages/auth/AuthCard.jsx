import React from "react";
import Mascot from "../../components/Mascot";

const SPARKLES = [
  { emoji: "🌸", top: "8%", left: "6%", delay: "0.4s" },
  { emoji: "✨", top: "12%", right: "8%", delay: "1.8s" },
  { emoji: "💫", bottom: "12%", left: "8%", delay: "3s" },
];

export default function AuthCard({ mascot = "bunny", mood = "happy", bubble, title, subtitle, error, info, children }) {
  return (
    <div className="sb-flow-card">
      <div className="sb-flow-sparkles" aria-hidden="true">
        {SPARKLES.map((s, i) => (
          <span key={i} className="sb-flow-sparkle" style={{ ...s, animationDelay: s.delay }}>{s.emoji}</span>
        ))}
      </div>

      <div className="sb-flow-mascot-wrap">
        <Mascot species={mascot} mood={mood} size={80} hopLoop />
      </div>
      {bubble && <div className="sb-flow-bubble">{bubble}</div>}

      <h1 className="sb-flow-title">{title}</h1>
      {subtitle && <p className="sb-flow-sub">{subtitle}</p>}

      {error && <p className="sb-flow-msg sb-flow-msg-error">⚠️ {error}</p>}
      {info && <p className="sb-flow-msg sb-flow-msg-info">💌 {info}</p>}

      {children}
    </div>
  );
}
