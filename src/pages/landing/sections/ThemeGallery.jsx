import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { THEMES } from "../../../data/themes";
import Mascot from "../../../components/Mascot";

const MASCOTS = [
  { species: "bunny", name: "Bunny" },
  { species: "cat", name: "Cat" },
  { species: "fox", name: "Fox" },
  { species: "bear", name: "Bear" },
  { species: "hamster", name: "Hamster" },
  { species: "penguin", name: "Penguin" },
];

const ALL = Object.entries(THEMES);
const WITH_ART = ALL.filter(([, t]) => t.photoBg && t.bgImage);
const PALETTE_ONLY = ALL.filter(([, t]) => !(t.photoBg && t.bgImage));

// Small previews of the in-app backdrops, generated from /theme-bg.
function thumb(bgImage) {
  return `/landing/themes/${bgImage.split("/").pop()}`;
}

export default function ThemeGallery() {
  const railRef = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  // Track whether the rail is at either end so the arrows can step aside.
  // State only changes when an edge is crossed, never on every scroll tick.
  const syncEdges = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const start = rail.scrollLeft <= 2;
    const end = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 2;
    setEdge((e) => (e.start === start && e.end === end ? e : { start, end }));
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; syncEdges(); });
    };
    syncEdges();
    rail.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      rail.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [syncEdges]);

  // Move by one "page" of cards (3 on desktop, 2 on tablet, 1 on phones) so the
  // visible group always lands back on the symmetrical resting position.
  function nudge(dir) {
    const rail = railRef.current;
    const card = rail?.querySelector(".lp-theme-card");
    if (!rail || !card) return;
    const cs = getComputedStyle(rail);
    const gap = parseFloat(cs.columnGap) || 0;
    const pad = parseFloat(cs.paddingLeft) || 0;
    const step = card.offsetWidth + gap;
    const perPage = Math.max(1, Math.round((rail.clientWidth - pad * 2 + gap) / step));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({ left: dir * perPage * step, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <section className="lp-themes" id="sb-land-themes">
      <div className="lp-wrap">
        <div className="lp-section-head">
          <div>
            <h2 className="lp-h2">Pick a buddy, pick a vibe</h2>
            <p className="lp-lede">{ALL.length} themes and six mascots. Swap them anytime, no commitment.</p>
          </div>
        </div>

        <ul className="lp-mascots">
          {MASCOTS.map((m) => (
            <li className="lp-mascot" key={m.species}>
              <span className="lp-mascot-plate"><Mascot species={m.species} mood="happy" size={52} /></span>
              <span>{m.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="lp-rail-stage">
        <div className="lp-rail" ref={railRef} role="region" aria-label="Theme previews" tabIndex={0}>
          {WITH_ART.map(([name, t]) => (
            <figure className="lp-theme-card" key={name}>
              <img src={thumb(t.bgImage)} alt={`${name} theme backdrop`} width="520" height="325" loading="lazy" decoding="async" />
              <figcaption>
                <span>{name}</span>
                <span className="lp-dots" aria-hidden="true">
                  {t.palette.slice(0, 4).map((c, i) => <i key={i} style={{ background: c }} />)}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        <button type="button" className="lp-rail-btn lp-rail-prev" onClick={() => nudge(-1)} disabled={edge.start} aria-label="Previous themes"><ChevronLeft size={22} /></button>
        <button type="button" className="lp-rail-btn lp-rail-next" onClick={() => nudge(1)} disabled={edge.end} aria-label="Next themes"><ChevronRight size={22} /></button>
      </div>

      <div className="lp-wrap">
        <p className="lp-note">Plus {PALETTE_ONLY.length} palette themes:</p>
        <ul className="lp-chips">
          {PALETTE_ONLY.map(([name, t]) => (
            <li className="lp-chip" key={name}>
              <span className="lp-dots" aria-hidden="true">
                {t.palette.slice(0, 3).map((c, i) => <i key={i} style={{ background: c }} />)}
              </span>
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
