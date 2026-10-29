import { useEffect, useRef, useState, useCallback } from "react";

/* Shared three.js scene rig for the Tertiary/Quaternary panes.
 *
 * `three` is dynamically import()-ed inside this hook and nowhere else in
 * the feature -- it only ever loads once a component using this hook
 * actually mounts (see TertiaryStructure.jsx / QuaternaryStructure.jsx).
 *
 * Handles: renderer/camera/resize, pointer-drag rotate, wheel/pinch zoom
 * (clamped), auto-rotate, reset-view (tweened back to the default angle),
 * raycasting clicks against whatever clickable objects `onBuild` registers,
 * and full disposal of geometries/materials/renderer on unmount.
 *
 * `onBuild(THREE, scene, group)` runs once, after three.js and the renderer
 * are ready. It should add its own meshes to `group` (the rig that drag/
 * auto-rotate spins) directly to `scene` for anything that shouldn't rotate,
 * and may return `{ clickables: [{ object, id }], onFrame(elapsed) }`.
 */
export function useProteinScene({ autoRotate = false, paused = false, onBuild, onSelect } = {}) {
  const containerRef = useRef(null);
  const stateRef = useRef(null); // { THREE, renderer, scene, camera, group, clickables, onFrame }
  const handleRef = useRef(null); // whatever onBuild() returned, for callers to mutate post-mount
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const resetView = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    s.rotX = -0.28;
    s.rotY = 0.55;
    s.zoom = s.defaultZoom;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let frameId;
    let ro;

    (async () => {
      let THREE;
      try {
        THREE = await import("three");
      } catch (e) {
        if (!cancelled) setFailed(true);
        return;
      }
      if (cancelled || !containerRef.current) return;

      const el = containerRef.current;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      el.appendChild(renderer.domElement);

      const group = new THREE.Group();
      scene.add(group);

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
      keyLight.position.set(3, 4, 5);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
      fillLight.position.set(-4, -2, -3);
      scene.add(fillLight);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));

      const built = (typeof onBuild === "function" ? onBuild(THREE, scene, group) : null) || {};
      handleRef.current = built;
      const clickables = built.clickables || [];

      const defaultZoom = built.defaultZoom || 5.2;
      const s = {
        THREE, renderer, scene, camera, group, clickables,
        onFrame: built.onFrame || null,
        rotX: -0.28, rotY: 0.55, zoom: defaultZoom, defaultZoom,
        minZoom: built.minZoom || 2.6, maxZoom: built.maxZoom || 9,
      };
      stateRef.current = s;

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      const resize = () => {
        const w = el.clientWidth || 1;
        const h = el.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      ro = new ResizeObserver(resize);
      ro.observe(el);

      // --- Drag to rotate ---
      let dragging = false, moved = false, lastX = 0, lastY = 0, lastTapAt = 0;
      const onPointerDown = (e) => {
        dragging = true; moved = false;
        lastX = e.clientX; lastY = e.clientY;
        el.setPointerCapture?.(e.pointerId);
      };
      const onPointerMove = (e) => {
        if (!dragging) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        s.rotY += dx * 0.008;
        s.rotX += dy * 0.008;
        s.rotX = Math.max(-1.3, Math.min(1.3, s.rotX));
        lastX = e.clientX; lastY = e.clientY;
      };
      const endDrag = (e) => {
        if (dragging && !moved && e) {
          const now = performance.now();
          const isDoubleTap = now - lastTapAt < 320;
          lastTapAt = now;
          if (isDoubleTap) {
            resetView();
          } else {
            const rect = el.getBoundingClientRect();
            pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(clickables.map((c) => c.object), false);
            if (hits.length) {
              const hitObj = hits[0].object;
              const match = clickables.find((c) => c.object === hitObj);
              if (match && onSelectRef.current) onSelectRef.current(match.id);
            }
          }
        }
        dragging = false;
      };
      const onDoubleClick = () => resetView();

      // --- Wheel / pinch zoom ---
      const onWheel = (e) => {
        e.preventDefault();
        s.zoom += e.deltaY * 0.0035;
        s.zoom = Math.max(s.minZoom, Math.min(s.maxZoom, s.zoom));
      };
      let pinchDist = null;
      const onTouchMove = (e) => {
        if (e.touches.length === 2) {
          const [a, b] = e.touches;
          const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          if (pinchDist != null) {
            s.zoom += (pinchDist - d) * 0.012;
            s.zoom = Math.max(s.minZoom, Math.min(s.maxZoom, s.zoom));
          }
          pinchDist = d;
        }
      };
      const onTouchEnd = () => { pinchDist = null; };

      el.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
      el.addEventListener("dblclick", onDoubleClick);
      el.addEventListener("wheel", onWheel, { passive: false });
      el.addEventListener("touchmove", onTouchMove, { passive: true });
      el.addEventListener("touchend", onTouchEnd);

      const clock = new THREE.Clock();
      const tick = () => {
        const dt = clock.getDelta();
        const elapsed = clock.getElapsedTime();
        if (autoRotateRef.current && !dragging) s.rotY += dt * 0.22;
        group.rotation.x = s.rotX;
        group.rotation.y = s.rotY;
        camera.position.set(0, 0, s.zoom);
        camera.lookAt(0, 0, 0);
        if (!pausedRef.current && s.onFrame) s.onFrame(elapsed);
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(tick);
      };
      tick();

      if (!cancelled) setReady(true);

      stateRef.current._cleanup = () => {
        cancelAnimationFrame(frameId);
        ro?.disconnect();
        el.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", endDrag);
        el.removeEventListener("dblclick", onDoubleClick);
        el.removeEventListener("wheel", onWheel);
        el.removeEventListener("touchmove", onTouchMove);
        el.removeEventListener("touchend", onTouchEnd);
        scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => m.dispose());
          }
        });
        renderer.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      };
    })();

    return () => {
      cancelled = true;
      stateRef.current?._cleanup?.();
      stateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { containerRef, ready, failed, resetView, handleRef };
}
