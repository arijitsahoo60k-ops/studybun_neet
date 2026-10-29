import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useModalScrollLock } from "../../hooks/useModalScrollLock";
import { pauseDecor } from "../../lib/decorPause";

/**
 * The app's standard popup (.sb-pt-overlay / .sb-pt-dialog -- same chrome as
 * the Focus Timer settings, "who's studying" and confirm-reset dialogs),
 * wrapped once so every Group Timer popup behaves identically: portaled into
 * .sb-app (so theme colours resolve and .sb-main's `contain: layout` can't
 * trap the fixed overlay), Escape to close, backdrop click to close, initial
 * focus, background scroll lock, decor-animation pause.
 */
export default function GtDialog({ onClose, label, className = "", children }) {
  const ref = useRef(null);
  useModalScrollLock(ref, true);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    const resumeDecor = pauseDecor();
    return () => {
      window.removeEventListener("keydown", onKey);
      resumeDecor();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="sb-pt-overlay sb-gt-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div
        className={`sb-pt-dialog sb-gt-dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        ref={ref}
        tabIndex={-1}
      >
        <button type="button" className="sb-pt-dialog-close" title="Close" aria-label="Close" onClick={onClose}>
          <X size={15} />
        </button>
        {children}
      </div>
    </div>,
    document.querySelector(".sb-app") || document.body
  );
}
