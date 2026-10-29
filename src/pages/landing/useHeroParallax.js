import { useEffect } from "react";

/*
 * Writes the hero's scroll offset to a CSS custom property (--sy) once per
 * animation frame. Every floating layer in the hero reads it through
 * `translate3d(0, calc(var(--sy) * var(--d) * 1px), 0)`, where --d is that
 * layer's depth: positive lags behind the page (far away), negative runs
 * ahead of it (close up). No per-layer JS, no layout work — transforms only.
 */
export default function useHeroParallax(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let raf = 0;
    const update = () => {
      raf = 0;
      const limit = el.offsetHeight + 240;
      el.style.setProperty("--sy", String(Math.min(window.scrollY, limit)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
}
