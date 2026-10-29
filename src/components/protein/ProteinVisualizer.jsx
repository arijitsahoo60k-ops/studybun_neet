import React, { useState, lazy, Suspense } from "react";
import {
  ArrowLeft, Play, Pause, RefreshCw, RotateCcw, Eye, EyeOff, Expand, Shrink, X,
} from "lucide-react";
import { Card, Btn } from "../ui";
import { STEPS } from "./proteinData";
import PrimaryStructure from "./PrimaryStructure";
import SecondaryStructure from "./SecondaryStructure";

// Three.js only ever loads once one of these two mounts (see useProteinScene.js) —
// splitting them here too keeps the initial Study Stuffs -> Protein Structure
// open from ever touching three.js if the person never goes past Secondary.
const TertiaryStructure = lazy(() => import("./TertiaryStructure"));
const QuaternaryStructure = lazy(() => import("./QuaternaryStructure"));

function StepDots({ index }) {
  return (
    <div className="sb-pv-progress">
      <span className="sb-pv-progress-count">{index + 1} / {STEPS.length}</span>
      <span className="sb-pv-progress-name">{STEPS[index].title}</span>
    </div>
  );
}

function ControlBar({ children }) {
  return <div className="sb-pv-controls">{children}</div>;
}

export default function ProteinVisualizer({ onBack }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showInteractions, setShowInteractions] = useState(true);
  const [exploded, setExploded] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const step = STEPS[stepIndex];
  const is3D = step.id === "tertiary" || step.id === "quaternary";

  const onKeyNav = (e) => {
    if (e.key === "ArrowRight") setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
    if (e.key === "ArrowLeft") setStepIndex((i) => Math.max(0, i - 1));
  };

  const stage = (
    <>
      <ControlBar>
        {step.id !== "secondary" && (
          <Btn variant="soft" onClick={() => setPaused((p) => !p)}>
            {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? "Play" : "Pause"}
          </Btn>
        )}
        {is3D && (
          <>
            <Btn variant="soft" onClick={() => setAutoRotate((a) => !a)}>
              <RefreshCw size={14} /> {autoRotate ? "Auto-rotate on" : "Auto-rotate off"}
            </Btn>
            <Btn variant="soft" onClick={() => setResetSignal((n) => n + 1)}>
              <RotateCcw size={14} /> Reset View
            </Btn>
          </>
        )}
        {step.id === "tertiary" && (
          <Btn variant="soft" onClick={() => setShowInteractions((s) => !s)}>
            {showInteractions ? <Eye size={14} /> : <EyeOff size={14} />} Interactions
          </Btn>
        )}
        {step.id === "quaternary" && (
          <Btn variant={exploded ? "primary" : "soft"} onClick={() => setExploded((e) => !e)}>
            {exploded ? <Shrink size={14} /> : <Expand size={14} />} Exploded View
          </Btn>
        )}
        {is3D && (
          <Btn variant="ghost" onClick={() => setFullscreen((f) => !f)}>
            {fullscreen ? <Shrink size={14} /> : <Expand size={14} />} Fullscreen
          </Btn>
        )}
      </ControlBar>

      <div className={`sb-pv-stage ${is3D ? "sb-pv-stage-lg" : ""}`}>
        {step.id === "primary" && <PrimaryStructure paused={paused} />}
        {step.id === "secondary" && <SecondaryStructure />}
        {step.id === "tertiary" && (
          <Suspense fallback={<div className="sb-pv-canvas-loading">Loading 3D model…</div>}>
            <TertiaryStructure
              autoRotate={autoRotate}
              paused={paused}
              showInteractions={showInteractions}
              resetSignal={resetSignal}
            />
          </Suspense>
        )}
        {step.id === "quaternary" && (
          <Suspense fallback={<div className="sb-pv-canvas-loading">Loading 3D model…</div>}>
            <QuaternaryStructure
              autoRotate={autoRotate}
              paused={paused}
              exploded={exploded}
              resetSignal={resetSignal}
            />
          </Suspense>
        )}
      </div>
    </>
  );

  return (
    <div className="sb-pv-wrap">
      <Card>
        <div className="sb-pv-toolbar">
          <button className="sb-pt-back" onClick={onBack}>
            <ArrowLeft size={16} /> Study Stuffs
          </button>
          <StepDots index={stepIndex} />
        </div>

        <h2 className="sb-pv-title">Protein Structure</h2>
        <p className="sb-muted" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "2px 0 0" }}>
          Explore how a protein folds from a simple amino-acid sequence into its complex 3D structure.
        </p>

        <div className="sb-pt-modes sb-pv-steps" role="tablist" aria-label="Structure level" onKeyDown={onKeyNav} tabIndex={0}>
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={stepIndex === i}
              className={`sb-pt-mode-btn ${stepIndex === i ? "active" : ""}`}
              onClick={() => setStepIndex(i)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Card>

      {!(fullscreen && is3D) && <Card className="sb-pv-stage-card">{stage}</Card>}

      <Card className="sb-pv-info-card">
        <div className="sb-pv-info-grid">
          <div>
            <span className="sb-pv-info-label">What's happening?</span>
            <p>{step.what}</p>
          </div>
          <div>
            <span className="sb-pv-info-label">Why it matters</span>
            <p>{step.why}</p>
          </div>
          <div>
            <span className="sb-pv-info-label">Key concept</span>
            <p>{step.key}</p>
          </div>
        </div>
      </Card>

      {fullscreen && is3D && (
        <div className="sb-pt-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setFullscreen(false); }}>
          <div className="sb-pv-fs-dialog">
            <button className="sb-pt-dialog-close" onClick={() => setFullscreen(false)} aria-label="Exit fullscreen">
              <X size={18} />
            </button>
            <div className="sb-pv-fs-body">{stage}</div>
          </div>
        </div>
      )}
    </div>
  );
}
