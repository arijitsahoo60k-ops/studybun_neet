import { useEffect } from "react";

/**
 * Locks the page behind a full-screen .sb-pt-overlay dialog (Periodic
 * Table element detail, community "Seen by" popup, etc.) so dragging on
 * the black backdrop can't scroll the app underneath it.
 *
 * Root cause this fixes: .sb-main -- not body -- is the app's real
 * scrollable element (see ImageLightbox.jsx, which already handles this
 * correctly for itself). Every OTHER .sb-pt-overlay dialog was only doing
 * dialogRef.current?.focus() + pauseDecor() on mount, with no scroll lock
 * at all, so touch-dragging anywhere on the overlay -- including the
 * backdrop, not just the dialog card -- scrolled .sb-main behind it,
 * which reads as "the black overlay itself is scrollable". iOS Safari
 * additionally ignores overflow:hidden for touch scrolling, so the lock
 * has to be enforced with non-passive wheel/touchmove listeners too, not
 * just a style change.
 *
 * Unlike ImageLightbox's version (which has no scrollable content inside
 * its dialog, so it can block touchmove everywhere), dialogs using this
 * hook DO have internally-scrolling content (.sb-pt-dialog has
 * max-height:88vh; overflow-y:auto -- the reader list / fact grid can be
 * taller than that on small phones). So this only blocks wheel/touchmove
 * events that originate OUTSIDE the dialog element (the backdrop) and
 * lets events inside the dialog through untouched, so the dialog's own
 * overflow-y:auto keeps scrolling normally.
 *
 * Usage, inside any full-screen dialog component that renders
 * .sb-pt-overlay/.sb-pt-dialog:
 *
 *   const dialogRef = useRef(null);
 *   useModalScrollLock(dialogRef);
 *   ...
 *   <div className="sb-pt-dialog" ref={dialogRef}>...
 *
 * For a dialog that stays mounted while closed (like MessageInfoModal,
 * toggled by an `open` prop rather than mount/unmount), pass `active` so
 * the lock only engages while it's actually showing:
 *
 *   useModalScrollLock(dialogRef, open);
 *
 * Also toggles .sb-scroll-chain-lock on <html>/<body>/.sb-main for exactly
 * as long as the dialog is open -- see the .sb-scroll-chain-lock rules in
 * GlobalStyle.jsx. That's what keeps a rubber-band bounce from visibly
 * detaching this fixed-position dialog from the document (the original bug
 * this hook exists for), without permanently disabling the browser's
 * native pull-to-refresh gesture the rest of the time, when no dialog is
 * open to detach in the first place.
 *
 * .sb-main also carries `scrollbar-gutter: stable` (keeps the layout from
 * jittering sideways whenever a page's content crosses the scroll
 * threshold). That reserved strip is still reserved even once we set
 * overflow to hidden below -- it's not tied to whether a scrollbar is
 * actually drawn, only to overflow not being `visible` -- so without this,
 * a thin untinted sliver of the real page survives at .sb-main's right
 * edge, right where its scrollbar normally lives, for as long as the
 * dialog stays open. It's not scrollable (overflow:hidden already stops
 * that), just visibly un-dimmed. Since nothing needs that space while
 * scrolling is locked anyway, drop the reservation for the duration.
 */
export function useModalScrollLock(dialogRef, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const mainEl = document.querySelector(".sb-main");
    const prevBodyOverflow = document.body.style.overflow;
    const prevMainOverflow = mainEl ? mainEl.style.overflow : null;
    const prevMainScrollbarGutter = mainEl ? mainEl.style.scrollbarGutter : null;
    document.body.style.overflow = "hidden";
    if (mainEl) {
      mainEl.style.overflow = "hidden";
      mainEl.style.scrollbarGutter = "auto";
    }
    document.documentElement.classList.add("sb-scroll-chain-lock");
    document.body.classList.add("sb-scroll-chain-lock");
    if (mainEl) mainEl.classList.add("sb-scroll-chain-lock");

    const preventScroll = (e) => {
      // Let scroll/wheel events inside the dialog card through -- only the
      // backdrop needs to be locked.
      if (dialogRef.current && dialogRef.current.contains(e.target)) return;
      e.preventDefault();
    };
    document.addEventListener("wheel", preventScroll, { passive: false });
    document.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      if (mainEl) {
        mainEl.style.overflow = prevMainOverflow;
        mainEl.style.scrollbarGutter = prevMainScrollbarGutter;
      }
      document.documentElement.classList.remove("sb-scroll-chain-lock");
      document.body.classList.remove("sb-scroll-chain-lock");
      if (mainEl) mainEl.classList.remove("sb-scroll-chain-lock");
      document.removeEventListener("wheel", preventScroll);
      document.removeEventListener("touchmove", preventScroll);
    };
  }, [dialogRef, active]);
}
