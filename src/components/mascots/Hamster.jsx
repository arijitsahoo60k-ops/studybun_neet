import React from "react";
import useBlink from "./useBlink";

const OUTLINE = { stroke: "var(--outline)", strokeWidth: 2.2, strokeLinejoin: "round" };

/**
 * Hamster is short, wide and beady-eyed -- the opposite proportions of
 * every other species. Cheek pouches puff up or flatten with mood, and a
 * sunflower seed stands in for the book/glasses/quill the others carry.
 */
const MOOD = {
  idle: { eye: "dot", mouth: "M -4 12 Q 0 14 4 12", cheek: 1 },
  happy: { eye: "arc", mouth: "M -5 11 Q 0 17 5 11", cheek: 1.15 },
  sad: { eye: "worry", mouth: "M -4 15.5 Q 0 12 4 15.5", cheek: 0.55, tear: true },
  sleepy: { eye: "line", mouth: "M -3 13 Q 0 13.6 3 13", zzz: true, cheek: 0.85 },
  thinking: { eye: "dot", mouth: "M -3 13 Q -0.5 12 2.5 13", brow: true, cheek: 1 },
  celebrate: { eye: "arc", mouth: "M -6 10.5 Q 0 18 6 10.5", sparkle: true, cheek: 1.3 },
  concerned: { eye: "worry", mouth: "M -4 14.5 Q 0 12 4 14.5", cheek: 0.7 },
  studying: { eye: "dot", mouth: "M -3.5 12.5 Q 0 13.6 3.5 12.5", seed: true, cheek: 1 },
  reminder: { eye: "wide", mouth: "M -3 11.5 Q 0 10.2 3 11.5", earPerk: true, bell: true, cheek: 1.1 },
};

function Eye({ state, mirror }) {
  const flip = mirror ? -1 : 1;
  if (state === "arc") return <path d={`M ${-3 * flip} 0.5 Q 0 ${-2.6} ${3 * flip} 0.5`} stroke="var(--ink)" strokeWidth="1.8" fill="none" strokeLinecap="round" />;
  if (state === "line") return <path d={`M ${-2.6 * flip} 0 Q 0 0.7 ${2.6 * flip} 0`} stroke="var(--ink)" strokeWidth="1.6" fill="none" strokeLinecap="round" />;
  if (state === "worry") return <path d={`M ${-2.4 * flip} 0.8 Q 0 -1.4 ${2.4 * flip} 0.8`} stroke="var(--ink)" strokeWidth="1.7" fill="none" strokeLinecap="round" />;
  const r = state === "wide" ? 3.1 : 2.6;
  return (
    <>
      <circle cx="0" cy="0" r={r} fill="var(--ink)" />
      <circle cx={-0.85 * flip} cy="-0.85" r="0.85" fill="var(--card)" />
    </>
  );
}

export default function Hamster({ mood = "idle", size = 72, hop = false, peek = false }) {
  const m = MOOD[mood] || MOOD.idle;
  const blink = useBlink(mood);
  const eyeState = blink ? "line" : m.eye;

  return (
    <svg width={size} height={size} viewBox="-42 -50 84 92" style={{ overflow: "visible", flexShrink: 0 }}
      className={`sb-species-hamster ${hop ? "sb-bunny-hop" : ""} ${peek ? "sb-hamster-peek" : ""}`}>

      {/* tiny stub tail, barely visible -- a hamster detail no other species has */}
      <ellipse cx="0" cy="24" rx="4" ry="3" fill="var(--soft)" {...OUTLINE} strokeWidth="1.2" />

      {/* stuffed cheek pouches, size breathes with mood */}
      <ellipse className="sb-hamster-cheek" cx="-28" cy="8" rx={11 * m.cheek} ry={9 * m.cheek} fill="var(--soft)" stroke="var(--outline)" strokeWidth="1.4" />
      <ellipse className="sb-hamster-cheek" cx="28" cy="8" rx={11 * m.cheek} ry={9 * m.cheek} fill="var(--soft)" stroke="var(--outline)" strokeWidth="1.4" />

      {/* tiny round ears */}
      <circle className="sb-ear sb-ear-l" cx="-19" cy="-13" r="7.5" fill="var(--accent2)" {...OUTLINE} />
      <circle className="sb-ear sb-ear-r" cx="19" cy="-13" r="7.5" fill="var(--accent2)" style={{ transform: m.earPerk ? "translateY(-2.5px)" : "none" }} />
      <circle cx="-19" cy="-13" r="3.2" fill="var(--soft)" />
      <circle cx="19" cy="-13" r="3.2" fill="var(--soft)" />

      {/* short, wide, squashed head */}
      <ellipse cx="0" cy="0" rx="30" ry="21" fill="var(--card)" stroke="var(--outline)" strokeWidth="2.4" />

      <circle cx="-13" cy="4" r="4" fill="var(--accent)" opacity="0.38" />
      <circle cx="13" cy="4" r="4" fill="var(--accent)" opacity="0.38" />

      <g transform="translate(-8,-3)">
        <Eye state={eyeState} mirror={false} />
        {m.brow && <path d="M -4 -4.5 Q -0.5 -6.5 2 -4.5" stroke="var(--ink)" strokeWidth="1.2" fill="none" strokeLinecap="round" />}
      </g>
      <g transform="translate(8,-3)"><Eye state={eyeState} mirror={true} /></g>

      <path d={m.mouth} stroke="var(--ink)" strokeWidth="1.7" fill="none" strokeLinecap="round" />

      <line x1="-3" y1="8" x2="-15" y2="6" stroke="var(--ink)" strokeWidth="0.8" opacity="0.5" />
      <line x1="-3" y1="11" x2="-15" y2="12" stroke="var(--ink)" strokeWidth="0.8" opacity="0.5" />
      <line x1="3" y1="8" x2="15" y2="6" stroke="var(--ink)" strokeWidth="0.8" opacity="0.5" />
      <line x1="3" y1="11" x2="15" y2="12" stroke="var(--ink)" strokeWidth="0.8" opacity="0.5" />

      {/* little buck teeth, unique to the hamster */}
      <rect x="-3" y="8" width="2.6" height="4" rx="0.6" fill="var(--card)" stroke="var(--outline)" strokeWidth="1" />
      <rect x="0.4" y="8" width="2.6" height="4" rx="0.6" fill="var(--card)" stroke="var(--outline)" strokeWidth="1" />

      {m.seed && (
        <g transform="translate(-30,-24) rotate(-20)">
          <path d="M 0 0 Q 4 4 0 10 Q -4 4 0 0 Z" fill="#B8975A" stroke="var(--outline)" strokeWidth="1" />
        </g>
      )}
      {m.zzz && <text x="18" y="-20" fontSize="11" fill="var(--muted)" fontFamily="var(--font-display)">z</text>}
      {m.tear && (
        <g transform="translate(-13,1) scale(0.8)">
          <g className="sb-mascot-tear">
            <path d="M 0 0 C 2.2 3 4 5.2 4 7.4 A 4 4 0 1 1 -4 7.4 C -4 5.2 -2.2 3 0 0 Z" fill="#8FCBEA" stroke="var(--outline)" strokeWidth="1" strokeLinejoin="round" />
            <ellipse cx="-1.3" cy="5.4" rx="1" ry="1.4" fill="#fff" opacity="0.85" />
          </g>
        </g>
      )}
      {m.sparkle && (
        <>
          <text x="-32" y="-16" fontSize="11">✨</text>
          <text x="24" y="-20" fontSize="11">✨</text>
        </>
      )}
      {m.bell && <text x="16" y="-18" fontSize="13">🔔</text>}
    </svg>
  );
}
