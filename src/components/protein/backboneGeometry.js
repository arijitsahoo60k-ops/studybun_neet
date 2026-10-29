/* Folded backbone geometry builder — src/components/protein/backboneGeometry.js
 *
 * Pure geometry helpers for the Tertiary/Quaternary three.js views. THREE
 * itself is never imported here statically -- it's passed in as `THREE`
 * (the module the caller already dynamically imported) so this file never
 * forces three.js into a bundle on its own.
 */

// Hand-authored control points for one folded chain, roughly tracing a
// compact loop-back shape (illustrative, not a real PDB structure). Units
// are arbitrary three.js world units.
const CONTROL_POINTS = [
  [-1.6, 0.2, 0.0], [-1.1, 0.9, 0.3], [-0.4, 1.1, -0.2], [0.3, 0.7, 0.4],
  [0.7, 0.0, -0.3], [0.4, -0.7, 0.3], [-0.3, -1.0, -0.2], [-1.0, -0.6, 0.4],
  [-1.2, 0.1, -0.4], [-0.6, 0.5, 0.3], [0.2, 0.3, -0.4], [0.8, -0.2, 0.2],
  [1.1, -0.9, -0.2], [0.6, -1.2, 0.3], [-0.2, -0.9, -0.3], [0.3, -0.1, 0.2],
];

/** Builds a smooth curve + tube mesh geometry for one folded chain. */
export function buildBackboneTube(THREE, { radius = 0.09, segments = 220, radialSegments = 10 } = {}) {
  const points = CONTROL_POINTS.map((p) => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
  const geometry = new THREE.TubeGeometry(curve, segments, radius, radialSegments, false);
  return { geometry, curve };
}

/** Resolves a marker's 0-1 position along the curve to a world-space point. */
export function pointAtT(curve, t) {
  return curve.getPointAt(Math.max(0, Math.min(1, t)));
}

/** Simple multi-stop color gradient (as THREE.Color) along the tube, used to
 *  shade the backbone from one theme palette color to another. */
export function gradientColorAt(THREE, colorStops, t) {
  const n = colorStops.length;
  const scaled = Math.max(0, Math.min(1, t)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(scaled));
  const localT = scaled - i;
  const a = new THREE.Color(colorStops[i]);
  const b = new THREE.Color(colorStops[i + 1]);
  return a.lerp(b, localT);
}
