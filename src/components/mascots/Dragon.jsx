import React from "react";
import useBlink from "./useBlink";

/**
 * Dragon — founder-only mascot. Every shape below is copied from the
 * reference SVG supplied for this mascot: tail, both bat wings (outer
 * silhouette + membrane + finger lines), ears, horns, body, belly, cheeks,
 * nose, arms, feet and head shine are all the exact same `d` path data,
 * untouched.
 *
 * The only things that differ from the reference are the parts that HAVE
 * to differ for it to work as a mascot in this app rather than a static
 * image (same approach as Axolotl, which was built the same way):
 *   - hex fills swapped for the app's CSS theme variables (var(--card),
 *     var(--accent2), var(--outline), var(--ink)...) so it re-colors with
 *     every theme, the same as every other species already does
 *   - the eyes and mouth are now mood-driven instead of fixed, since every
 *     other part of the app (reactionMood, BuddyGuide, achievements) expects
 *     a mascot to visibly react -- the default "idle"/"studying" mouth path
 *     is the reference's exact path, unchanged
 *   - the wings and tail each got their existing CSS hook class
 *     (.sb-dragon-wing-l/-r, .sb-dragon-tail) so the flap/swish ambient
 *     animation and the peek-hover flap already defined in GlobalStyle keep
 *     working -- this only rotates the existing shape, it never redraws it
 */
const MOOD = {
  idle: { eye: "round", mouth: "M232 241 C239 248 249 248 256 241 C263 248 273 248 280 241" },
  happy: { eye: "curve", eyePath: "M -16 -4 Q 0 -22 16 -4", mouth: "M218 236 Q256 274 294 236", fang: true },
  sad: { eye: "curve", eyePath: "M -16 2 Q 0 10 16 2", mouth: "M220 254 Q256 228 292 254", tear: true },
  sleepy: { eye: "curve", eyePath: "M -15 0 Q 0 8 15 0", mouth: "M238 243 Q256 248 274 243", zzz: true },
  thinking: { eye: "round", mouth: "M224 242 Q248 237 270 241", brow: true, smoke: true },
  celebrate: { eye: "curve", eyePath: "M -18 -6 Q 0 -26 18 -6", mouth: "M210 232 Q256 284 302 232", sparkle: true, flame: true },
  concerned: { eye: "round", mouth: "M222 250 Q256 240 290 250", brow: true },
  studying: { eye: "round", mouth: "M232 241 C239 248 249 248 256 241 C263 248 273 248 280 241", scroll: true },
  reminder: { eye: "round", mouth: "M226 241 Q256 235 286 241", bell: true },
};

const BLINK_PATH = "M -15 0 Q 0 8 15 0";

export default function Dragon({ mood = "idle", size = 72, hop = false, peek = false, hopLoop = false }) {
  const m = MOOD[mood] || MOOD.idle;
  const blink = useBlink(mood);

  const eye = blink ? (
    <path d={BLINK_PATH} stroke="var(--ink)" strokeWidth="9" fill="none" strokeLinecap="round" />
  ) : m.eye === "round" ? (
    <>
      <ellipse cx="0" cy="0" rx="28" ry="31" fill="var(--ink)" />
      <circle cx="-9" cy="-10" r="8" fill="#fff" />
    </>
  ) : (
    <path d={m.eyePath} stroke="var(--ink)" strokeWidth="9" fill="none" strokeLinecap="round" />
  );

  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={{ overflow: "visible", flexShrink: 0 }}
      className={`sb-species-dragon ${hop ? "sb-bunny-hop" : ""} ${peek ? "sb-dragon-peek" : ""} ${hopLoop ? "sb-bunny-hop-loop" : ""}`}>

      {/* Tail -- exact reference paths */}
      <g className="sb-dragon-tail">
        <path
          d="M205 357 C171 350 135 358 104 378 C77 396 62 416 68 435 C74 454 98 461 127 453 C160 444 191 422 214 398 C228 383 232 368 220 360 C216 358 211 357 205 357Z"
          fill="var(--card)" stroke="var(--outline)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"
        />
        <path
          d="M75 425 C101 435 131 431 161 416 C184 404 204 386 219 368"
          fill="none" stroke="var(--soft)" strokeWidth="7" strokeLinecap="round"
        />
        <path d="M105 448 C106 433 102 419 94 407" fill="none" stroke="var(--muted)" strokeWidth="5" strokeLinecap="round" />
        <path d="M139 438 C140 422 135 409 128 397" fill="none" stroke="var(--muted)" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* LEFT WING -- exact reference paths */}
      <g className="sb-dragon-wing sb-dragon-wing-l">
        <path
          d="M190 287 C169 270 148 257 125 249 C103 242 82 243 65 251 C51 258 43 270 46 281 C49 293 61 299 78 299 C92 299 105 295 118 289 C101 300 87 311 82 323 C77 335 83 345 94 349 C106 354 120 348 134 338 L151 325 C139 339 130 353 131 365 C132 377 141 383 152 380 C166 377 180 364 192 350 C207 332 216 311 211 298 C207 293 199 289 190 287Z"
          fill="var(--accent2)" stroke="var(--outline)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"
        />
        <path
          d="M188 293 C165 276 144 265 122 258 C101 252 81 253 64 261 C78 266 95 268 113 264 L125 284 C140 282 155 285 169 292 L151 319 C164 315 176 317 187 323 C192 313 195 303 188 293Z"
          fill="var(--soft)"
        />
        <path d="M188 293 C169 297 151 307 134 322 C122 333 112 344 101 348" fill="none" stroke="var(--muted)" strokeWidth="6" strokeLinecap="round" />
        <path d="M169 292 C163 302 157 312 151 319" fill="none" stroke="var(--muted)" strokeWidth="5" strokeLinecap="round" />
        <path d="M125 284 C121 292 119 300 118 309" fill="none" stroke="var(--muted)" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* RIGHT WING -- exact reference paths */}
      <g className="sb-dragon-wing sb-dragon-wing-r">
        <path
          d="M322 287 C343 270 364 257 387 249 C409 242 430 243 447 251 C461 258 469 270 466 281 C463 293 451 299 434 299 C420 299 407 295 394 289 C411 300 425 311 430 323 C435 335 429 345 418 349 C406 354 392 348 378 338 L361 325 C373 339 382 353 381 365 C380 377 371 383 360 380 C346 377 332 364 320 350 C305 332 296 311 301 298 C305 293 313 289 322 287Z"
          fill="var(--accent2)" stroke="var(--outline)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"
        />
        <path
          d="M324 293 C347 276 368 265 390 258 C411 252 431 253 448 261 C434 266 417 268 399 264 L387 284 C372 282 357 285 343 292 L361 319 C348 315 336 317 325 323 C320 313 317 303 324 293Z"
          fill="var(--soft)"
        />
        <path d="M324 293 C343 297 361 307 378 322 C390 333 400 344 411 348" fill="none" stroke="var(--muted)" strokeWidth="6" strokeLinecap="round" />
        <path d="M343 292 C349 302 355 312 361 319" fill="none" stroke="var(--muted)" strokeWidth="5" strokeLinecap="round" />
        <path d="M387 284 C391 292 393 300 394 309" fill="none" stroke="var(--muted)" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* Ears -- exact reference paths */}
      <path
        d="M172 151 C148 137 126 139 116 154 C106 169 117 187 136 191 C151 194 167 185 179 170 L184 154Z"
        fill="var(--card)" stroke="var(--outline)" strokeWidth="9" strokeLinejoin="round"
      />
      <path d="M162 156 C148 149 136 151 131 160 C127 168 135 176 145 178 C153 178 160 173 167 166Z" fill="var(--accent)" />
      <path
        d="M340 151 C364 137 386 139 396 154 C406 169 395 187 376 191 C361 194 345 185 333 170 L328 154Z"
        fill="var(--card)" stroke="var(--outline)" strokeWidth="9" strokeLinejoin="round"
      />
      <path d="M350 156 C364 149 376 151 381 160 C385 168 377 176 367 178 C359 178 352 173 345 166Z" fill="var(--accent)" />

      {/* Horns -- exact reference paths */}
      <path d="M181 126 C165 104 164 76 178 53 C186 40 201 42 208 57 C216 76 211 102 197 125Z" fill="var(--soft)" stroke="var(--outline)" strokeWidth="9" />
      <path d="M331 126 C347 104 348 76 334 53 C326 40 311 42 304 57 C296 76 301 102 315 125Z" fill="var(--soft)" stroke="var(--outline)" strokeWidth="9" />
      <path d="M174 91 C185 84 196 82 208 84" fill="none" stroke="var(--muted)" strokeWidth="6" strokeLinecap="round" />
      <path d="M338 91 C327 84 316 82 304 84" fill="none" stroke="var(--muted)" strokeWidth="6" strokeLinecap="round" />

      {/* Main body -- exact reference path */}
      <path
        d="M256 77 C183 77 128 121 128 195 C128 226 139 252 157 272 C146 294 141 319 145 348 C150 389 177 420 214 429 C230 433 244 428 256 417 C268 428 282 433 298 429 C335 420 362 389 367 348 C371 319 366 294 355 272 C373 252 384 226 384 195 C384 121 329 77 256 77Z"
        fill="var(--card)" stroke="var(--outline)" strokeWidth="9" strokeLinejoin="round"
      />

      {/* Belly -- exact reference path + ridge lines */}
      <path
        d="M185 292 C185 271 207 260 256 260 C305 260 327 271 327 292 L327 355 C327 389 300 405 256 405 C212 405 185 389 185 355Z"
        fill="var(--soft)"
      />
      <path
        d="M190 312 C226 323 286 323 322 312 M188 340 C226 351 286 351 324 340 M190 368 C226 379 286 379 322 368"
        fill="none" stroke="var(--muted)" strokeWidth="6" strokeLinecap="round"
      />

      {/* Eyes -- mood-driven, same size/position as the reference art's
          eyes (rx28 ry31 + r8 highlight when at rest) */}
      <g transform="translate(201,205)">{eye}</g>
      <g transform="translate(311,205)">{eye}</g>
      {m.brow && (
        <>
          <path d="M177 176 Q193 166 207 174" stroke="var(--ink)" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M305 174 Q319 166 335 176" stroke="var(--ink)" strokeWidth="6" fill="none" strokeLinecap="round" />
        </>
      )}

      {/* Cheeks -- exact reference ellipses */}
      <ellipse cx="169" cy="247" rx="22" ry="11" transform="rotate(-8 169 247)" fill="var(--accent)" opacity="0.75" />
      <ellipse cx="343" cy="247" rx="22" ry="11" transform="rotate(8 343 247)" fill="var(--accent)" opacity="0.75" />

      {/* Nose -- exact reference dots (static) */}
      <circle cx="248" cy="233" r="3" fill="var(--ink)" />
      <circle cx="264" cy="233" r="3" fill="var(--ink)" />

      {/* Mouth -- mood-driven; "idle"/"studying" use the reference's exact path */}
      <path d={m.mouth} stroke="var(--outline)" strokeWidth="7" fill="none" strokeLinecap="round" />
      {m.fang && <path d="M276 242 L279 250 L283 242Z" fill="#fff" stroke="var(--outline)" strokeWidth="1.5" strokeLinejoin="round" />}

      {/* Arms -- exact reference paths */}
      <path d="M183 294 C166 298 157 311 161 325 C165 339 180 345 194 340 C204 336 209 327 206 317" fill="var(--card)" stroke="var(--outline)" strokeWidth="9" strokeLinecap="round" />
      <path d="M329 294 C346 298 355 311 351 325 C347 339 332 345 318 340 C308 336 303 327 306 317" fill="var(--card)" stroke="var(--outline)" strokeWidth="9" strokeLinecap="round" />

      {/* Feet -- exact reference paths */}
      <path d="M216 371 C204 388 203 409 211 424 C218 437 234 437 243 426 C249 418 250 405 247 390" fill="var(--card)" stroke="var(--outline)" strokeWidth="9" strokeLinecap="round" />
      <path d="M296 371 C308 388 309 409 301 424 C294 437 278 437 269 426 C263 418 262 405 265 390" fill="var(--card)" stroke="var(--outline)" strokeWidth="9" strokeLinecap="round" />

      {/* Head highlights -- exact reference ellipses */}
      <ellipse cx="223" cy="111" rx="17" ry="10" transform="rotate(28 223 111)" fill="#fff" opacity="0.85" />
      <ellipse cx="247" cy="101" rx="6" ry="5" fill="#fff" opacity="0.85" />

      {m.scroll && (
        <g transform="translate(348,330) rotate(-8)">
          <rect x="-24" y="-11" width="48" height="26" rx="12" fill="var(--soft)" stroke="var(--outline)" strokeWidth="5" />
          <path d="M -11 -2 L 11 -2 M -11 6 L 6 6" stroke="var(--outline)" strokeWidth="3.4" strokeLinecap="round" />
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
      {m.smoke && (
        <g className="sb-dragon-smoke" opacity="0.6">
          <path d="M228 258 Q212 270 222 284" fill="none" stroke="var(--muted)" strokeWidth="6" strokeLinecap="round" />
          <path d="M284 258 Q300 270 290 284" fill="none" stroke="var(--muted)" strokeWidth="6" strokeLinecap="round" />
        </g>
      )}
      {/* Flame -- a clean single teardrop silhouette (the earlier, more
          zigzagged shape read as a blob rather than fire once it was
          scaled down to the dashboard hero/header sizes). Positioned and
          scaled on this OUTER static <g>; the animation class sits on an
          INNER <g> with no transform of its own, for the same reason the
          wing mirroring above does it this way -- a CSS animation replaces
          an element's own transform attribute rather than combining with
          it, so putting both on one element would snap the flame back to
          (0,0) the instant it started licking. */}
      {m.flame && (
        <g transform="translate(256,268) scale(5.2)">
          <g className="sb-dragon-flame">
            <path d="M 0 11 C -6.5 7 -7.5 1 -3 -4.5 C -3.5 -0.5 0.5 2 0.5 2 C 0 -3 2.5 -7.5 7 -9.5 C 5 -5 9 -2 9 2.5 C 9 7 5 11 0 11Z"
              fill="#F7A23B" stroke="var(--outline)" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M 0 7.5 C -3.5 5 -4 1 -1.5 -2.5 C -1.7 -0.3 0.5 1 0.5 1 C 0.2 -2 1.7 -4.5 4 -5.5 C 3 -3.3 5 -1.5 5 1 C 5 3.5 3 7.5 0 7.5Z" fill="#FFDD73" />
          </g>
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
