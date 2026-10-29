/*
 * Ref-counted pause switch for the app-wide DecorLayer animation
 * (see DecorLayer in ../components/ui.jsx and .sb-decor-layer /
 * .sb-decor-paused in GlobalStyle.jsx).
 *
 * .sb-decor-layer is position:fixed, mounted once near the app root, and
 * its 8 icons run a CSS keyframe animation (translateY + rotate) forever,
 * on every single page -- that's cheap on its own (compositor-only
 * transform), but every full-screen dialog in the app (Periodic Table
 * element detail, the "who's studying" popup, ImageLightbox) sits
 * directly on top of it via the shared .sb-pt-overlay class. Animating 8
 * elements the user can no longer see -- fully hidden behind an opaque
 * dialog -- is pure wasted GPU/battery for as long as that dialog stays
 * open, so every one of those dialogs pauses the animation on mount and
 * resumes it on unmount.
 *
 * Ref-counted (not a plain boolean) so two dialogs open at once -- or one
 * closing in the same tick another opens -- can't have the first one's
 * cleanup re-enable the animation while the second is still up.
 *
 * Usage, inside any full-screen dialog component:
 *
 *   useEffect(() => pauseDecor(), []);
 */
let openCount = 0;

export function pauseDecor() {
  openCount += 1;
  document.documentElement.classList.add("sb-decor-paused");
  return resumeDecor;
}

export function resumeDecor() {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) {
    document.documentElement.classList.remove("sb-decor-paused");
  }
}
