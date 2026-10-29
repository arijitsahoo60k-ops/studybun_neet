import React from "react";
import useBlink from "./useBlink";

/**
 * Axolotl — the third founder-only mascot. Unlike Lion/Dragon (drawn from
 * scratch for this file), every shape below is copied verbatim from the
 * reference SVG that was supplied for this mascot: tail, tail fin, both
 * gill clusters, body, belly, head shine, cheeks, arms and feet are all the
 * exact same `d` path data, untouched.
 *
 * The only things that differ from the reference are the parts that HAVE
 * to differ for it to work as a mascot in this app rather than a static
 * image:
 *   - hex fills swapped for the app's CSS theme variables (var(--card),
 *     var(--accent2), var(--outline), var(--ink)...) so it re-colors with
 *     every theme, the same as every other species already does
 *   - the eyes and mouth are now mood-driven instead of fixed, since every
 *     other part of the app (reactionMood, BuddyGuide, achievements) expects
 *     a mascot to visibly react -- the default "idle" mouth path is the
 *     reference's exact path, unchanged
 *   - the gill clusters and tail got a CSS class each so they can sway/swish
 *     gently, the same ambient motion every other mascot's signature part
 *     already has -- this only rotates the existing shape, it never
 *     redraws it
 */
const MOOD = {
  idle: { eye: "round", mouth: "M 232 239 C 239 247 249 247 256 239 C 263 247 273 247 280 239" },
  happy: { eye: "curve", eyePath: "M -16 -4 Q 0 -22 16 -4", mouth: "M 218 234 Q 256 272 294 234" },
  sad: { eye: "curve", eyePath: "M -16 2 Q 0 10 16 2", mouth: "M 220 252 Q 256 226 292 252", tear: true },
  sleepy: { eye: "curve", eyePath: "M -15 0 Q 0 8 15 0", mouth: "M 238 241 Q 256 246 274 241", zzz: true },
  thinking: { eye: "round", mouth: "M 224 240 Q 248 235 270 239", brow: true, bubbles: true },
  celebrate: { eye: "curve", eyePath: "M -18 -6 Q 0 -26 18 -6", mouth: "M 210 230 Q 256 282 302 230", sparkle: true },
  concerned: { eye: "round", mouth: "M 222 248 Q 256 238 290 248", brow: true },
  studying: { eye: "round", mouth: "M 232 239 C 239 247 249 247 256 239 C 263 247 273 247 280 239", book: true },
  reminder: { eye: "round", mouth: "M 226 239 Q 256 233 286 239", bell: true },
};

const BLINK_PATH = "M -15 0 Q 0 8 15 0";

export default function Axolotl({ mood = "idle", size = 72, hop = false, peek = false, hopLoop = false }) {
  const m = MOOD[mood] || MOOD.idle;
  const blink = useBlink(mood);

  const eye = blink ? (
    <path d={BLINK_PATH} stroke="var(--ink)" strokeWidth="9" fill="none" strokeLinecap="round" />
  ) : m.eye === "round" ? (
    <>
      <circle cx="0" cy="0" r="28" fill="var(--ink)" />
      <circle cx="-9" cy="-10" r="8" fill="#fff" />
    </>
  ) : (
    <path d={m.eyePath} stroke="var(--ink)" strokeWidth="9" fill="none" strokeLinecap="round" />
  );

  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={{ overflow: "visible", flexShrink: 0 }}
      className={`sb-species-axolotl ${hop ? "sb-bunny-hop" : ""} ${peek ? "sb-axolotl-peek" : ""} ${hopLoop ? "sb-bunny-hop-loop" : ""}`}>

      {/* Tail -- exact reference paths */}
      <g className="sb-axolotl-tail">
        <path
          d="M176 377 C132 374 94 389 76 417 C67 431 72 449 91 455 C121 463 166 448 201 427 C220 416 232 402 240 388 Z"
          fill="var(--accent2)" stroke="var(--outline)" strokeWidth="9" strokeLinejoin="round"
        />
        <path
          d="M78 421 C97 399 128 391 165 396 C139 403 112 414 92 429 C117 426 145 420 173 411"
          fill="var(--accent)" stroke="var(--outline)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"
        />
      </g>

      {/* LEFT GILLS -- exact reference paths */}
      <g className="sb-axolotl-gill-l">
        <path
          d="M158 137 C137 117 112 103 91 108 C76 112 75 126 84 139 C92 151 107 157 126 159 C103 157 81 164 77 177 C73 190 88 199 105 197 C123 195 140 184 153 174 C133 186 115 202 117 215 C120 229 139 229 154 218 C169 207 180 191 184 176"
          fill="var(--accent2)" stroke="var(--outline)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"
        />
        <path d="M94 121 C108 135 124 143 143 148" fill="none" stroke="var(--soft)" strokeWidth="7" strokeLinecap="round" />
        <path d="M88 177 C108 178 126 173 143 166" fill="none" stroke="var(--soft)" strokeWidth="7" strokeLinecap="round" />
        <path d="M124 211 C139 199 150 187 157 174" fill="none" stroke="var(--soft)" strokeWidth="7" strokeLinecap="round" />
      </g>

      {/* RIGHT GILLS -- exact reference paths */}
      <g className="sb-axolotl-gill-r">
        <path
          d="M354 137 C375 117 400 103 421 108 C436 112 437 126 428 139 C420 151 405 157 386 159 C409 157 431 164 435 177 C439 190 424 199 407 197 C389 195 372 184 359 174 C379 186 397 202 395 215 C392 229 373 229 358 218 C343 207 332 191 328 176"
          fill="var(--accent2)" stroke="var(--outline)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"
        />
        <path d="M418 121 C404 135 388 143 369 148" fill="none" stroke="var(--soft)" strokeWidth="7" strokeLinecap="round" />
        <path d="M424 177 C404 178 386 173 369 166" fill="none" stroke="var(--soft)" strokeWidth="7" strokeLinecap="round" />
        <path d="M388 211 C373 199 362 187 355 174" fill="none" stroke="var(--soft)" strokeWidth="7" strokeLinecap="round" />
      </g>

      {/* Main body -- exact reference path */}
      <path
        d="M256 74 C181 74 126 119 126 196 C126 229 137 253 155 272 C144 294 139 323 144 351 C151 392 178 421 215 430 C230 434 244 427 256 417 C268 427 282 434 297 430 C334 421 361 392 368 351 C373 323 368 294 357 272 C375 253 386 229 386 196 C386 119 331 74 256 74Z"
        fill="var(--card)" stroke="var(--outline)" strokeWidth="10" strokeLinejoin="round"
      />

      {/* Soft belly -- exact reference path */}
      <path
        d="M183 279 C183 260 208 249 256 249 C304 249 329 260 329 279 C329 315 319 356 303 379 C291 396 275 403 256 403 C237 403 221 396 209 379 C193 356 183 315 183 279Z"
        fill="var(--soft)"
      />

      {/* Head shine -- exact reference ellipses */}
      <ellipse cx="224" cy="111" rx="17" ry="10" transform="rotate(27 224 111)" fill="#fff" />
      <ellipse cx="247" cy="101" rx="6" ry="5" fill="#fff" />

      {/* Eyes -- mood-driven, same size/position as the reference art's
          eyes (r28 circle + r8 highlight when at rest) */}
      <g transform="translate(203,205)">{eye}</g>
      <g transform="translate(309,205)">{eye}</g>
      {m.brow && (
        <>
          <path d="M 179 175 Q 195 165 209 173" stroke="var(--ink)" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M 303 173 Q 317 165 333 175" stroke="var(--ink)" strokeWidth="6" fill="none" strokeLinecap="round" />
        </>
      )}

      {/* Cheeks -- exact reference ellipses */}
      <ellipse cx="171" cy="246" rx="23" ry="12" transform="rotate(-8 171 246)" fill="var(--accent)" opacity="0.75" />
      <ellipse cx="341" cy="246" rx="23" ry="12" transform="rotate(8 341 246)" fill="var(--accent)" opacity="0.75" />

      {/* Mouth -- mood-driven; "idle"/"studying" use the reference's exact path */}
      <path d={m.mouth} stroke="var(--outline)" strokeWidth="7" fill="none" strokeLinecap="round" />

      {/* Arms -- exact reference paths */}
      <path d="M184 293 C167 297 158 309 161 322 C164 336 178 343 191 340 C202 337 209 329 207 318" fill="none" stroke="var(--outline)" strokeWidth="9" strokeLinecap="round" />
      <path d="M328 293 C345 297 354 309 351 322 C348 336 334 343 321 340 C310 337 303 329 305 318" fill="none" stroke="var(--outline)" strokeWidth="9" strokeLinecap="round" />

      {/* Feet -- exact reference paths */}
      <path d="M216 375 C204 389 202 411 210 426 C216 437 232 439 242 428 C248 421 250 408 248 393" fill="var(--card)" stroke="var(--outline)" strokeWidth="9" strokeLinejoin="round" />
      <path d="M296 375 C308 389 310 411 302 426 C296 437 280 439 270 428 C264 421 262 408 264 393" fill="var(--card)" stroke="var(--outline)" strokeWidth="9" strokeLinejoin="round" />

      {m.book && (
        <g transform="translate(345,345)">
          <rect x="-39" y="-24" width="78" height="52" rx="9" fill="var(--soft)" stroke="var(--outline)" strokeWidth="7" />
          <path d="M 0 -24 L 0 28" stroke="var(--outline)" strokeWidth="6" />
        </g>
      )}
      {m.zzz && <text x="380" y="110" fontSize="34" fill="var(--muted)" fontFamily="var(--font-display)">z</text>}
      {m.tear && (
        <g transform="translate(150,225)">
          <g className="sb-mascot-tear">
            <path d="M 0 0 C 6.6 9 12 15.6 12 22.2 A 12 12 0 1 1 -12 22.2 C -12 15.6 -6.6 9 0 0 Z" fill="#8FCBEA" stroke="var(--outline)" strokeWidth="3" strokeLinejoin="round" />
            <ellipse cx="-4" cy="16" rx="3" ry="4.2" fill="#fff" opacity="0.85" />
          </g>
        </g>
      )}
      {m.bubbles && (
        <g className="sb-axolotl-bubbles" opacity="0.6">
          <circle cx="220" cy="292" r="9" fill="none" stroke="var(--muted)" strokeWidth="6" />
          <circle cx="290" cy="306" r="6.5" fill="none" stroke="var(--muted)" strokeWidth="5" />
        </g>
      )}
      {m.sparkle && (
        <>
          <text x="60" y="100" fontSize="34">✨</text>
          <text x="410" y="90" fontSize="34">✨</text>
        </>
      )}
      {m.bell && <text x="365" y="95" fontSize="40">🔔</text>}
    </svg>
  );
}
