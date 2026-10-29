import React, { useRef, useState, useEffect, useLayoutEffect, useMemo } from "react";
import { motion, useAnimationControls } from "framer-motion";
import gsap from "gsap";
import Bunny from "./mascots/Bunny";
import Cat from "./mascots/Cat";
import Fox from "./mascots/Fox";
import Bear from "./mascots/Bear";
import Hamster from "./mascots/Hamster";
import Penguin from "./mascots/Penguin";
import Lion from "./mascots/Lion";
import Dragon from "./mascots/Dragon";
import Axolotl from "./mascots/Axolotl";

/*
 * Every species below is handcrafted independently in its own file under
 * ./mascots -- its own silhouette, its own eyes/mouth vocabulary, its own
 * signature accessory and body part (tail, paws, cheek pouches, flippers).
 * None of them share a face-parts table; this file only routes to the
 * right one and keeps the same {species, mood, size, hop, peek} API every
 * page in the app already calls.
 *
 * Animation layering: the species' own CSS (ear wiggle, tail sway, cheek
 * puff, hop/waddle) stays exactly as designed -- it's bespoke per animal
 * and already respects prefers-reduced-motion. This file adds two more
 * layers on top, on two *different* elements so they never fight over the
 * same transform:
 *   - an outer <span>, driven by GSAP: a slow ambient idle drift, plus a
 *     one-shot sparkle flourish whenever mood flips to "celebrate".
 *   - an inner <motion.span>, driven by Framer Motion: a spring pop-in on
 *     mount, and (when pettable) a squish played imperatively via
 *     squishControls in `pet()`. This is deliberately the ONLY thing that
 *     ever touches this element's scale -- a prior version also had a
 *     declarative `whileHover`/`whileTap` on the same value, and Framer's
 *     gesture layer racing against the imperative controls is what used to
 *     leave the mascot stuck rendering a shrunk in-between frame.
 */
// Lion, Dragon and Axolotl are founder-only *to pick* (see data/mascots.js +
// migration_founder_mascots.sql) -- but they're routed here exactly like
// every other species on purpose. Rendering must never depend on who's
// looking: a founder's lion still has to draw correctly on a plain member's
// leaderboard row, chat message, and community post.
const SPECIES = { bunny: Bunny, cat: Cat, fox: Fox, bear: Bear, hamster: Hamster, penguin: Penguin, lion: Lion, dragon: Dragon, axolotl: Axolotl };

// A handful of hearts/sparkles per pet, each with its own tiny random drift
// so a burst never looks identical twice.
const PET_BITS = ["💗", "✨", "💕", "⭐"];
const CELEBRATE_BITS = ["✨", "🎉", "⭐", "💫"];

function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// Fallback "how alive should this look" value for callers that don't pass an
// explicit `energy` (most of the app). Pages that know the real numbers
// (Dashboard, BuddyGuide) pass a precise value from data/mascots.js's
// mascotEnergy() instead -- this is just a sensible default per mood so the
// rest of the app still feels responsive without every call site changing.
const DEFAULT_ENERGY = {
  idle: 0.5, happy: 0.7, sad: 0.12, sleepy: 0.3, thinking: 0.5,
  celebrate: 1, concerned: 0.4, studying: 0.65, reminder: 0.55,
};

/**
 * pettable: when true, tapping the mascot doesn't navigate/toggle anything --
 * it just reacts. A quick spring squish plays on the species wrapper (works
 * for every species without touching their individual SVGs) and a small
 * burst of hearts/sparkles floats up and fades. Species stay dumb about this;
 * it's purely a wrapper-level delight moment for ambient/idle placements
 * (Dashboard hero, Focus Timer) -- not for spots where tapping the mascot
 * already does something else (BuddyGuide avatar, onboarding picker, etc).
 */
export default function Mascot({ species = "bunny", mood = "idle", size = 72, hop = false, peek = false, hopLoop = false, pettable = false, onPet, energy, ambient = true }) {
  const Species = SPECIES[species] || Bunny;
  const [bursts, setBursts] = useState([]);
  const [celebrateBits, setCelebrateBits] = useState([]);
  const idRef = useRef(0);
  const outerRef = useRef(null);
  const burstTimeoutsRef = useRef([]);
  const prevMoodRef = useRef(mood);
  const reduced = useMemo(prefersReducedMotion, []);
  const squishControls = useAnimationControls();
  const liveliness = energy ?? DEFAULT_ENERGY[mood] ?? 0.5;
  const sad = mood === "sad";

  // Randomized-per-instance idle bob timing, computed ONCE per mount/mood
  // change (not per frame). Previously this fed a continuous gsap.to()
  // yoyo/repeat tween that re-ran on the JS main thread every frame, for
  // every mascot mounted at once -- on the landing page alone that's up to
  // five concurrent RAF loops (Hero, NavBar, FeatureShowcase, ThemeGallery,
  // ClosingCta), several of them off-screen, which is exactly the kind of
  // work Lighthouse's "13 long tasks" / high TBT was catching. A plain CSS
  // `animation` driven by these custom properties does the identical
  // sway/slump visually but runs on the compositor thread, effectively free
  // on main thread and paused by the browser automatically when the
  // element is off-screen.
  const idleBobVars = useMemo(() => {
    if (sad) {
      return {
        "--sb-bob-y": "3.2px",
        "--sb-bob-rot": "-2.6deg",
        "--sb-bob-dur": `${(3.2 + Math.random() * 1.2).toFixed(2)}s`,
        "--sb-bob-delay": `${(Math.random() * 0.6).toFixed(2)}s`,
      };
    }
    return {
      "--sb-bob-y": `${-(2.2 + liveliness * 4.5).toFixed(2)}px`,
      "--sb-bob-rot": `${(1 + liveliness * 2).toFixed(2)}deg`,
      "--sb-bob-dur": `${(Math.max(1, 2.9 - liveliness * 1.7) + Math.random() * 0.5).toFixed(2)}s`,
      "--sb-bob-delay": `${(Math.random() * 0.7).toFixed(2)}s`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sad, liveliness]);
  const idleBobActive = !reduced && !hop && !hopLoop && ambient;

  // Spring pop-in on first mount, then settle. Skipped under
  // prefers-reduced-motion, which just shows the mascot in place.
  useEffect(() => {
    if (reduced) {
      squishControls.set({ opacity: 1, scale: 1 });
      return;
    }
    squishControls.start({ opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 16 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      burstTimeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  // Ambient idle drift now lives entirely in CSS (see idleBobVars /
  // idleBobActive above + the .sb-mascot-idle rule in GlobalStyle) -- this
  // effect only used to spin up the gsap tween and has been removed.
  //
  // This is where "energetic when you study, sad when you don't" actually
  // shows up as motion, not just a face: `liveliness` (0-1) speeds the loop
  // up and makes it bouncier as the day goes better. A neglected "sad"
  // mascot doesn't just get a smaller version of the happy bounce -- it gets
  // a different motion entirely: a slow downward slump instead of an upward
  // bob, like a shoulders-down sigh repeating on a long, heavy beat.

  // Celebrate flourish -- fires once whenever mood transitions *into*
  // "celebrate" (not on every re-render while it stays celebrate), using a
  // GSAP timeline to fan a few sparkles out and fade them, independent of
  // the tap-driven pet burst below.
  useEffect(() => {
    const prevMood = prevMoodRef.current;
    prevMoodRef.current = mood;
    if (mood === "celebrate" && prevMood !== "celebrate" && !reduced) {
      const id = idRef.current++;
      setCelebrateBits(
        Array.from({ length: 5 }, (_, i) => ({
          key: `c-${id}-${i}`,
          glyph: CELEBRATE_BITS[Math.floor(Math.random() * CELEBRATE_BITS.length)],
          angle: (i / 5) * 360 + Math.random() * 24,
        }))
      );
    }
  }, [mood, reduced]);

  useLayoutEffect(() => {
    if (!celebrateBits.length || !outerRef.current) return;
    const nodes = outerRef.current.querySelectorAll("[data-celebrate-bit]");
    if (!nodes.length) return;
    const tl = gsap.timeline({ onComplete: () => setCelebrateBits([]) });
    tl.fromTo(
      nodes,
      { opacity: 0, scale: 0.4, x: 0, y: 0 },
      {
        opacity: 1,
        scale: 1,
        x: (i) => Math.cos((celebrateBits[i].angle * Math.PI) / 180) * 30,
        y: (i) => Math.sin((celebrateBits[i].angle * Math.PI) / 180) * 30 - 10,
        duration: 0.5,
        stagger: 0.04,
        ease: "back.out(2)",
      }
    ).to(nodes, { opacity: 0, y: "-=14", duration: 0.5 }, "+=0.35");
    return () => tl.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrateBits]);

  const squishingRef = useRef(false);

  const pet = () => {
    if (!pettable) return;
    const id = idRef.current++;
    const bits = Array.from({ length: 4 }, (_, i) => ({
      key: `${id}-${i}`,
      glyph: PET_BITS[Math.floor(Math.random() * PET_BITS.length)],
      dx: (Math.random() - 0.5) * 46,
      delay: i * 55,
    }));
    setBursts((cur) => [...cur, { id, bits }]);
    const burstTimeout = setTimeout(() => setBursts((cur) => cur.filter((b) => b.id !== id)), 900);
    burstTimeoutsRef.current.push(burstTimeout);
    // Guard against overlapping triggers (rapid re-taps, mobile "ghost
    // clicks" firing a synthetic click right after the real tap): if a
    // squish is already mid-flight, let it finish instead of restarting it.
    // The bounce itself never dips below scale 1 (pop up to 1.22, settle
    // back to 1) -- earlier versions dipped down to 0.9 mid-sequence, and
    // if that got interrupted anywhere the mascot could freeze on that
    // smaller value. With every keyframe at or above 1, there's no small
    // value left for an interruption to ever get stuck on.
    if (!reduced && !squishingRef.current) {
      squishingRef.current = true;
      squishControls
        .start({
          scale: [1, 1.22, 1.08, 1],
          transition: { duration: 0.45, ease: [0.34, 1.56, 0.64, 1] },
        })
        .then(() => {
          squishingRef.current = false;
          // Belt-and-suspenders: force the resting value back explicitly
          // in case anything left it somewhere mid-sequence.
          squishControls.set({ scale: 1 });
        });
    }
    onPet?.();
  };

  const body = <Species mood={mood} size={size} hop={hop} peek={peek} hopLoop={hopLoop} />;

  const inner = (
    <motion.span
      style={{ display: "inline-flex", transformOrigin: "50% 78%" }}
      initial={reduced ? false : { opacity: 0, scale: 0.5 }}
      animate={squishControls}
    >
      {body}
    </motion.span>
  );

  const wrapperProps = pettable
    ? {
        role: "button",
        tabIndex: 0,
        "aria-label": "Pet your study buddy",
        onClick: pet,
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pet();
          }
        },
      }
    : {};

  return (
    <span
      ref={outerRef}
      className={[pettable ? "sb-mascot-pet-wrap" : "", idleBobActive ? "sb-mascot-idle" : ""].filter(Boolean).join(" ") || undefined}
      style={{
        display: "inline-flex",
        position: "relative",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        ...(idleBobActive ? idleBobVars : null),
      }}
      {...wrapperProps}
    >
      {inner}
      {celebrateBits.map((bit) => (
        <span
          key={bit.key}
          data-celebrate-bit
          style={{ position: "absolute", left: "50%", top: "38%", fontSize: 13, lineHeight: 1, pointerEvents: "none", transform: "translate(-50%, 0)" }}
        >
          {bit.glyph}
        </span>
      ))}
      {bursts.map((b) =>
        b.bits.map((bit) => (
          <span
            key={bit.key}
            className="sb-mascot-pet-bit"
            style={{ "--dx": `${bit.dx}px`, animationDelay: `${bit.delay}ms` }}
          >
            {bit.glyph}
          </span>
        ))
      )}
    </span>
  );
}
