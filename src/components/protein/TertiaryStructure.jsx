import React, { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { useProteinScene } from "./useProteinScene";
import { buildBackboneTube, pointAtT } from "./backboneGeometry";
import { INTERACTIONS } from "./proteinData";

/** Resolves a `var(--token)` string against a live DOM element's computed
 *  style, since three.js materials need real color values, not CSS strings. */
function resolveCssColor(el, value) {
  const m = /^var\((--[\w-]+)\)$/.exec((value || "").trim());
  if (!m || !el) return value;
  const v = getComputedStyle(el).getPropertyValue(m[1]).trim();
  return v || "#999999";
}

export default function TertiaryStructure({ autoRotate, paused, showInteractions, resetSignal, onFullscreenToggle, isFullscreen }) {
  const [selected, setSelected] = useState(null);
  const prevReset = useRef(resetSignal);
  const wrapRef = useRef(null);

  const onBuild = useCallback((THREE, scene, group) => {
    const el = wrapRef.current;
    const accent = resolveCssColor(el, "var(--accent)");
    const { geometry, curve } = buildBackboneTube(THREE);
    const material = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, metalness: 0.08 });
    const tube = new THREE.Mesh(geometry, material);
    group.add(tube);

    const markerGroup = new THREE.Group();
    group.add(markerGroup);
    const clickables = [];
    const markerMeshes = {};
    INTERACTIONS.forEach((it) => {
      const pos = pointAtT(curve, it.t);
      const color = resolveCssColor(el, it.color);
      const geo = new THREE.SphereGeometry(0.13, 20, 20);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15, emissive: color, emissiveIntensity: 0.18 });
      const sphere = new THREE.Mesh(geo, mat);
      sphere.position.copy(pos);
      markerGroup.add(sphere);
      clickables.push({ object: sphere, id: it.id });
      markerMeshes[it.id] = sphere;
    });

    return {
      clickables,
      markerGroup,
      markerMeshes,
      defaultZoom: 4.6,
      minZoom: 2.4,
      maxZoom: 8,
      onFrame(elapsed) {
        tube.rotation.z = Math.sin(elapsed * 0.6) * 0.02;
        markerGroup.children.forEach((m, i) => {
          m.scale.setScalar(1 + Math.sin(elapsed * 1.6 + i) * 0.06);
        });
      },
    };
  }, []);

  const { containerRef, ready, failed, resetView, handleRef } = useProteinScene({
    autoRotate, paused, onBuild, onSelect: setSelected,
  });

  useEffect(() => {
    if (prevReset.current !== resetSignal) {
      prevReset.current = resetSignal;
      resetView();
    }
  }, [resetSignal, resetView]);

  useEffect(() => {
    const h = handleRef.current;
    if (h?.markerGroup) h.markerGroup.visible = showInteractions;
  }, [showInteractions, ready, handleRef]);

  const activeInteraction = INTERACTIONS.find((it) => it.id === selected);

  return (
    <div className="sb-pv-3d" ref={wrapRef}>
      <div className={`sb-pv-canvas ${isFullscreen ? "fullscreen" : ""}`} ref={containerRef}>
        {!ready && !failed && <div className="sb-pv-canvas-loading">Loading 3D model…</div>}
        {failed && <div className="sb-pv-canvas-loading">3D view couldn't load on this device. Try reloading the page.</div>}
      </div>
      {ready && (
        <p className="sb-pv-hint">Drag to rotate · scroll or pinch to zoom · double-tap to reset{showInteractions ? " · tap a glowing marker for details" : ""}</p>
      )}
      {activeInteraction && (
        <div className="sb-pv-interaction-panel">
          <button className="sb-pv-interaction-close" onClick={() => setSelected(null)} aria-label="Close">
            <X size={14} />
          </button>
          <span className="sb-pv-interaction-dot" style={{ background: activeInteraction.color }} />
          <div>
            <strong>{activeInteraction.label}</strong>
            <p>{activeInteraction.explanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
