import React, { startTransition, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Persistent StudyBun workspace sidebar.
 *
 * This intentionally has no outer card/pill container: the sidebar owns the
 * navigation surface and each item owns its own active/hover state. This
 * avoids the large rectangle that previously surrounded the whole nav.
 */
export default function TopNav({ nav, page, setPage, onHoverItem, collapsed }) {
  // { label, top, left } | null. The collapsed icons-only rail's tooltip
  // used to be a plain CSS :hover child escaped via an overflow:visible
  // toggle on the rail itself -- that toggle also removed the rail's
  // vertical clipping while hovered, so on tall nav lists / short screens
  // the un-scrolled items spilled out and overlapped the footer below the
  // rail ("icons clashing"). Rendering the tooltip through a portal at
  // fixed screen coordinates means the rail's own overflow never has to
  // change, on any screen size, so that bug (and any regression of the
  // manual-scrollbar-on-collapse fix) can't come back.
  const [tooltip, setTooltip] = useState(null);

  const go = (id) => {
    onHoverItem?.(id);
    startTransition(() => setPage(id));
  };

  // Tooltips only apply to the collapsed icons-only rail, and only for
  // genuine hover/keyboard-focus input. Touch taps still go through
  // onTouchStart below (prefetch only) -- on a touch device, showing a
  // fixed-position tooltip on tap would leave it stuck on screen with no
  // corresponding "leave" gesture, so this stays gated the same way the
  // old CSS :has() rule was.
  const canShowTooltip = useCallback(
    () => collapsed && typeof window !== "undefined" &&
      !!window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches,
    [collapsed]
  );

  const showTooltip = (e, label) => {
    if (!canShowTooltip()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 10 });
  };
  const hideTooltip = () => setTooltip(null);

  // Collapsing/expanding the rail (or a route change while hovered) can
  // leave a stale tooltip pointing at coordinates that no longer belong
  // to anything -- clear it whenever the collapsed state flips.
  useEffect(() => { setTooltip(null); }, [collapsed]);

  return (
    <nav
      className={`sb-sidebar-nav ${collapsed ? "sb-sidebar-nav-collapsed" : ""}`}
      aria-label="Primary navigation"
    >
      <div className="sb-sidebar-nav-list">
        {nav.map((n) => {
          const active = page === n.id;
          return (
            <button
              key={n.id}
              type="button"
              className={`sb-sidebar-item ${active ? "active" : ""}`}
              onClick={() => go(n.id)}
              onMouseEnter={(e) => { onHoverItem?.(n.id); showTooltip(e, n.label); }}
              onMouseLeave={hideTooltip}
              onFocus={(e) => { onHoverItem?.(n.id); showTooltip(e, n.label); }}
              onBlur={hideTooltip}
              onTouchStart={() => onHoverItem?.(n.id)}
              aria-current={active ? "page" : undefined}
              title={collapsed ? n.label : undefined}
            >
              <span className="sb-sidebar-item-icon"><n.icon size={18} strokeWidth={2.2} /></span>
              <span className="sb-sidebar-item-label">{n.label}</span>
            </button>
          );
        })}
      </div>
      {tooltip && typeof document !== "undefined" && createPortal(
        <div
          className="sb-sidebar-tooltip-portal"
          role="tooltip"
          style={{ top: tooltip.top, left: tooltip.left }}
        >
          {tooltip.label}
        </div>,
        document.body
      )}
    </nav>
  );
}
