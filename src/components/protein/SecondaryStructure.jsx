import React, { useState } from "react";

const MODES = [
  { id: "helix", label: "Alpha Helix" },
  { id: "both", label: "Both" },
  { id: "sheet", label: "Beta Sheet" },
];

function HelixDiagram() {
  // A coiled ribbon suggested by two offset sine paths plus periodic "rungs"
  // hinting at the i -> i+4 backbone hydrogen bond pattern of a real helix.
  const coils = 5;
  const w = 420, h = 160;
  const pathA = [];
  const pathB = [];
  const rungs = [];
  for (let i = 0; i <= 200; i++) {
    const x = (i / 200) * w;
    const angle = (i / 200) * coils * Math.PI * 2;
    const yA = h / 2 + Math.sin(angle) * 34;
    const yB = h / 2 + Math.sin(angle + Math.PI) * 34;
    pathA.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${yA.toFixed(1)}`);
    pathB.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${yB.toFixed(1)}`);
    if (i % 16 === 0) rungs.push([x, yA, x, yB]);
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="sb-pv-sec-svg" role="img" aria-label="Alpha helix diagram">
      {rungs.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="sb-pv-sec-hbond" />
      ))}
      <path d={pathB.join(" ")} className="sb-pv-sec-strand sb-pv-sec-strand-back" />
      <path d={pathA.join(" ")} className="sb-pv-sec-strand sb-pv-sec-strand-front" />
    </svg>
  );
}

function SheetDiagram() {
  const w = 420, h = 160;
  const strands = [0, 1, 2];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="sb-pv-sec-svg" role="img" aria-label="Beta sheet diagram">
      {strands.map((row) => {
        const y = 30 + row * 48;
        const dir = row % 2 === 0 ? 1 : -1;
        const x1 = dir === 1 ? 20 : w - 20;
        const x2 = dir === 1 ? w - 60 : 60;
        const tipX = dir === 1 ? w - 20 : 20;
        return (
          <g key={row}>
            {row > 0 && (
              <>
                <line x1={40} y1={y - 24} x2={40} y2={y} className="sb-pv-sec-hbond" />
                <line x1={100} y1={y - 24} x2={100} y2={y} className="sb-pv-sec-hbond" />
                <line x1={160} y1={y - 24} x2={160} y2={y} className="sb-pv-sec-hbond" />
                <line x1={220} y1={y - 24} x2={220} y2={y} className="sb-pv-sec-hbond" />
                <line x1={280} y1={y - 24} x2={280} y2={y} className="sb-pv-sec-hbond" />
              </>
            )}
            <path
              d={`M${x1},${y} L${x2},${y} L${x2},${y - 10} L${tipX},${y + 5} L${x2},${y + 20} L${x2},${y + 10} L${x1},${y + 10} Z`}
              className="sb-pv-sec-arrow"
            />
          </g>
        );
      })}
    </svg>
  );
}

export default function SecondaryStructure() {
  const [mode, setMode] = useState("both");

  return (
    <div className="sb-pv-secondary">
      <div className="sb-pv-sec-toggle" role="tablist" aria-label="Secondary structure view">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            className={`sb-pv-sec-btn ${mode === m.id ? "active" : ""}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="sb-pv-sec-stage">
        {(mode === "helix" || mode === "both") && (
          <div className="sb-pv-sec-block">
            <HelixDiagram />
            <p className="sb-pv-sec-caption"><strong>α-Helix</strong> — the backbone coils into a spiral, held together by hydrogen bonds between every 1st and 4th residue.</p>
          </div>
        )}
        {(mode === "sheet" || mode === "both") && (
          <div className="sb-pv-sec-block">
            <SheetDiagram />
            <p className="sb-pv-sec-caption"><strong>β-Sheet</strong> — separate strands of the chain lie side by side, held flat by hydrogen bonds running between the strands.</p>
          </div>
        )}
      </div>
    </div>
  );
}
