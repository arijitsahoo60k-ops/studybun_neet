import React, { useState } from "react";
import { SEQUENCE, AMINO_ACIDS, CATEGORY_META } from "./proteinData";

export default function PrimaryStructure({ paused }) {
  const [active, setActive] = useState(null);

  return (
    <div className="sb-pv-primary">
      <div className={`sb-pv-chain ${paused ? "sb-pv-anim-paused" : ""}`}>
        {SEQUENCE.map((code, i) => {
          const aa = AMINO_ACIDS[code];
          const meta = CATEGORY_META[aa.cat];
          const isActive = active === i;
          return (
            <React.Fragment key={i}>
              {i > 0 && <span className="sb-pv-bond" aria-hidden="true" />}
              <button
                type="button"
                className={`sb-pv-bead ${isActive ? "active" : ""}`}
                style={{ background: meta.swatch, animationDelay: `${i * 0.12}s` }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                onClick={() => setActive((cur) => (cur === i ? null : i))}
                aria-label={`${aa.name} (${aa.code3}, ${code})`}
              >
                {code}
                {isActive && (
                  <span className="sb-pv-bead-tip" role="tooltip">
                    <strong>{aa.name}</strong>
                    <span>{aa.code3} · {code}</span>
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div className="sb-pv-sequence" aria-hidden="true">
        {SEQUENCE.map((code, i) => (
          <span key={i} style={{ color: CATEGORY_META[AMINO_ACIDS[code].cat].swatch }}>{code}</span>
        ))}
      </div>

      <div className="sb-pv-legend">
        {Object.entries(CATEGORY_META).map(([key, meta]) => (
          <span key={key} className="sb-pv-legend-chip">
            <span className="sb-pv-legend-dot" style={{ background: meta.swatch }} />
            {meta.label}
          </span>
        ))}
      </div>
    </div>
  );
}
