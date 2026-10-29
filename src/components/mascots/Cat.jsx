import React from "react";
import useBlink from "./useBlink";

const OUTLINE = { stroke: "var(--outline)", strokeWidth: 2.2, strokeLinejoin: "round" };

/**
 * Cat's own face vocabulary: almond eyes with a vertical slit pupil (never a
 * round dot or a plain stroked arc like the other species), a closed-eye
 * "^^" for happy/blink, and a heavy droop for sleepy. Nothing here is
 * borrowed from Bunny's FACES table.
 */
const MOOD = {
  idle: { eye: "open", pupil: 4.2, mouth: "M -5 5.5 Q 0 7.5 5 5.5" },
  happy: { eye: "closed", mouth: "M -6 4 Q 0 12 6 4" },
  sad: { eye: "heavy", pupil: 1.6, mouth: "M -5.5 8 Q 0 4.5 5.5 8", earsBack: true, tear: true },
  sleepy: { eye: "heavy", pupil: 1, mouth: "M -4 6.5 Q 0 7.5 4 6.5", zzz: true },
  thinking: { eye: "squint", pupil: 2.6, mouth: "M -3 6.5 Q 0 5 3 6.5", paw: true },
  celebrate: { eye: "closed", mouth: "M -7 4 Q 0 14 7 4", sparkle: true, tailUp: true },
  concerned: { eye: "open", pupil: 1.8, mouth: "M -5 7.5 Q 0 4.5 5 7.5", earsBack: true },
  studying: { eye: "down", pupil: 3.6, mouth: "M -4 5.5 Q 0 6.5 4 5.5", glasses: true },
  reminder: { eye: "open", pupil: 4.8, mouth: "M -4 5 Q 0 3.5 4 5", earPerk: true, bell: true },
};

function Eye({ state, pupil, mirror }) {
  const flip = mirror ? -1 : 1;
  if (state === "closed") {
    return <path d={`M ${-6 * flip} 1 Q 0 ${-5} ${6 * flip} 1`} stroke="var(--ink)" strokeWidth="2.1" fill="none" strokeLinecap="round" />;
  }
  if (state === "heavy") {
    return (
      <>
        <path d={`M ${-6 * flip} -1 Q 0 -4 ${6 * flip} -1`} fill="none" stroke="var(--ink)" strokeWidth="1.3" opacity="0.55" />
        <path d={`M ${-5.5 * flip} 1 Q 0 2.6 ${5.5 * flip} 1`} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
      </>
    );
  }
  const dy = state === "down" ? 1.2 : 0;
  return (
    <>
      <path
        d={`M ${-6.4 * flip} 0.5 Q ${-2.5 * flip} -5.2 ${2.4 * flip} 0 Q ${-2.5 * flip} 5.2 ${-6.4 * flip} 0.5 Z`}
        fill="var(--card)" stroke="var(--ink)" strokeWidth="1.2"
      />
      <ellipse cx={-1.6 * flip} cy={dy} rx="1.7" ry={pupil} fill="var(--ink)" />
      <circle cx={-1.6 * flip - 0.5 * flip} cy={dy - Math.min(pupil, 2.6) * 0.4} r={Math.min(pupil * 0.28, 0.9)} fill="#fff" />
    </>
  );
}

export default function Cat({ mood = "idle", size = 72, hop = false, peek = false }) {
  const m = MOOD[mood] || MOOD.idle;
  const blink = useBlink(mood);
  const eyeState = blink ? "closed" : m.eye;

  return (
    <svg width={size} height={size} viewBox="-42 -50 84 92" style={{ overflow: "visible", flexShrink: 0 }}
      className={`sb-species-cat ${hop ? "sb-bunny-hop" : ""} ${peek ? "sb-cat-peek" : ""}`}>

      {/* curling tail, wrapped around the base -- no other species has one */}
      <path
        className="sb-cat-tail"
        d={m.tailUp
          ? "M 20 30 Q 34 26 33 12 Q 32 2 24 4"
          : "M 20 30 Q 38 32 36 18 Q 35 8 26 10"}
        fill="none" stroke="var(--accent2)" strokeWidth="8" strokeLinecap="round"
      />

      {/* ears, pulled back flat for "concerned", perked extra tall for "reminder" */}
      <g className="sb-ear sb-ear-l" style={{ transform: m.earsBack ? "rotate(-32deg) translate(3px,4px)" : "none" }}>
        <path d="M -22 -18 L -12 -34 L -4 -16 Z" fill="var(--accent2)" {...OUTLINE} />
        <path d="M -19 -19 L -13 -29 L -8 -18 Z" fill="var(--soft)" />
      </g>
      <g className="sb-ear sb-ear-r" style={{ transform: m.earPerk ? "translateY(-3px) scaleY(1.1)" : "none" }}>
        <path d="M 22 -18 L 12 -34 L 4 -16 Z" fill="var(--accent2)" {...OUTLINE} />
        <path d="M 19 -19 L 13 -29 L 8 -18 Z" fill="var(--soft)" />
      </g>
      {/* fluffy cheek tufts */}
      <path d="M -25 2 Q -34 5 -27 12 Q -24 8 -20 8 Z" fill="var(--accent2)" {...OUTLINE} />
      <path d="M 25 2 Q 34 5 27 12 Q 24 8 20 8 Z" fill="var(--accent2)" {...OUTLINE} />

      {/* heart-shaped head, tapering to a gently rounded chin */}
      <path
        d="M -25 -3 Q -27 -22 0 -24 Q 27 -22 25 -3 Q 25 12 13 19 Q 0 24 -13 19 Q -25 12 -25 -3 Z"
        fill="var(--card)" stroke="var(--outline)" strokeWidth="2.4" strokeLinejoin="round"
      />

      <path d="M -2.6 1 L 2.6 1 L 0 4.5 Z" fill="var(--soft)" stroke="var(--outline)" strokeWidth="1" strokeLinejoin="round" />

      <circle cx="-9" cy="9" r="4.4" fill="var(--accent)" opacity="0.4" />
      <circle cx="9" cy="9" r="4.4" fill="var(--accent)" opacity="0.4" />

      <g transform="translate(-8,-3)"><Eye state={eyeState} pupil={m.pupil} mirror={false} /></g>
      <g transform="translate(8,-3)"><Eye state={eyeState} pupil={m.pupil} mirror={true} /></g>

      <path d={m.mouth} stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" transform="translate(0,3)" />

      {/* whiskers, always on top */}
      <path d="M -6 6 L -18 3" stroke="var(--ink)" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M -6 9 L -18 10" stroke="var(--ink)" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M 6 6 L 18 3" stroke="var(--ink)" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M 6 9 L 18 10" stroke="var(--ink)" strokeWidth="1.3" strokeLinecap="round" />

      {m.glasses && (
        <g transform="translate(0,-3)" stroke="var(--outline)" strokeWidth="1.6" fill="none">
          <circle cx="-8" cy="0" r="7.5" />
          <circle cx="8" cy="0" r="7.5" />
          <line x1="-0.5" y1="0" x2="0.5" y2="0" />
          <line x1="-15.5" y1="-1" x2="-19" y2="-3" />
          <line x1="15.5" y1="-1" x2="19" y2="-3" />
        </g>
      )}
      {m.paw && (
        <ellipse cx="-16" cy="12" rx="6" ry="5" fill="var(--soft)" stroke="var(--outline)" strokeWidth="1.4" transform="rotate(-18 -16 12)" />
      )}
      {m.zzz && <text x="18" y="-22" fontSize="11" fill="var(--muted)" fontFamily="var(--font-display)">z</text>}
      {m.tear && (
        <g transform="translate(-15,3)">
          <g className="sb-mascot-tear">
            <path d="M 0 0 C 2.2 3 4 5.2 4 7.4 A 4 4 0 1 1 -4 7.4 C -4 5.2 -2.2 3 0 0 Z" fill="#8FCBEA" stroke="var(--outline)" strokeWidth="1" strokeLinejoin="round" />
            <ellipse cx="-1.3" cy="5.4" rx="1" ry="1.4" fill="#fff" opacity="0.85" />
          </g>
        </g>
      )}
      {m.sparkle && (
        <>
          <text x="-32" y="-18" fontSize="11">✨</text>
          <text x="22" y="-24" fontSize="11">✨</text>
        </>
      )}
      {m.bell && <text x="16" y="-20" fontSize="13">🔔</text>}
    </svg>
  );
}
