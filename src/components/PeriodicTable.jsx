import React, { useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, X, ArrowLeft, Info } from "lucide-react";
import { Card } from "./ui";
import {
  ELEMENTS, COLOR_MODES, elementColor, kToC, MAX_GROUP,
} from "../data/periodicTable";
import { pauseDecor } from "../lib/decorPause";
import { useModalScrollLock } from "../hooks/useModalScrollLock";

/* La and Ac now sit as real elements in the main 7-row grid at
 * (period 6, group 3) and (period 7, group 3) -- the standard NEET/NCERT
 * convention, since their differentiating electron goes into d, not f.
 * The lanthanide/actinide footnote rows below run Ce→Lu and Th→Lr. */

function fmtNum(v, digits = 2) {
  if (v === null || v === undefined) return "—";
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return r.toString();
}

/* Concentric Bohr-model ring diagram built from an element's `shells` array
 * (electrons per shell, innermost first). Purely illustrative -- it's the
 * simplified per-shell model taught at this level, not an orbital diagram. */
function BohrRings({ el, color, border }) {
  const shells = el.shells || [];
  const size = 176;
  const cx = size / 2, cy = size / 2;
  const ringGap = 15.5;
  const baseR = 22;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="sb-pt-bohr" role="img" aria-label={`Electron shell diagram for ${el.name}`}>
      <circle cx={cx} cy={cy} r={baseR - 8} fill={color} stroke={border} strokeWidth="2.5" />
      <text x={cx} y={cy + 4.5} textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize="12.5" fill="#241E1A">{el.sym}</text>
      {shells.map((count, i) => {
        const r = baseR + i * ringGap;
        const dots = [];
        for (let e = 0; e < count; e++) {
          const angle = (2 * Math.PI * e) / count - Math.PI / 2;
          dots.push(
            <circle key={e} cx={cx + r * Math.cos(angle)} cy={cy + r * Math.sin(angle)} r="3.4" fill={border} />
          );
        }
        return (
          <React.Fragment key={i}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#B9B2A6" strokeWidth="1.2" strokeDasharray="2 3" />
            {dots}
          </React.Fragment>
        );
      })}
    </svg>
  );
}

function ElementDetail({ el, mode, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // See src/lib/decorPause.js -- this dialog reuses .sb-pt-overlay, which
  // fully covers the decor layer while it's open.
  useEffect(() => pauseDecor(), []);

  // See src/hooks/useModalScrollLock.js -- without this, dragging on the
  // black backdrop scrolls .sb-main behind the dialog instead of staying put.
  useModalScrollLock(dialogRef);

  const { color, border, label } = elementColor(el, mode);
  const meltC = kToC(el.melt), boilC = kToC(el.boil);

  const facts = [
    ["Atomic mass", el.mass != null ? `${el.mass} u` : "—"],
    ["Period · Group", `${el.period}${el.group ? ` · ${el.group}` : ""}`],
    ["Block", `${el.block}-block`],
    ["Category", label + (el.pred ? " (predicted)" : "")],
    ["Phase at room temp", el.phase],
    ["Electron config", el.econf || "—"],
    ["Electronegativity (Pauling)", el.en != null ? el.en : "—"],
    ["Density", el.density != null ? `${el.density} g/cm³` : "—"],
    ["Melting point", el.melt != null ? `${el.melt} K (${meltC}°C)` : "—"],
    ["Boiling point", el.boil != null ? `${el.boil} K (${boilC}°C)` : "—"],
    ["1st ionization energy", el.ie1 != null ? `${el.ie1} kJ/mol` : "—"],
    ["Discovered by", el.by || "Unknown"],
  ];

  return createPortal(
    // Portaled to .sb-app -- same fix as MessageInfoModal.jsx's "Seen by"
    // popup, and the same reason: .sb-main sets `contain: layout`, which
    // makes it the containing block for `position: fixed` descendants, so
    // left un-portaled this overlay tracks .sb-main's own scrolled box
    // instead of the viewport (opens off-center, scrim cut off at the
    // bottom once .sb-main is scrolled). Target .sb-app specifically, NOT
    // document.body -- .sb-app is where the theme CSS variables
    // (--card, --mascot-outline, etc.) are actually defined; portaling to
    // body would render this dialog with no colors at all.
    <div className="sb-pt-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="sb-pt-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${el.name} details`}
        ref={dialogRef}
        tabIndex={-1}
      >
        <button className="sb-pt-dialog-close" onClick={onClose} aria-label="Close element details"><X size={18} /></button>

        <div className="sb-pt-dialog-top">
          <div className="sb-pt-dialog-tile" style={{ background: color, borderColor: border }}>
            <span className="sb-pt-dialog-num">{el.n}</span>
            <span className="sb-pt-dialog-sym">{el.sym}</span>
          </div>
          <div className="sb-pt-dialog-heading">
            <h2>{el.name}</h2>
            <span className="sb-chip small" style={{ background: color, borderColor: border, color: "#241E1A", cursor: "default" }}>{label}</span>
          </div>
          <BohrRings el={el} color={color} border={border} />
        </div>

        {el.pred && (
          <p className="sb-pt-predicted-note">
            <Info size={13} /> This element was made only in tiny, short-lived amounts — several properties above are theoretical predictions, not direct measurements.
          </p>
        )}

        <div className="sb-pt-fact-grid">
          {facts.map(([k, v]) => (
            <div key={k} className="sb-pt-fact">
              <span className="sb-pt-fact-label">{k}</span>
              <span className="sb-pt-fact-value">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    (typeof document !== "undefined" && document.querySelector(".sb-app")) ||
      (typeof document !== "undefined" ? document.body : null)
  );
}

function ElementTile({ el, mode, dim, onOpen, style }) {
  const { color, border } = elementColor(el, mode);
  return (
    <button
      type="button"
      className={`sb-pt-cell ${dim ? "sb-pt-cell-dim" : ""}`}
      style={{ ...style, background: color, borderColor: border }}
      onClick={() => onOpen(el)}
      aria-label={`${el.name}, atomic number ${el.n}. Open details.`}
    >
      <span className="sb-pt-cell-num">{el.n}</span>
      <span className="sb-pt-cell-sym">{el.sym}</span>
      <span className="sb-pt-cell-mass">{el.mass != null ? fmtNum(el.mass, 1) : ""}</span>
    </button>
  );
}

export default function PeriodicTable({ onBack }) {
  const [query, setQuery] = useState("");
  const [modeId, setModeId] = useState("category");
  const [activeKey, setActiveKey] = useState(null); // legend chip isolate/highlight
  const [selected, setSelected] = useState(null);

  // The grid is wider than its container at most viewport sizes (that's by
  // design -- 18 legible columns needs real width), so the "swipe to see
  // more" hint is shown whenever the scroll area is actually overflowing,
  // checked directly rather than guessed from a fixed breakpoint.
  const scrollRef = useRef(null);
  const [canScroll, setCanScroll] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setCanScroll(el.scrollWidth - el.clientWidth > 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener("resize", check);
    return () => { ro.disconnect(); window.removeEventListener("resize", check); };
  }, []);

  const mode = COLOR_MODES.find((m) => m.id === modeId) || COLOR_MODES[0];

  const q = query.trim().toLowerCase();
  const matches = (el) => {
    if (!q) return true;
    return (
      el.name.toLowerCase().includes(q) ||
      el.sym.toLowerCase() === q ||
      el.sym.toLowerCase().startsWith(q) ||
      String(el.n) === q
    );
  };

  const legendKeys = useMemo(() => {
    const seen = new Set();
    const order = [];
    ELEMENTS.forEach((el) => {
      const k = mode.keyOf(el);
      if (!seen.has(k)) { seen.add(k); order.push(k); }
    });
    return order.filter((k) => mode.meta[k]);
  }, [mode]);

  const isDim = (el) => {
    if (activeKey && mode.keyOf(el) !== activeKey) return true;
    if (q && !matches(el)) return true;
    return false;
  };

  return (
    <div className="sb-pt-wrap">
      <Card>
        <div className="sb-pt-toolbar">
          <button className="sb-pt-back" onClick={onBack}>
            <ArrowLeft size={16} /> Study Stuffs
          </button>

          <div className="sb-pt-search">
            <Search size={15} />
            <input
              className="sb-pt-search-input"
              placeholder="Search by name, symbol, or atomic number…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search elements"
            />
            {query && (
              <button className="sb-pt-search-clear" onClick={() => setQuery("")} aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="sb-pt-modes" role="tablist" aria-label="Color by">
            {COLOR_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={modeId === m.id}
                className={`sb-pt-mode-btn ${modeId === m.id ? "active" : ""}`}
                onClick={() => { setModeId(m.id); setActiveKey(null); }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="sb-pt-table-card">
        <div className="sb-pt-scroll" ref={scrollRef}>
          <div className="sb-pt-grid" style={{ "--pt-cols": MAX_GROUP }}>
            {ELEMENTS.map((el) => (
              <ElementTile
                key={el.n}
                el={el}
                mode={modeId}
                dim={isDim(el)}
                onOpen={setSelected}
                style={{ gridColumn: el.x, gridRow: el.y }}
              />
            ))}
          </div>
        </div>
        {canScroll && <p className="sb-pt-scroll-hint">Swipe sideways to see the full table →</p>}

        <div className="sb-pt-legend">
          {legendKeys.map((k) => {
            const meta = mode.meta[k];
            const on = activeKey === k;
            return (
              <button
                key={k}
                type="button"
                className={`sb-pt-legend-chip ${on ? "active" : ""}`}
                style={{ background: meta.color, borderColor: meta.border }}
                onClick={() => setActiveKey(on ? null : k)}
              >
                {meta.label}
              </button>
            );
          })}
          {activeKey && (
            <button type="button" className="sb-pt-legend-reset" onClick={() => setActiveKey(null)}>Clear filter</button>
          )}
        </div>
      </Card>

      {selected && (
        <ElementDetail el={selected} mode={modeId} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
