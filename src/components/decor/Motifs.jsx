import React from "react";

/*
 * Hand-drawn-style background motifs, one small library shared by every
 * theme's DecorLayer. Every shape below deliberately pulls its color only
 * from the four CSS custom properties every theme already tunes for its
 * own palette -- --accent, --accent2, --soft, --outline -- so a motif never
 * needs a per-theme color prop and always reads correctly no matter which
 * theme is active. This is what actually makes the background "theme-
 * driven": switching themes swaps both the artwork silhouette (a strawberry
 * vs. a pixel tree) *and* its coloring, not just a font-color change on a
 * single repeated emoji glyph.
 *
 * Every motif shares the same tiny contract: a 0 0 48 48 viewBox, no
 * hard-coded width/height (the wrapping <span> in DecorLayer controls
 * size), and a soft double-stroke outline so the line weight matches the
 * mascot illustrations elsewhere in the app.
 */

const OUTLINE = "var(--outline)";
const ACCENT = "var(--accent)";
const ACCENT2 = "var(--accent2)";
const SOFT = "var(--soft)";
const CARD = "var(--card)";

const strokeCap = { strokeLinecap: "round", strokeLinejoin: "round" };

function Svg({ children }) {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/* ---------- florals ---------- */

export function Blossom() {
  const angles = [0, 72, 144, 216, 288];
  return (
    <Svg>
      {angles.map((a) => (
        <path
          key={a}
          d="M24 24 C21 17 21 9 24 4 C27 9 27 17 24 24 Z"
          fill={ACCENT}
          stroke={OUTLINE}
          strokeWidth="1.3"
          {...strokeCap}
          transform={`rotate(${a} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="3.4" fill={SOFT} stroke={OUTLINE} strokeWidth="1.1" />
    </Svg>
  );
}

export function BlossomSprig() {
  return (
    <Svg>
      <path d="M6 42 Q20 32 30 12" fill="none" stroke={OUTLINE} strokeWidth="2" {...strokeCap} />
      <path d="M16 30 q-6 -1 -9 -7" fill="none" stroke={OUTLINE} strokeWidth="1.5" {...strokeCap} />
      <path d="M17 30 q1 -6 7 -8" fill={SOFT} stroke={OUTLINE} strokeWidth="1.2" {...strokeCap} />
      <g transform="translate(30 12) scale(0.34) translate(-24 -24)">
        {[0, 72, 144, 216, 288].map((a) => (
          <path
            key={a}
            d="M24 24 C21 17 21 9 24 4 C27 9 27 17 24 24 Z"
            fill={ACCENT}
            stroke={OUTLINE}
            strokeWidth="2.6"
            {...strokeCap}
            transform={`rotate(${a} 24 24)`}
          />
        ))}
        <circle cx="24" cy="24" r="4" fill={SOFT} stroke={OUTLINE} strokeWidth="2" />
      </g>
    </Svg>
  );
}

export function Tulip() {
  return (
    <Svg>
      <path d="M24 44 L24 24" stroke={OUTLINE} strokeWidth="2" {...strokeCap} />
      <path d="M24 32 q-8 2 -10 -6" fill="none" stroke={OUTLINE} strokeWidth="1.4" {...strokeCap} />
      <path d="M24 36 q8 2 10 -8" fill="none" stroke={OUTLINE} strokeWidth="1.4" {...strokeCap} />
      <path
        d="M14 22 C14 12 19 6 24 6 C29 6 34 12 34 22 C34 22 29 18 24 22 C19 18 14 22 14 22 Z"
        fill={ACCENT}
        stroke={OUTLINE}
        strokeWidth="1.4"
        {...strokeCap}
      />
      <path d="M24 6 C24 12 24 17 24 22" fill="none" stroke={ACCENT2} strokeWidth="1.2" opacity="0.8" />
    </Svg>
  );
}

/* ---------- fruit / cafe ---------- */

export function Strawberry() {
  return (
    <Svg>
      <path
        d="M24 44 C13 44 8 30 8 22 C8 13 15 8 24 8 C33 8 40 13 40 22 C40 30 35 44 24 44 Z"
        fill={ACCENT}
        stroke={OUTLINE}
        strokeWidth="1.5"
        {...strokeCap}
      />
      <path
        d="M24 8 L18 2 L24 5 L30 2 L26 8 Z"
        fill={SOFT}
        stroke={OUTLINE}
        strokeWidth="1.2"
        {...strokeCap}
      />
      {[[17, 18], [31, 18], [24, 24], [15, 27], [33, 27], [20, 33], [28, 33], [24, 38]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="1.3" ry="2" fill={SOFT} transform={`rotate(20 ${x} ${y})`} />
      ))}
    </Svg>
  );
}

export function BerryCluster() {
  const berries = [
    { x: 18, y: 26, r: 9 },
    { x: 32, y: 24, r: 8 },
    { x: 25, y: 14, r: 8.5 },
  ];
  return (
    <Svg>
      <path d="M25 6 q-2 4 0 8" fill="none" stroke={OUTLINE} strokeWidth="1.3" {...strokeCap} />
      {berries.map((b, i) => (
        <g key={i}>
          <circle cx={b.x} cy={b.y} r={b.r} fill={i === 1 ? ACCENT2 : ACCENT} stroke={OUTLINE} strokeWidth="1.4" />
          <path
            d={`M${b.x - 2} ${b.y - 2} l1.4 1.4 M${b.x + 2} ${b.y - 2} l-1.4 1.4 M${b.x} ${b.y - 3} l0 3`}
            stroke={OUTLINE}
            strokeWidth="1"
            {...strokeCap}
          />
        </g>
      ))}
    </Svg>
  );
}

export function MilkDrop() {
  return (
    <Svg>
      <path
        d="M24 4 C32 18 38 26 38 32 C38 40 32 45 24 45 C16 45 10 40 10 32 C10 26 16 18 24 4 Z"
        fill={SOFT}
        stroke={OUTLINE}
        strokeWidth="1.5"
        {...strokeCap}
      />
      <path d="M17 33 q0 6 6 8" fill="none" stroke={ACCENT} strokeWidth="2" {...strokeCap} opacity="0.85" />
    </Svg>
  );
}

export function Lollipop() {
  return (
    <Svg>
      <path d="M24 30 L24 45" stroke={OUTLINE} strokeWidth="2" {...strokeCap} />
      <circle cx="24" cy="18" r="14" fill={ACCENT2} stroke={OUTLINE} strokeWidth="1.5" />
      <path
        d="M24 6 A12 12 0 0 1 36 18 A9 9 0 0 1 27 27 A6 6 0 0 1 21 21 A3 3 0 0 1 24 18"
        fill="none"
        stroke={ACCENT}
        strokeWidth="1.6"
        {...strokeCap}
      />
    </Svg>
  );
}

export function Teacup() {
  return (
    <Svg>
      <path d="M17 8 q2 -6 -1 -8" fill="none" stroke={OUTLINE} strokeWidth="1.3" {...strokeCap} opacity="0.7" />
      <path d="M24 6 q2 -6 -1 -8" fill="none" stroke={OUTLINE} strokeWidth="1.3" {...strokeCap} opacity="0.5" />
      <path
        d="M10 20 L38 20 L35 34 C34 39 29 42 24 42 C19 42 14 39 13 34 Z"
        fill={ACCENT}
        stroke={OUTLINE}
        strokeWidth="1.5"
        {...strokeCap}
      />
      <path d="M38 22 q8 -1 8 6 q0 7 -8 6" fill="none" stroke={OUTLINE} strokeWidth="1.4" />
      <ellipse cx="24" cy="20" rx="14" ry="3" fill={SOFT} stroke={OUTLINE} strokeWidth="1.3" />
    </Svg>
  );
}

export function CoffeeCup() {
  return (
    <Svg>
      <path d="M14 10 q1 -5 -2 -7" fill="none" stroke={OUTLINE} strokeWidth="1.2" opacity="0.6" {...strokeCap} />
      <path d="M22 9 q1 -5 -2 -7" fill="none" stroke={OUTLINE} strokeWidth="1.2" opacity="0.45" {...strokeCap} />
      <path
        d="M9 18 L34 18 L31 36 C30 41 25 44 21 44 C17 44 12 41 11 36 Z"
        fill={ACCENT2}
        stroke={OUTLINE}
        strokeWidth="1.5"
        {...strokeCap}
      />
      <path d="M34 20 q7 0 7 6 q0 6 -7 6" fill="none" stroke={OUTLINE} strokeWidth="1.4" />
      <ellipse cx="21.5" cy="18" rx="12.5" ry="2.6" fill={SOFT} stroke={OUTLINE} strokeWidth="1.2" />
    </Svg>
  );
}

/* ---------- sky / whimsy ---------- */

export function Cloud() {
  return (
    <Svg>
      <path
        d="M11 32 C5 32 5 23 11 22 C11 14 22 12 26 18 C33 15 40 20 38 27 C43 27 43 34 37 34 L13 34 Z"
        fill={SOFT}
        stroke={OUTLINE}
        strokeWidth="1.5"
        {...strokeCap}
      />
    </Svg>
  );
}

export function SparkleStar() {
  return (
    <Svg>
      <path
        d="M24 4 C24 14 26 22 24 24 C22 22 24 14 24 4 Z M24 44 C24 34 22 26 24 24 C26 26 24 34 24 44 Z M4 24 C14 24 22 26 24 24 C22 22 14 24 4 24 Z M44 24 C34 24 26 22 24 24 C26 26 34 24 44 24 Z"
        fill={ACCENT}
        stroke={OUTLINE}
        strokeWidth="1.2"
        {...strokeCap}
      />
      <circle cx="24" cy="24" r="2.4" fill={SOFT} />
    </Svg>
  );
}

export function BubbleCluster() {
  return (
    <Svg>
      <circle cx="18" cy="26" r="13" fill={SOFT} stroke={OUTLINE} strokeWidth="1.4" opacity="0.9" />
      <circle cx="34" cy="16" r="7.5" fill={ACCENT2} stroke={OUTLINE} strokeWidth="1.3" opacity="0.9" />
      <path d="M13 20 q-2 4 1 7" fill="none" stroke="#fff" strokeWidth="1.6" {...strokeCap} opacity="0.7" />
      <path d="M32 13 q-1 2 1 3.5" fill="none" stroke="#fff" strokeWidth="1.2" {...strokeCap} opacity="0.7" />
    </Svg>
  );
}

/* ---------- matcha ---------- */

export function MatchaLeaf() {
  return (
    <Svg>
      <path d="M24 44 L24 24" stroke={OUTLINE} strokeWidth="1.6" {...strokeCap} />
      <path
        d="M24 24 C10 22 6 8 8 4 C24 4 32 14 24 24 Z"
        fill={ACCENT}
        stroke={OUTLINE}
        strokeWidth="1.4"
        {...strokeCap}
      />
      <path d="M10 7 C16 10 20 15 23 21" fill="none" stroke={SOFT} strokeWidth="1.1" opacity="0.8" />
      <path
        d="M24 24 C34 26 40 36 39 42 C24 42 17 33 24 24 Z"
        fill={ACCENT2}
        stroke={OUTLINE}
        strokeWidth="1.4"
        {...strokeCap}
      />
    </Svg>
  );
}

/* ---------- teddy / panda ---------- */

export function PawPrint() {
  return (
    <Svg>
      <ellipse cx="24" cy="30" rx="12" ry="10" fill={ACCENT} stroke={OUTLINE} strokeWidth="1.5" />
      <ellipse cx="11" cy="14" rx="4.6" ry="5.6" fill={ACCENT} stroke={OUTLINE} strokeWidth="1.3" transform="rotate(-18 11 14)" />
      <ellipse cx="22" cy="8" rx="4.8" ry="5.8" fill={ACCENT} stroke={OUTLINE} strokeWidth="1.3" />
      <ellipse cx="34" cy="9" rx="4.6" ry="5.6" fill={ACCENT} stroke={OUTLINE} strokeWidth="1.3" transform="rotate(12 34 9)" />
      <ellipse cx="42" cy="18" rx="4.2" ry="5.2" fill={ACCENT} stroke={OUTLINE} strokeWidth="1.3" transform="rotate(28 42 18)" />
    </Svg>
  );
}

export function BambooStalk() {
  return (
    <Svg>
      <path d="M20 44 L20 4" stroke={ACCENT} strokeWidth="7" strokeLinecap="round" />
      {[12, 22, 32].map((y) => (
        <path key={y} d={`M15 ${y} L25 ${y}`} stroke={OUTLINE} strokeWidth="1.6" {...strokeCap} />
      ))}
      <path
        d="M20 12 C30 8 36 2 38 4 C36 10 28 14 20 16 Z"
        fill={ACCENT2}
        stroke={OUTLINE}
        strokeWidth="1.3"
        {...strokeCap}
      />
      <path
        d="M20 22 C10 19 5 13 6 11 C10 16 16 20 20 22 Z"
        fill={ACCENT2}
        stroke={OUTLINE}
        strokeWidth="1.3"
        {...strokeCap}
      />
    </Svg>
  );
}

/* ---------- pixel / blockland ---------- */

const PX = 6; // one "pixel" unit for the blocky theme's chunky, un-antialiased look

export function PixelTree() {
  return (
    <Svg>
      <g shapeRendering="crispEdges">
        <rect x={4 * PX} y={5 * PX} width={PX * 3} height={PX * 3} fill={ACCENT} stroke={OUTLINE} strokeWidth="1.5" />
        <rect x={2 * PX} y={2 * PX} width={PX * 7} height={PX * 3} fill={ACCENT} stroke={OUTLINE} strokeWidth="1.5" />
        <rect x={3 * PX} y={0} width={PX * 5} height={PX * 2} fill={ACCENT2} stroke={OUTLINE} strokeWidth="1.5" />
        <rect x={5 * PX} y={7 * PX} width={PX * 1} height={PX * 1} fill={OUTLINE} />
      </g>
    </Svg>
  );
}

export function PixelBlock() {
  return (
    <Svg>
      <g shapeRendering="crispEdges">
        <rect x={4} y={4} width={40} height={40} fill={ACCENT2} stroke={OUTLINE} strokeWidth="1.8" />
        <rect x={4} y={4} width={40} height={13} fill={ACCENT} stroke={OUTLINE} strokeWidth="1.8" />
        <rect x={9} y={22} width={7} height={7} fill={SOFT} opacity="0.7" />
        <rect x={22} y={30} width={6} height={6} fill={SOFT} opacity="0.6" />
        <rect x={32} y={16} width={6} height={6} fill={SOFT} opacity="0.6" />
      </g>
    </Svg>
  );
}

/* ---------- lab / space (Comet Lab) ---------- */

export function Beaker() {
  return (
    <Svg>
      <path d="M18 6 L18 18 L8 38 C6 42 9 45 13 45 L35 45 C39 45 42 42 40 38 L30 18 L30 6"
        fill={SOFT} stroke={OUTLINE} strokeWidth="1.6" {...strokeCap} />
      <path d="M15 6 L33 6" stroke={OUTLINE} strokeWidth="1.8" {...strokeCap} />
      <path d="M12 34 L36 34 L39 39 C40 42 38 44 35 44 L13 44 C10 44 8 42 9 39 Z"
        fill={ACCENT} stroke={OUTLINE} strokeWidth="1.4" {...strokeCap} />
      <circle cx="20" cy="26" r="1.8" fill={ACCENT2} />
      <circle cx="26" cy="30" r="1.3" fill={ACCENT2} />
      <circle cx="23" cy="22" r="1.1" fill={ACCENT2} />
    </Svg>
  );
}

export function OrbitRing() {
  return (
    <Svg>
      <circle cx="24" cy="24" r="6.5" fill={ACCENT2} stroke={OUTLINE} strokeWidth="1.5" />
      <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke={ACCENT} strokeWidth="1.6"
        strokeDasharray="2.5 3.5" {...strokeCap} transform="rotate(-18 24 24)" />
      <circle cx="41" cy="19" r="2.6" fill={SOFT} stroke={OUTLINE} strokeWidth="1.2" />
    </Svg>
  );
}

export function DnaTwist() {
  return (
    <Svg>
      <path d="M14 4 C14 14 34 20 34 24 C34 28 14 34 14 44" fill="none" stroke={ACCENT}
        strokeWidth="2" {...strokeCap} />
      <path d="M34 4 C34 14 14 20 14 24 C14 28 34 34 34 44" fill="none" stroke={ACCENT2}
        strokeWidth="2" {...strokeCap} />
      {[8, 16, 24, 32, 40].map((y) => (
        <path key={y} d={`M${14 + Math.abs(24 - y) * 0.05} ${y} L${34 - Math.abs(24 - y) * 0.05} ${y}`}
          stroke={OUTLINE} strokeWidth="1.1" opacity="0.55" {...strokeCap} />
      ))}
    </Svg>
  );
}

/* ---------- night sky / dreamy (Moonlit Mochi) ---------- */

export function CrescentMoon() {
  return (
    <Svg>
      <path
        d="M30 6 C20 6 12 14 12 24 C12 34 20 42 30 42 C24 42 19 34 19 24 C19 14 24 6 30 6 Z"
        fill={ACCENT2}
        stroke={OUTLINE}
        strokeWidth="1.5"
        {...strokeCap}
      />
      {/* sleepy closed-eye smile, kawaii */}
      <path d="M16 22 q2 2 4 0 M22 22 q2 2 4 0" fill="none" stroke={OUTLINE} strokeWidth="1.3" {...strokeCap} />
      <path d="M17 27 q3 2 6 0" fill="none" stroke={OUTLINE} strokeWidth="1.2" {...strokeCap} />
      <circle cx="14" cy="25" r="1.6" fill={ACCENT} opacity="0.7" />
      <path d="M38 10 L39.3 13.3 L42.6 14.6 L39.3 15.9 L38 19.2 L36.7 15.9 L33.4 14.6 L36.7 13.3 Z" fill={SOFT} stroke={OUTLINE} strokeWidth="1" />
      <path d="M40 30 L40.8 32 L42.8 32.8 L40.8 33.6 L40 35.6 L39.2 33.6 L37.2 32.8 L39.2 32 Z" fill={ACCENT} stroke={OUTLINE} strokeWidth="0.9" />
    </Svg>
  );
}

export function ShootingStar() {
  return (
    <Svg>
      <path d="M6 38 C14 30 22 22 30 14" fill="none" stroke={ACCENT2} strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
      <path d="M10 34 C16 28 22 22 28 16" fill="none" stroke={SOFT} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <path
        d="M34 6 L36.6 12.4 L43 15 L36.6 17.6 L34 24 L31.4 17.6 L25 15 L31.4 12.4 Z"
        fill={ACCENT}
        stroke={OUTLINE}
        strokeWidth="1.3"
        {...strokeCap}
      />
      <circle cx="12" cy="36" r="2.2" fill={SOFT} stroke={OUTLINE} strokeWidth="1" />
    </Svg>
  );
}

/* ---------- pastel galaxy / candy (Cosmic Candy) ---------- */

export function CandyPlanet() {
  return (
    <Svg>
      {/* candy-stripe ring behind the planet */}
      <ellipse cx="24" cy="27" rx="21" ry="7" fill="none" stroke={ACCENT2} strokeWidth="2.4" {...strokeCap} transform="rotate(-10 24 27)" opacity="0.85" />
      <circle cx="22" cy="22" r="13.5" fill={ACCENT} stroke={OUTLINE} strokeWidth="1.6" />
      <path d="M11 17 C15 15 29 15 33 17" fill="none" stroke={SOFT} strokeWidth="1.3" opacity="0.7" {...strokeCap} />
      <path d="M9 24 C15 22 29 22 35 24" fill="none" stroke={SOFT} strokeWidth="1.3" opacity="0.55" {...strokeCap} />
      {/* cute closed-eye blush face */}
      <path d="M16 21 q1.6 1.6 3.2 0 M23 21 q1.6 1.6 3.2 0" fill="none" stroke={OUTLINE} strokeWidth="1.3" {...strokeCap} />
      <path d="M17.5 26 q2.5 1.6 5 0" fill="none" stroke={OUTLINE} strokeWidth="1.1" {...strokeCap} />
      <circle cx="15.5" cy="24" r="1.7" fill={SOFT} opacity="0.75" />
      <circle cx="27" cy="24" r="1.7" fill={SOFT} opacity="0.75" />
      {/* ring arc in front */}
      <path d="M4 25 C10 30 38 30 44 25" fill="none" stroke={ACCENT2} strokeWidth="2.6" {...strokeCap} transform="rotate(-10 24 27)" />
      <circle cx="7" cy="10" r="1.6" fill={SOFT} />
      <circle cx="40" cy="12" r="1.2" fill={ACCENT2} />
    </Svg>
  );
}

export function TwinkleStar() {
  return (
    <Svg>
      <path
        d="M24 6 C25 15 26 20 34 21 C26 22 25 27 24 36 C23 27 22 22 14 21 C22 20 23 15 24 6 Z"
        fill={ACCENT}
        stroke={OUTLINE}
        strokeWidth="1.4"
        {...strokeCap}
      />
      {/* tiny kawaii face on the star */}
      <path d="M20.5 20.5 q1 1 2 0 M25.5 20.5 q1 1 2 0" fill="none" stroke={OUTLINE} strokeWidth="1" {...strokeCap} />
      <circle cx="19.5" cy="22.5" r="1.1" fill={SOFT} opacity="0.7" />
      <circle cx="28.5" cy="22.5" r="1.1" fill={SOFT} opacity="0.7" />
      <path d="M9 10 L10.4 13.4 L13.8 14.8 L10.4 16.2 L9 19.6 L7.6 16.2 L4.2 14.8 L7.6 13.4 Z" fill={ACCENT2} stroke={OUTLINE} strokeWidth="1" />
      <path d="M39 30 L40 32.4 L42.4 33.4 L40 34.4 L39 36.8 L38 34.4 L35.6 33.4 L38 32.4 Z" fill={SOFT} stroke={OUTLINE} strokeWidth="0.9" />
    </Svg>
  );
}

/* ---------- Y2K / retro-desktop (CD-ROM Dreams) ---------- */

export function FloppyDisk() {
  return (
    <Svg>
      <path d="M8 6 H36 L40 10 V42 H8 Z" fill={ACCENT2} stroke={OUTLINE} strokeWidth="1.6" {...strokeCap} />
      <rect x="14" y="6" width="16" height="12" fill={SOFT} stroke={OUTLINE} strokeWidth="1.4" />
      <rect x="24" y="8.5" width="4" height="7" fill={OUTLINE} opacity="0.5" />
      <rect x="12" y="24" width="24" height="14" rx="1.5" fill={CARD} stroke={OUTLINE} strokeWidth="1.3" />
      <path d="M15 29 H33 M15 33 H29" stroke={OUTLINE} strokeWidth="1.2" opacity="0.5" {...strokeCap} />
    </Svg>
  );
}

export function CdDisc() {
  return (
    <Svg>
      <circle cx="24" cy="24" r="19" fill={SOFT} stroke={OUTLINE} strokeWidth="1.6" />
      <circle cx="24" cy="24" r="13.5" fill="none" stroke={ACCENT} strokeWidth="1" opacity="0.5" />
      <circle cx="24" cy="24" r="9" fill="none" stroke={ACCENT2} strokeWidth="1" opacity="0.5" />
      <path d="M10 14 A19 19 0 0 1 30 6" fill="none" stroke={ACCENT2} strokeWidth="2.4" opacity="0.75" {...strokeCap} />
      <path d="M38 16 A19 19 0 0 1 34 40" fill="none" stroke={ACCENT} strokeWidth="2.4" opacity="0.65" {...strokeCap} />
      <circle cx="24" cy="24" r="4.2" fill={CARD} stroke={OUTLINE} strokeWidth="1.4" />
      <path d="M14 12 q3 -2 6 -1" fill="none" stroke="#fff" strokeWidth="1.6" opacity="0.8" {...strokeCap} />
    </Svg>
  );
}

export function ChromeBubble() {
  return (
    <Svg>
      <circle cx="24" cy="25" r="18" fill={ACCENT} stroke={OUTLINE} strokeWidth="1.6" />
      <ellipse cx="18" cy="17" rx="7" ry="4.5" fill="#fff" opacity="0.55" transform="rotate(-18 18 17)" />
      <ellipse cx="31" cy="32" rx="4" ry="2.6" fill={ACCENT2} opacity="0.6" transform="rotate(10 31 32)" />
      <path d="M9 25 q-2 8 6 12" fill="none" stroke={SOFT} strokeWidth="1.3" opacity="0.65" {...strokeCap} />
    </Svg>
  );
}

export function RetroMonitor() {
  return (
    <Svg>
      <rect x="6" y="6" width="36" height="26" rx="4" fill={ACCENT2} stroke={OUTLINE} strokeWidth="1.6" />
      <rect x="10" y="10" width="28" height="18" rx="2" fill={SOFT} stroke={OUTLINE} strokeWidth="1.3" />
      <path d="M13 14 h10 M13 18 h16 M13 22 h8" stroke={OUTLINE} strokeWidth="1.2" opacity="0.45" {...strokeCap} />
      <path d="M18 32 L18 38 L30 38 L30 32" fill="none" stroke={OUTLINE} strokeWidth="1.6" {...strokeCap} />
      <rect x="14" y="38" width="20" height="4" rx="1.5" fill={ACCENT} stroke={OUTLINE} strokeWidth="1.4" />
    </Svg>
  );
}

/* ---------- desert (Terracotta Mesa) ---------- */

export function Cactus() {
  return (
    <Svg>
      <path
        d="M20 44 V22 C20 22 12 22 12 16 C12 12 16 10 19 13 C19 13 19 8 24 8 C29 8 29 13 29 13 C32 10 36 12 36 16 C36 22 28 22 28 22 V44 Z"
        fill={ACCENT2}
        stroke={OUTLINE}
        strokeWidth="1.6"
        {...strokeCap}
      />
      <circle cx="24" cy="9" r="2.6" fill={ACCENT} stroke={OUTLINE} strokeWidth="1" />
      <path d="M18 30 v8 M24 26 v14 M30 30 v8" stroke={OUTLINE} strokeWidth="1" opacity="0.35" {...strokeCap} />
      <rect x="12" y="40" width="24" height="5" rx="2.5" fill={SOFT} stroke={OUTLINE} strokeWidth="1.4" />
    </Svg>
  );
}

export function DesertSun() {
  return (
    <Svg>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <path key={a} d="M24 8 L24 2" stroke={ACCENT2} strokeWidth="2.2" strokeLinecap="round" transform={`rotate(${a} 24 24)`} />
      ))}
      <circle cx="24" cy="24" r="10" fill={ACCENT} stroke={OUTLINE} strokeWidth="1.6" />
      <path d="M18 22 q2 2 4 0 M26 22 q2 2 4 0" fill="none" stroke={OUTLINE} strokeWidth="1.2" {...strokeCap} />
      <path d="M19 27 q5 3 10 0" fill="none" stroke={OUTLINE} strokeWidth="1.1" {...strokeCap} />
      <circle cx="17" cy="25" r="1.4" fill={SOFT} opacity="0.7" />
      <circle cx="31" cy="25" r="1.4" fill={SOFT} opacity="0.7" />
    </Svg>
  );
}

/* ---------- festival (Marigold Mela) ---------- */

export function MarigoldFlower() {
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Svg>
      {angles.map((a) => (
        <path
          key={a}
          d="M24 24 C22 18 22 12 24 6 C26 12 26 18 24 24 Z"
          fill={ACCENT}
          stroke={OUTLINE}
          strokeWidth="1.2"
          {...strokeCap}
          transform={`rotate(${a} 24 24)`}
        />
      ))}
      {angles.map((a) => (
        <path
          key={`i${a}`}
          d="M24 22 C23 18 23 14 24 10 C25 14 25 18 24 22 Z"
          fill={ACCENT2}
          opacity="0.85"
          transform={`rotate(${a + 22.5} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="4" fill={SOFT} stroke={OUTLINE} strokeWidth="1.1" />
    </Svg>
  );
}

export function DiyaLamp() {
  return (
    <Svg>
      <path
        d="M8 30 C8 26 14 24 24 24 C34 24 40 26 40 30 C40 34 33 37 24 37 C15 37 8 34 8 30 Z"
        fill={ACCENT2}
        stroke={OUTLINE}
        strokeWidth="1.6"
        {...strokeCap}
      />
      <ellipse cx="24" cy="29.5" rx="12" ry="3.2" fill={SOFT} opacity="0.7" />
      <path d="M24 24 C22 18 24 14 24 10 C24 14 26 18 24 24 Z" fill={ACCENT} stroke={OUTLINE} strokeWidth="1.2" {...strokeCap} />
      <path d="M24 16 C23 13 24 10 24 7" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
      <circle cx="16" cy="31" r="1.1" fill={OUTLINE} opacity="0.4" />
      <circle cx="32" cy="31" r="1.1" fill={OUTLINE} opacity="0.4" />
    </Svg>
  );
}

/* ---------- citrus (Citrus Soda) ---------- */

export function LemonSlice() {
  return (
    <Svg>
      <circle cx="24" cy="24" r="18" fill={ACCENT} stroke={OUTLINE} strokeWidth="1.8" />
      <circle cx="24" cy="24" r="13" fill={SOFT} stroke={OUTLINE} strokeWidth="1.3" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <path key={a} d="M24 24 L24 12" stroke={ACCENT} strokeWidth="1.3" opacity="0.7" transform={`rotate(${a} 24 24)`} {...strokeCap} />
      ))}
      <circle cx="24" cy="24" r="2.6" fill="#fff" opacity="0.6" />
    </Svg>
  );
}

export function MintSprig() {
  return (
    <Svg>
      <path d="M24 42 V10" stroke={OUTLINE} strokeWidth="1.8" {...strokeCap} />
      <path d="M24 34 C18 33 14 29 14 24 C20 25 24 28 24 34 Z" fill={ACCENT2} stroke={OUTLINE} strokeWidth="1.3" {...strokeCap} />
      <path d="M24 26 C30 25 34 21 34 16 C28 17 24 20 24 26 Z" fill={ACCENT2} stroke={OUTLINE} strokeWidth="1.3" {...strokeCap} />
      <path d="M24 18 C19 17 16 14 16 10 C21 11 24 14 24 18 Z" fill={SOFT} stroke={OUTLINE} strokeWidth="1.2" {...strokeCap} />
    </Svg>
  );
}

/* ---------- autumn (Harvest Ember) ---------- */

export function MapleLeaf() {
  return (
    <Svg>
      <path
        d="M24 6 L27 16 L36 12 L31 20 L40 22 L30 26 L34 36 L24 30 L24 42 L21 30 L14 36 L18 26 L8 22 L17 20 L12 12 L21 16 Z"
        fill={ACCENT}
        stroke={OUTLINE}
        strokeWidth="1.5"
        {...strokeCap}
      />
      <path d="M24 24 V38" stroke={OUTLINE} strokeWidth="1.2" opacity="0.5" {...strokeCap} />
    </Svg>
  );
}

export function Acorn() {
  return (
    <Svg>
      <path d="M14 20 C14 12 34 12 34 20 C34 20 26 16 24 16 C22 16 14 20 14 20 Z" fill={ACCENT2} stroke={OUTLINE} strokeWidth="1.5" {...strokeCap} />
      <path d="M13 19 q11 5 22 0" fill="none" stroke={OUTLINE} strokeWidth="1" opacity="0.4" {...strokeCap} />
      <path
        d="M16 21 C16 32 20 40 24 42 C28 40 32 32 32 21 C32 21 28 24 24 24 C20 24 16 21 16 21 Z"
        fill={ACCENT}
        stroke={OUTLINE}
        strokeWidth="1.5"
        {...strokeCap}
      />
      <path d="M24 8 q3 -3 6 -1" fill="none" stroke={OUTLINE} strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  );
}

/* ---------- vintage / workshop ---------- */

export function Compass() {
  return (
    <Svg>
      <circle cx="24" cy="24" r="18" fill={SOFT} stroke={OUTLINE} strokeWidth="1.6" />
      <circle cx="24" cy="24" r="13" fill="none" stroke={OUTLINE} strokeWidth="1" opacity="0.4" />
      {[0, 90, 180, 270].map((a) => (
        <path key={a} d="M24 6 L24 10" stroke={OUTLINE} strokeWidth="1.3" strokeLinecap="round" transform={`rotate(${a} 24 24)`} />
      ))}
      <path d="M24 24 L30 15 L24 24 L18 33 Z" fill={ACCENT2} stroke={OUTLINE} strokeWidth="1.2" {...strokeCap} />
      <path d="M24 24 L18 15 L24 24 L30 33 Z" fill={ACCENT} stroke={OUTLINE} strokeWidth="1.2" {...strokeCap} />
      <circle cx="24" cy="24" r="2.4" fill={OUTLINE} />
    </Svg>
  );
}

export function MapPin() {
  return (
    <Svg>
      <path
        d="M24 5 C33 5 39 12 39 20 C39 30 24 43 24 43 C24 43 9 30 9 20 C9 12 15 5 24 5 Z"
        fill={ACCENT}
        stroke={OUTLINE}
        strokeWidth="1.6"
        {...strokeCap}
      />
      <circle cx="24" cy="19" r="6.5" fill={SOFT} stroke={OUTLINE} strokeWidth="1.3" />
      <path d="M20 17 q4 -3 8 0" fill="none" stroke={OUTLINE} strokeWidth="1" opacity="0.4" {...strokeCap} />
    </Svg>
  );
}

export function Barrel() {
  return (
    <Svg>
      <path d="M14 10 C14 8 34 8 34 10 L36 24 L34 38 C34 40 14 40 14 38 L12 24 Z" fill={ACCENT} stroke={OUTLINE} strokeWidth="1.6" {...strokeCap} />
      <path d="M12.6 16 L35.4 16" stroke={OUTLINE} strokeWidth="1.8" opacity="0.55" />
      <path d="M12.2 32 L35.8 32" stroke={OUTLINE} strokeWidth="1.8" opacity="0.55" />
      <path d="M18 10 C16 18 16 30 18 38" fill="none" stroke={OUTLINE} strokeWidth="1" opacity="0.35" {...strokeCap} />
      <path d="M30 10 C32 18 32 30 30 38" fill="none" stroke={OUTLINE} strokeWidth="1" opacity="0.35" {...strokeCap} />
    </Svg>
  );
}

export function OakLeaf() {
  return (
    <Svg>
      <path
        d="M24 6 C30 10 30 14 27 17 C32 17 33 22 29 25 C33 26 33 31 28 33 C25 40 24 42 24 42 C24 42 23 40 20 33 C15 31 15 26 19 25 C15 22 16 17 21 17 C18 14 18 10 24 6 Z"
        fill={ACCENT}
        stroke={OUTLINE}
        strokeWidth="1.5"
        {...strokeCap}
      />
      <path d="M24 15 V38" stroke={OUTLINE} strokeWidth="1.1" opacity="0.45" {...strokeCap} />
    </Svg>
  );
}

export function RivetStud() {
  return (
    <Svg>
      <circle cx="24" cy="24" r="14" fill={SOFT} stroke={OUTLINE} strokeWidth="1.6" />
      <circle cx="24" cy="24" r="7" fill={ACCENT2} stroke={OUTLINE} strokeWidth="1.4" />
      <circle cx="21" cy="21" r="1.8" fill={CARD} opacity="0.7" />
    </Svg>
  );
}

export function Wrench() {
  return (
    <Svg>
      <path
        d="M32 6 C37 6 41 10 41 15 C41 17.5 40 19.7 38.4 21.3 L23 36.7 C21.6 38.1 19.3 38.1 17.9 36.7 C16.5 35.3 16.5 33 17.9 31.6 L33.3 16.2 C31.7 14.6 31.7 12 33.3 10.4 C34.5 9.2 36.3 8.9 37.8 9.6"
        fill={ACCENT}
        stroke={OUTLINE}
        strokeWidth="1.6"
        {...strokeCap}
      />
      <circle cx="12" cy="41" r="5.4" fill={ACCENT2} stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M15.5 37.5 L21 32" stroke={OUTLINE} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function Gear() {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Svg>
      {teeth.map((a) => (
        <rect key={a} x="21.5" y="3" width="5" height="8" rx="1.2" fill={ACCENT} stroke={OUTLINE} strokeWidth="1.1" transform={`rotate(${a} 24 24)`} />
      ))}
      <circle cx="24" cy="24" r="13" fill={ACCENT} stroke={OUTLINE} strokeWidth="1.6" />
      <circle cx="24" cy="24" r="5.5" fill={CARD} stroke={OUTLINE} strokeWidth="1.5" />
    </Svg>
  );
}

export function QuillInk() {
  return (
    <Svg>
      <ellipse cx="14" cy="38" rx="9" ry="6" fill={ACCENT2} stroke={OUTLINE} strokeWidth="1.5" />
      <ellipse cx="14" cy="36.5" rx="5.5" ry="3" fill="none" stroke={OUTLINE} strokeWidth="1" opacity="0.35" />
      <path
        d="M17 33 C24 26 34 16 41 7 C42 10 42 14 39 17 C31 25 22 32 17 36 Z"
        fill={SOFT}
        stroke={OUTLINE}
        strokeWidth="1.5"
        {...strokeCap}
      />
      <path d="M20 30 L37 12" stroke={OUTLINE} strokeWidth="1" opacity="0.4" strokeLinecap="round" />
    </Svg>
  );
}

export const MOTIFS = {
  blossom: Blossom,
  blossomSprig: BlossomSprig,
  tulip: Tulip,
  strawberry: Strawberry,
  berryCluster: BerryCluster,
  milkDrop: MilkDrop,
  lollipop: Lollipop,
  teacup: Teacup,
  coffeeCup: CoffeeCup,
  cloud: Cloud,
  sparkleStar: SparkleStar,
  bubbleCluster: BubbleCluster,
  matchaLeaf: MatchaLeaf,
  pawPrint: PawPrint,
  bambooStalk: BambooStalk,
  pixelTree: PixelTree,
  pixelBlock: PixelBlock,
  beaker: Beaker,
  orbitRing: OrbitRing,
  dnaTwist: DnaTwist,
  crescentMoon: CrescentMoon,
  shootingStar: ShootingStar,
  candyPlanet: CandyPlanet,
  twinkleStar: TwinkleStar,
  floppyDisk: FloppyDisk,
  cdDisc: CdDisc,
  chromeBubble: ChromeBubble,
  retroMonitor: RetroMonitor,
  cactus: Cactus,
  desertSun: DesertSun,
  marigoldFlower: MarigoldFlower,
  diyaLamp: DiyaLamp,
  lemonSlice: LemonSlice,
  mintSprig: MintSprig,
  mapleLeaf: MapleLeaf,
  acorn: Acorn,
  compass: Compass,
  mapPin: MapPin,
  barrel: Barrel,
  oakLeaf: OakLeaf,
  rivetStud: RivetStud,
  wrench: Wrench,
  gear: Gear,
  quillInk: QuillInk,
};
