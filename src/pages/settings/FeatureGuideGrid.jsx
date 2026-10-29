import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FEATURE_GUIDE } from "./featureGuide";

/**
 * Deliberately reuses the sign-in page's `.sb-info-grid` / `.sb-info-feature`
 * classes (two-column, staggered pop-in via animationDelay) so this reads as
 * the same visual language as the rest of the app, plus an accordion body
 * per card in the same open/close style as the auth info page's FAQ.
 */
export default function FeatureGuideGrid() {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <div className="sb-info-grid sb-guide-grid">
      {FEATURE_GUIDE.map((f, i) => {
        const open = openIdx === i;
        return (
          <div
            key={f.label}
            className={`sb-info-feature sb-guide-card${open ? " open" : ""}`}
            style={{ animationDelay: `${0.15 + i * 0.045}s` }}
          >
            <button
              type="button"
              className="sb-guide-toggle"
              onClick={() => setOpenIdx(open ? null : i)}
              aria-expanded={open}
            >
              <span className="sb-info-feature-icon" style={{ background: `var(--p${(i % 6) + 1})` }}>{f.emoji}</span>
              <span className="sb-guide-toggle-text">
                <span className="sb-info-feature-label">{f.label}</span>
                <span className="sb-info-feature-blurb">{f.blurb}</span>
              </span>
              <ChevronDown size={15} className="sb-guide-chevron" />
            </button>
            {open && (
              <div className="sb-guide-detail">
                {f.details.map((d, j) => <p key={j}>{d}</p>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
