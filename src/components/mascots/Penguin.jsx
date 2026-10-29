import React from "react";
import useBlink from "./useBlink";

/**
 * Penguin is the only species with no visible ears and a full two-tone
 * body instead of a head-and-ears silhouette -- flippers instead of paws,
 * a waddle instead of a hop, and a scarf as its one signature accessory.
 */
const MOOD = {
  idle: { eye: "dot", mouth: "flat", flippers: "down" },
  happy: { eye: "arc", mouth: "smile", flippers: "out" },
  sad: { eye: "worry", mouth: "frown", flippers: "in", lean: true, tear: true },
  sleepy: { eye: "closed", mouth: "flat", flippers: "down", zzz: true, lean: true },
  thinking: { eye: "dot", mouth: "flat", flippers: "chin", brow: true },
  celebrate: { eye: "arc", mouth: "grin", flippers: "up", sparkle: true },
  concerned: { eye: "worry", mouth: "wobble", flippers: "in" },
  studying: { eye: "dot", mouth: "flat", flippers: "book" },
  reminder: { eye: "wide", mouth: "flat", flippers: "down", bell: true },
};

const MOUTHS = {
  flat: "M -4 0 L 4 0",
  smile: "M -5 -1 Q 0 4 5 -1",
  grin: "M -6 -1 Q 0 6 6 -1",
  wobble: "M -4 1 Q 0 -1.5 4 1",
  frown: "M -5 3 Q 0 -2 5 3",
};

function Eye({ state, mirror }) {
  const flip = mirror ? -1 : 1;
  if (state === "arc") return <path d={`M ${-2.6 * flip} 0.4 Q 0 ${-2.4} ${2.6 * flip} 0.4`} stroke="var(--card)" strokeWidth="1.8" fill="none" strokeLinecap="round" />;
  if (state === "closed") return <path d={`M ${-2.4 * flip} 0 Q 0 0.8 ${2.4 * flip} 0`} stroke="var(--card)" strokeWidth="1.6" fill="none" strokeLinecap="round" />;
  if (state === "worry") return <path d={`M ${-2.2 * flip} 0.6 Q 0 -1.2 ${2.2 * flip} 0.6`} stroke="var(--ink)" strokeWidth="1.6" fill="none" strokeLinecap="round" />;
  const r = state === "wide" ? 3.3 : 2.8;
  return (
    <>
      <circle cx="0" cy="0" r={r} fill="var(--ink)" />
      <circle cx={-0.85 * flip} cy="-0.85" r="0.85" fill="#fff" />
    </>
  );
}

export default function Penguin({ mood = "idle", size = 72, hop = false, peek = false }) {
  const m = MOOD[mood] || MOOD.idle;
  const blink = useBlink(mood);
  const eyeState = blink ? "closed" : m.eye;

  const flipL = { down: "rotate(20 -30 8)", out: "rotate(45 -30 8)", up: "rotate(150 -30 8) translate(6,-4)", in: "rotate(5 -30 8) translate(4,0)", chin: "rotate(70 -30 8) translate(6,-4)", book: "rotate(35 -30 8)" }[m.flippers];
  const flipR = { down: "rotate(-20 30 8)", out: "rotate(-45 30 8)", up: "rotate(-150 30 8) translate(-6,-4)", in: "rotate(-5 30 8) translate(-4,0)", chin: "rotate(-70 30 8) translate(-6,-4)", book: "rotate(-35 30 8)" }[m.flippers];

  return (
    <svg width={size} height={size} viewBox="-42 -50 84 92" style={{ overflow: "visible", flexShrink: 0 }}
      className={`sb-species-penguin ${hop ? "sb-waddle" : ""} ${peek ? "sb-penguin-peek" : ""}`}>
      <g transform={m.lean ? "rotate(-4)" : undefined}>

      <ellipse cx="0" cy="0" rx="23" ry="27" fill="var(--accent)" opacity="0.16" />
      <ellipse cx="0" cy="0" rx="26" ry="30" fill="var(--ink)" />
      <ellipse cx="0" cy="5" rx="17" ry="19" fill="var(--card)" />
      <circle cx="-11" cy="9" r="3.6" fill="var(--accent)" opacity="0.3" />
      <circle cx="11" cy="9" r="3.6" fill="var(--accent)" opacity="0.3" />

      {/* flippers -- the one body part that swings with mood, standing in for arms/paws/tail */}
      <ellipse className="sb-penguin-flipper" cx="-30" cy="8" rx="7" ry="16" fill="var(--ink)" transform={flipL} />
      <ellipse className="sb-penguin-flipper" cx="30" cy="8" rx="7" ry="16" fill="var(--ink)" transform={flipR} />

      {/* scarf, the only clothing any species wears */}
      <path d="M -15 -8 Q 0 -2 15 -8 L 15 -3 Q 0 3 -15 -3 Z" fill="var(--accent2)" stroke="var(--outline)" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="9" y="-4" width="6" height="14" rx="1.5" fill="var(--accent2)" stroke="var(--outline)" strokeWidth="1.2" transform="rotate(12 12 3)" />

      <path d="M -5 12 L 5 12 L 0 20 Z" fill="#FFC65C" />

      <g transform="translate(-8,-2)">
        <Eye state={eyeState} mirror={false} />
        {m.brow && <path d="M -4 -4.5 Q -0.5 -6.5 2 -4.5" stroke="var(--card)" strokeWidth="1.2" fill="none" strokeLinecap="round" />}
      </g>
      <g transform="translate(8,-2)"><Eye state={eyeState} mirror={true} /></g>

      <path d={MOUTHS[m.mouth]} stroke="var(--ink)" strokeWidth="1.6" fill="none" strokeLinecap="round" transform="translate(0,6)" />

      <ellipse cx="-8" cy="31" rx="5" ry="3" fill="#FFC65C" />
      <ellipse cx="8" cy="31" rx="5" ry="3" fill="#FFC65C" />

      {m.flippers === "book" && (
        <g transform="translate(-40,10)">
          <rect x="0" y="0" width="16" height="11" rx="1.5" fill="var(--soft)" stroke="var(--outline)" strokeWidth="1.2" />
          <line x1="8" y1="0" x2="8" y2="11" stroke="var(--outline)" strokeWidth="1" />
        </g>
      )}
      {m.zzz && <text x="18" y="-24" fontSize="11" fill="var(--muted)" fontFamily="var(--font-display)">z</text>}
      {m.tear && (
        <g transform="translate(-14,1)">
          <g className="sb-mascot-tear">
            <path d="M 0 0 C 2.2 3 4 5.2 4 7.4 A 4 4 0 1 1 -4 7.4 C -4 5.2 -2.2 3 0 0 Z" fill="#8FCBEA" stroke="var(--outline)" strokeWidth="1" strokeLinejoin="round" />
            <ellipse cx="-1.3" cy="5.4" rx="1" ry="1.4" fill="#fff" opacity="0.85" />
          </g>
        </g>
      )}
      {m.sparkle && (
        <>
          <text x="-32" y="-20" fontSize="11">✨</text>
          <text x="24" y="-26" fontSize="11">✨</text>
        </>
      )}
      {m.bell && <text x="16" y="-22" fontSize="13">🔔</text>}
      </g>
    </svg>
  );
}
