import React from "react";

const A = "/landing/";

// Each feature gets one of the plush props. Dimensions are the exported
// files' real sizes so the browser can reserve space before they load.
const FEATURES = [
  { img: "prop-stopwatch", w: 395, h: 478, label: "Study timer and sessions", blurb: "Log focused sessions and watch your minutes stack up, subject by subject, so a good day actually shows up somewhere." },
  { img: "prop-pencil", w: 394, h: 485, label: "Questions and mocks", blurb: "Track questions solved, and log NEET UG (Botany, Zoology, Physics, Chemistry) and Custom mocks with auto-scoring, subject-wise breakdowns, and an AI-powered head-to-head comparison." },
  { img: "prop-notebook", w: 405, h: 288, label: "Study calendar", blurb: "Your whole month at a glance, colour-dotted and satisfyingly clickable. See the streaks build in real time." },
  { img: "prop-books", w: 406, h: 297, label: "Revision reminders", blurb: "Chapters quietly resurface before you forget them, not after. Spaced repetition without the spreadsheet." },
  { img: "spark-2", w: 178, h: 197, label: "AI insights", blurb: "Gentle, Gemini-powered nudges based only on your own study data. No generic advice, just what actually applies to you." },
  { img: "prop-trophy", w: 397, h: 375, label: "Leaderboard", blurb: "An opt-in podium of the Top 20, ranked by a fair, anti-cheat Study Score. Study with (or against) the community." },
  { img: "bunny-sit", w: 560, h: 835, head: true, label: "Mascots and themes", blurb: "Pick a buddy and a vibe, from sakura to matcha to mossy blockland, across a cozy or a cleaner Studio look. Make the grind feel like yours." },
];

export default function FeatureShowcase() {
  return (
    <section className="lp-features" id="sb-land-features">
      <div className="lp-wrap lp-features-grid">
        <div className="lp-features-lead">
          <h2 className="lp-h2">Everything your prep has been missing</h2>
          <p className="lp-lede">Seven tools, one bunny-shaped home for all of it.</p>
          <img
            className="lp-features-bunny"
            src={`${A}bunny-study.webp`}
            width="640"
            height="870"
            alt="A plush bunny taking notes next to a stack of books"
            loading="lazy"
            decoding="async"
          />
        </div>

        <ul className="lp-features-list">
          {FEATURES.map((f) => (
            <li key={f.label}>
              <div className="lp-prop" aria-hidden="true">
                <img className={f.head ? "is-head" : undefined} src={`${A}${f.img}.webp`} width={f.w} height={f.h} alt="" loading="lazy" decoding="async" />
              </div>
              <div>
                <h3>{f.label}</h3>
                <p>{f.blurb}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
