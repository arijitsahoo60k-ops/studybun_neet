import React from "react";
import useBlink from "./useBlink";

const OUTLINE = { stroke: "var(--outline)", strokeWidth: 2.2, strokeLinejoin: "round" };

/**
 * Lion — the founder mascot. Reads as warm-regal rather than scary: a big
 * soft petal mane that changes size with mood, sleepy half-lidded eyes, a
 * tiny crown that's always on (it's the founders' animal, the crown is the
 * point), and a tuft-tipped tail that swishes.
 *
 * The mane is the whole personality here, the way the tail is for Fox: it
 * puffs up when celebrating, flattens and sinks when sad, and tucks in when
 * sleepy. Everything else on the face is deliberately simple so the mane
 * stays the thing you notice at 40px on a nav pill.
 */
const MOOD = {
  idle: { eye: "round", eyeR: 3.2, mouth: "M -5 8 Q 0 11.5 5 8", mane: "normal", tail: "curl" },
  happy: { eye: "curve", eyePath: "M -3.8 -1 Q 0 -5.6 3.8 -1", mouth: "M -6.5 6.5 Q 0 15 6.5 6.5", mane: "up", tail: "wag" },
  sad: { eye: "curve", eyePath: "M -3.8 0.6 Q 0 3 3.8 0.6", mouth: "M -5.5 12.5 Q 0 8.5 5.5 12.5", mane: "droop", tail: "droop", tear: true, earsBack: true },
  sleepy: { eye: "curve", eyePath: "M -4 0 Q 0 2.6 4 0", mouth: "M -3.5 9.5 Q 0 10.8 3.5 9.5", mane: "tuck", tail: "wrap", zzz: true },
  thinking: { eye: "round", eyeR: 3, mouth: "M -4 9 Q -1 7 3.4 9", mane: "normal", tail: "tap", brow: true },
  celebrate: { eye: "curve", eyePath: "M -4 -1.8 Q 0 -7 4 -1.8", mouth: "M -7.5 6 Q 0 17 7.5 6", mane: "poof", tail: "wag", sparkle: true },
  concerned: { eye: "round", eyeR: 2.8, mouth: "M -5.5 11 Q 0 7.5 5.5 11", mane: "droop", tail: "droop", brow: true, earsBack: true },
  studying: { eye: "round", eyeR: 3, mouth: "M -4 8.5 Q 0 10.5 4 8.5", mane: "normal", tail: "curl", book: true },
  reminder: { eye: "round", eyeR: 3.3, mouth: "M -4.5 9 Q 0 7 4.5 9", mane: "up", tail: "up", bell: true },
};

// How the mane sits, per mood: [radius of the petal ring, petal size, vertical
// nudge]. One table instead of nine hand-drawn paths, so the silhouette stays
// consistent while the mood still visibly changes the shape.
const MANE = {
  normal: [27.5, 8.6, 0],
  up: [29, 9.2, -1],
  poof: [32, 10.4, -1.5],
  droop: [25, 7.6, 3],
  tuck: [24.5, 7.8, 1.5],
};

const TAILS = {
  curl: "M 19 24 Q 33 22 32 8",
  wag: "M 19 24 Q 36 18 34 2",
  wrap: "M 15 29 Q 32 32 31 20",
  tap: "M 19 24 Q 32 20 28 8",
  droop: "M 18 27 Q 30 31 27 20",
  up: "M 17 24 Q 27 8 23 -12",
};

// Where the tuft sits at the end of each tail path above.
const TUFT = {
  curl: [32, 8], wag: [34, 2], wrap: [31, 20], tap: [28, 8], droop: [27, 20], up: [23, -12],
};

export default function Lion({ mood = "idle", size = 72, hop = false, peek = false, hopLoop = false }) {
  const m = MOOD[mood] || MOOD.idle;
  const blink = useBlink(mood);
  const [maneR, petalR, maneDy] = MANE[m.mane] || MANE.normal;
  const [tuftX, tuftY] = TUFT[m.tail] || TUFT.curl;

  // 11 petals, skipping the bottom of the circle so the mane frames the face
  // instead of swallowing the chin.
  const petals = Array.from({ length: 11 }, (_, i) => {
    const a = (-200 + (i / 10) * 220) * (Math.PI / 180);
    return { cx: Math.cos(a) * maneR, cy: Math.sin(a) * maneR * 0.92 - 2 + maneDy, key: i };
  });

  const eye = (
    <>
      {blink ? (
        <path d="M -4 0 Q 0 2.4 4 0" stroke="var(--ink)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      ) : m.eye === "round" ? (
        <>
          <circle cx="0" cy="0" r={m.eyeR} fill="var(--ink)" />
          <circle cx={-m.eyeR * 0.34} cy={-m.eyeR * 0.34} r={m.eyeR * 0.34} fill="#fff" />
        </>
      ) : (
        <path d={m.eyePath} stroke="var(--ink)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      )}
    </>
  );

  return (
    <svg width={size} height={size} viewBox="-46 -54 92 96" style={{ overflow: "visible", flexShrink: 0 }}
      className={`sb-species-lion ${hop ? "sb-bunny-hop" : ""} ${peek ? "sb-lion-peek" : ""} ${hopLoop ? "sb-bunny-hop-loop" : ""}`}>

      {/* tail, tuft on the end */}
      <path className="sb-lion-tail" d={TAILS[m.tail] || TAILS.curl} fill="none" stroke="var(--accent2)" strokeWidth="5" strokeLinecap="round" />
      <circle cx={tuftX} cy={tuftY} r="5.4" fill="var(--accent2)" stroke="var(--outline)" strokeWidth="1.8" />

      {/* the mane: a ring of soft petals that grows/shrinks with mood */}
      <g className="sb-lion-mane">
        {petals.map((p) => (
          <circle key={p.key} cx={p.cx} cy={p.cy} r={petalR} fill="var(--accent2)" stroke="var(--outline)" strokeWidth="2" />
        ))}
      </g>

      {/* Ears sit ABOVE the mane but BELOW the head, and poke out past the
          head's own outline -- drawn any earlier in the stack and the mane
          swallows them, any later and the head fill covers them. */}
      <g className="sb-ear sb-ear-l" style={{ transform: m.earsBack ? "rotate(-20deg) translate(1px,4px)" : "none" }}>
        <circle cx="-17" cy="-22" r="7.4" fill="var(--card)" {...OUTLINE} />
        <circle cx="-17" cy="-22" r="3.6" fill="var(--soft)" />
      </g>
      <g className="sb-ear sb-ear-r" style={{ transform: m.earsBack ? "rotate(20deg) translate(-1px,4px)" : "none" }}>
        <circle cx="17" cy="-22" r="7.4" fill="var(--card)" {...OUTLINE} />
        <circle cx="17" cy="-22" r="3.6" fill="var(--soft)" />
      </g>

      {/* head */}
      <path
        d="M -20 -8 Q -21 -25 0 -26 Q 21 -25 20 -8 Q 20 12 10 20 Q 0 27 -10 20 Q -20 12 -20 -8 Z"
        fill="var(--card)" stroke="var(--outline)" strokeWidth="2.4" strokeLinejoin="round"
      />

      {/* the crown -- always on, this is the founders' lion */}
      <g className="sb-lion-crown">
        <path d="M -9 -26 L -9 -34 L -4.5 -29.5 L 0 -36 L 4.5 -29.5 L 9 -34 L 9 -26 Z"
          fill="#F6C945" stroke="var(--outline)" strokeWidth="1.9" strokeLinejoin="round" />
        <circle cx="0" cy="-35.5" r="1.7" fill="var(--card)" stroke="var(--outline)" strokeWidth="1.1" />
      </g>

      {/* blush */}
      <circle cx="-10" cy="5" r="4.2" fill="var(--accent)" opacity="0.32" />
      <circle cx="10" cy="5" r="4.2" fill="var(--accent)" opacity="0.32" />

      <g transform="translate(-7,-4)">
        {eye}
        {m.brow && <path d="M -6 -7.5 Q -2 -5 1.5 -7" stroke="var(--ink)" strokeWidth="1.5" fill="none" strokeLinecap="round" />}
      </g>
      <g transform="translate(7,-4) scale(-1,1)">
        {eye}
        {m.brow && <path d="M -6 -7.5 Q -2 -5 1.5 -7" stroke="var(--ink)" strokeWidth="1.5" fill="none" strokeLinecap="round" />}
      </g>

      {/* muzzle: two soft bumps + heart-ish nose */}
      <ellipse cx="-4.4" cy="8.5" rx="6.2" ry="5" fill="var(--soft)" stroke="var(--outline)" strokeWidth="1.4" />
      <ellipse cx="4.4" cy="8.5" rx="6.2" ry="5" fill="var(--soft)" stroke="var(--outline)" strokeWidth="1.4" />
      <path d="M -3 2.6 Q 0 0.8 3 2.6 Q 1.6 5.6 0 6.4 Q -1.6 5.6 -3 2.6 Z" fill="var(--ink)" />
      <path d={m.mouth} stroke="var(--ink)" strokeWidth="1.8" fill="none" strokeLinecap="round" />

      {/* whiskers, short and kitten-ish so it stays cute, not fierce */}
      <g stroke="var(--outline)" strokeWidth="1.2" strokeLinecap="round" opacity="0.7">
        <path d="M -12 7 L -19 5.5" />
        <path d="M -12 10 L -19 10.5" />
        <path d="M 12 7 L 19 5.5" />
        <path d="M 12 10 L 19 10.5" />
      </g>

      {m.book && (
        <g transform="translate(10,17)">
          <rect x="-7" y="-4" width="14" height="10" rx="1.6" fill="var(--soft)" stroke="var(--outline)" strokeWidth="1.5" />
          <path d="M 0 -4 L 0 6" stroke="var(--outline)" strokeWidth="1.3" />
        </g>
      )}
      {m.zzz && <text x="20" y="-26" fontSize="11" fill="var(--muted)" fontFamily="var(--font-display)">z</text>}
      {m.tear && (
        <g transform="translate(-14,3)">
          <g className="sb-mascot-tear">
            <path d="M 0 0 C 2.2 3 4 5.2 4 7.4 A 4 4 0 1 1 -4 7.4 C -4 5.2 -2.2 3 0 0 Z" fill="#8FCBEA" stroke="var(--outline)" strokeWidth="1" strokeLinejoin="round" />
            <ellipse cx="-1.3" cy="5.4" rx="1" ry="1.4" fill="#fff" opacity="0.85" />
          </g>
        </g>
      )}
      {m.sparkle && (
        <>
          <text x="-34" y="-24" fontSize="11">✨</text>
          <text x="26" y="-30" fontSize="11">✨</text>
        </>
      )}
      {m.bell && <text x="18" y="-26" fontSize="13">🔔</text>}
    </svg>
  );
}
