import React, { useCallback, useEffect, useRef } from "react";
import FocusMusicStyle from "../styles/FocusMusicStyle";

// Hosts the ONE YouTube player for Focus Music. Rendered at the app root
// (see App.jsx) so navigating between pages or closing the settings dialog
// never unmounts it -- unmounting an iframe is what silences it.
//
// Normally it's "tucked": a 1px invisible box, audio only. While the Sound
// settings dialog is open, that dialog registers a preview slot (a plain
// 16:9 box) and this component slides the very same player over it by
// tracking the slot's on-screen rectangle every frame. One player, so
// there's never a second copy playing over the first; and because it's
// positioned rather than re-parented, the iframe never reloads.
export default function FocusMusicStage({ music }) {
  const wrapRef = useRef(null);
  const { slotEl, attachHost } = music;

  const setWrap = useCallback((el) => {
    wrapRef.current = el;
    attachHost(el);
  }, [attachHost]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    if (!slotEl) {
      el.classList.remove("in-slot");
      el.style.cssText = "";
      return undefined;
    }

    el.classList.add("in-slot");
    // The slot lives inside a scrolling dialog: clip the player to that
    // scroller so it can't paint over the dialog's header/edges when the
    // slot is scrolled partly out of view.
    let scroller = slotEl.parentElement;
    while (scroller && scroller !== document.body) {
      const oy = getComputedStyle(scroller).overflowY;
      if (oy === "auto" || oy === "scroll") break;
      scroller = scroller.parentElement;
    }
    if (scroller === document.body) scroller = null;

    let raf = 0;
    let last = "";
    const tick = () => {
      if (!slotEl.isConnected) return;
      const r = slotEl.getBoundingClientRect();
      let clip = "none";
      let hidden = false;
      if (scroller) {
        const b = scroller.getBoundingClientRect();
        const top = Math.max(0, b.top - r.top);
        const bottom = Math.max(0, r.bottom - b.bottom);
        const left = Math.max(0, b.left - r.left);
        const right = Math.max(0, r.right - b.right);
        hidden = top + bottom >= r.height || left + right >= r.width;
        if (top || bottom || left || right) clip = `inset(${top}px ${right}px ${bottom}px ${left}px round 12px)`;
      }
      const sig = `${r.left}|${r.top}|${r.width}|${r.height}|${clip}|${hidden}`;
      if (sig !== last) {
        last = sig;
        el.style.width = `${r.width}px`;
        el.style.height = `${r.height}px`;
        el.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
        el.style.clipPath = clip;
        el.style.visibility = hidden ? "hidden" : "visible";
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [slotEl]);

  return (
    <>
      <FocusMusicStyle />
      <div ref={setWrap} className="sb-music-stage" aria-hidden="true" />
    </>
  );
}
