import React from "react";
import { FEATURES } from "./features";

export default function FeatureGrid() {
  return (
    <div className="sb-info-grid">
      {FEATURES.map((f, i) => (
        <div className="sb-info-feature" key={f.label} style={{ animationDelay: `${0.2 + i * 0.06}s` }}>
          <span className="sb-info-feature-icon" style={{ background: `var(--p${(i % 6) + 1})` }}>{f.emoji}</span>
          <div className="sb-info-feature-label">{f.label}</div>
          <div className="sb-info-feature-blurb">{f.blurb}</div>
        </div>
      ))}
    </div>
  );
}
