import React, { useEffect, useRef, useCallback } from "react";
import { useProteinScene } from "./useProteinScene";
import { buildBackboneTube } from "./backboneGeometry";
import { SUBUNITS } from "./proteinData";

function resolveCssColor(el, value) {
  const m = /^var\((--[\w-]+)\)$/.exec((value || "").trim());
  if (!m || !el) return value;
  const v = getComputedStyle(el).getPropertyValue(m[1]).trim();
  return v || "#999999";
}

export default function QuaternaryStructure({ autoRotate, paused, exploded, resetSignal, isFullscreen }) {
  const prevReset = useRef(resetSignal);
  const wrapRef = useRef(null);

  const onBuild = useCallback((THREE, scene, group) => {
    const el = wrapRef.current;
    const subunits = SUBUNITS.map((sub) => {
      const { geometry } = buildBackboneTube(THREE, { radius: 0.1, segments: 120, radialSegments: 8 });
      const color = resolveCssColor(el, sub.color);
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.08 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.setScalar(0.6);
      const sg = new THREE.Group();
      sg.add(mesh);
      const base = new THREE.Vector3(sub.offset[0] * 0.34, sub.offset[1] * 0.34, sub.offset[2] * 0.34);
      const full = new THREE.Vector3(sub.offset[0] * 1.7, sub.offset[1] * 1.7, sub.offset[2] * 1.7);
      sg.position.copy(base);
      group.add(sg);
      return { id: sub.id, group: sg, base, full };
    });

    const handle = {
      subunits,
      targetExplode: exploded ? 1 : 0,
      currentExplode: exploded ? 1 : 0,
      defaultZoom: 6.4,
      minZoom: 3.2,
      maxZoom: 11,
      onFrame(elapsed) {
        handle.currentExplode += (handle.targetExplode - handle.currentExplode) * 0.08;
        subunits.forEach((s, i) => {
          const p = new THREE.Vector3().lerpVectors(s.base, s.full, handle.currentExplode);
          p.y += Math.sin(elapsed * 0.9 + i) * 0.02;
          s.group.position.copy(p);
        });
      },
    };
    return handle;
  }, [exploded]);

  const { containerRef, ready, failed, resetView, handleRef } = useProteinScene({
    autoRotate, paused, onBuild,
  });

  useEffect(() => {
    if (prevReset.current !== resetSignal) {
      prevReset.current = resetSignal;
      resetView();
    }
  }, [resetSignal, resetView]);

  useEffect(() => {
    const h = handleRef.current;
    if (h) h.targetExplode = exploded ? 1 : 0;
  }, [exploded, handleRef]);

  return (
    <div className="sb-pv-3d" ref={wrapRef}>
      <div className={`sb-pv-canvas ${isFullscreen ? "fullscreen" : ""}`} ref={containerRef}>
        {!ready && !failed && <div className="sb-pv-canvas-loading">Loading 3D model…</div>}
        {failed && <div className="sb-pv-canvas-loading">3D view couldn't load on this device. Try reloading the page.</div>}
      </div>
      {ready && (
        <p className="sb-pv-hint">Drag to rotate · scroll or pinch to zoom · double-tap to reset · four subunits, each a separate color</p>
      )}
    </div>
  );
}
