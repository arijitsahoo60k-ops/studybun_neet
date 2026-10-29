import React from "react";
import useBlink from "./useBlink";

const OUTLINE = { stroke: "var(--outline)", strokeWidth: 2.2, strokeLinejoin: "round" };

/**
 * Bear is the big, soft, slow one: small round dot-eyes (never a slit or an
 * almond), stubby visible paws at the bottom of the frame, and a honey pot
 * instead of a book for studying.
 */
const MOOD = {
  idle: { eye: "dot", mouth: "M -6 15 Q 0 19 6 15" },
  happy: { eye: "arc", mouth: "M -8 14 Q 0 24 8 14" },
  sad: { eye: "worry", mouth: "M -6 21 Q 0 16 6 21", brow: true, tear: true },
  sleepy: { eye: "line", mouth: "M -4 16.5 Q 0 17.5 4 16.5", zzz: true },
  thinking: { eye: "dot", mouth: "M -4 16 Q -1 14.5 3 16", brow: true, paw: true },
  celebrate: { eye: "arc", mouth: "M -9 14 Q 0 26 9 14", sparkle: true, armsUp: true },
  concerned: { eye: "worry", mouth: "M -6 19 Q 0 15 6 19", brow: true },
  studying: { eye: "dot", mouth: "M -5 15.5 Q 0 17.5 5 15.5", honey: true },
  reminder: { eye: "dot", mouth: "M -4 15 Q 0 13 4 15", earPerk: true, bell: true },
};

function Eye({ state, mirror }) {
  const flip = mirror ? -1 : 1;
  if (state === "arc") return <path d={`M ${-4.4 * flip} 0.6 Q 0 ${-4.2} ${4.4 * flip} 0.6`} stroke="var(--ink)" strokeWidth="2.2" fill="none" strokeLinecap="round" />;
  if (state === "line") return <path d={`M ${-4 * flip} 0 Q 0 1 ${4 * flip} 0`} stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" />;
  if (state === "worry") return <path d={`M ${-3.6 * flip} 1 Q 0 -2 ${3.6 * flip} 1`} stroke="var(--ink)" strokeWidth="2.1" fill="none" strokeLinecap="round" />;
  return (
    <>
      <circle cx="0" cy="0" r="3.4" fill="var(--ink)" />
      <circle cx={-1.1 * flip} cy="-1.1" r="1.1" fill="#fff" />
    </>
  );
}

export default function Bear({ mood = "idle", size = 72, hop = false, peek = false }) {
  const m = MOOD[mood] || MOOD.idle;
  const blink = useBlink(mood);
  const eyeState = blink ? "line" : m.eye;

  return (
    <svg width={size} height={size} viewBox="-42 -50 84 92" style={{ overflow: "visible", flexShrink: 0 }}
      className={`sb-species-bear ${hop ? "sb-bunny-hop" : ""} ${peek ? "sb-bear-peek" : ""}`}>

      {/* stubby paws peeking out at the base -- Bear's signature, no other species has them */}
      <ellipse
        cx="-24" cy="30" rx="9" ry="7" fill="var(--card)" {...OUTLINE}
        transform={m.armsUp ? "translate(2,-30) rotate(-30 -24 30)" : undefined}
      />
      <ellipse
        cx="24" cy="30" rx="9" ry="7" fill="var(--card)" {...OUTLINE}
        transform={m.armsUp ? "translate(-2,-30) rotate(30 24 30)" : undefined}
      />

      {/* small round ears, set wide on the big head */}
      <circle className="sb-ear sb-ear-l" cx="-22" cy="-23" r="11" fill="var(--accent2)" {...OUTLINE} />
      <circle className="sb-ear sb-ear-r" cx="22" cy="-23" r="11" fill="var(--accent2)" style={{ transform: m.earPerk ? "translateY(-3px)" : "none" }} />
      <circle cx="-22" cy="-23" r="5" fill="var(--soft)" />
      <circle cx="22" cy="-23" r="5" fill="var(--soft)" />

      {/* big, wide, chubby head -- noticeably larger than every other species */}
      <ellipse cx="0" cy="0" rx="29" ry="27" fill="var(--card)" stroke="var(--outline)" strokeWidth="2.4" />

      {/* big rounded muzzle patch, wider and lower than any other species' snout */}
      <ellipse cx="0" cy="15" rx="17" ry="12" fill="var(--soft)" stroke="var(--outline)" strokeWidth="1.4" />
      <ellipse cx="0" cy="9" rx="4.4" ry="3" fill="var(--ink)" />

      <circle cx="-17" cy="0" r="4.8" fill="var(--accent)" opacity="0.35" />
      <circle cx="17" cy="0" r="4.8" fill="var(--accent)" opacity="0.35" />

      <g transform="translate(-11,-9)">
        <Eye state={eyeState} mirror={false} />
        {m.brow && <path d="M -6 -6 Q -1 -9 3 -6.5" stroke="var(--ink)" strokeWidth="1.5" fill="none" strokeLinecap="round" />}
      </g>
      <g transform="translate(11,-9)">
        <Eye state={eyeState} mirror={true} />
        {m.brow && <path d="M 6 -6 Q 1 -9 -3 -6.5" stroke="var(--ink)" strokeWidth="1.5" fill="none" strokeLinecap="round" />}
      </g>

      <path d={m.mouth} stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" />

      {m.honey && (
        <g transform="translate(-33,16)">
          <path d="M -6 0 L 6 0 L 5 12 Q 0 15 -5 12 Z" fill="#E8A33D" stroke="var(--outline)" strokeWidth="1.4" strokeLinejoin="round" />
          <rect x="-7" y="-3" width="14" height="4" rx="1.5" fill="var(--outline)" />
        </g>
      )}
      {m.paw && <ellipse cx="14" cy="8" rx="5" ry="4.5" fill="var(--soft)" stroke="var(--outline)" strokeWidth="1.4" transform="rotate(20 14 8)" />}
      {m.zzz && <text x="20" y="-24" fontSize="11" fill="var(--muted)" fontFamily="var(--font-display)">z</text>}
      {m.tear && (
        <g transform="translate(-19,-2)">
          <g className="sb-mascot-tear">
            <path d="M 0 0 C 2.2 3 4 5.2 4 7.4 A 4 4 0 1 1 -4 7.4 C -4 5.2 -2.2 3 0 0 Z" fill="#8FCBEA" stroke="var(--outline)" strokeWidth="1" strokeLinejoin="round" />
            <ellipse cx="-1.3" cy="5.4" rx="1" ry="1.4" fill="#fff" opacity="0.85" />
          </g>
        </g>
      )}
      {m.sparkle && (
        <>
          <text x="-34" y="-20" fontSize="11">✨</text>
          <text x="26" y="-26" fontSize="11">✨</text>
        </>
      )}
      {m.bell && <text x="18" y="-22" fontSize="13">🔔</text>}
    </svg>
  );
}
