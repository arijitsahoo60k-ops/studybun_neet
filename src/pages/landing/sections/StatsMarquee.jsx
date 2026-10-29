import React from "react";

const STATS = [
  "🐰 6 mascots to choose from",
  "🎨 16 aesthetic themes",
  "⏱️ Unlimited study sessions",
  "🧠 AI-powered insights",
  "🔁 Smart revision reminders",
  "👑 Opt-in leaderboard",
  "💸 100% free, no premium tier",
  "📦 Your data, exportable anytime",
];

export default function StatsMarquee() {
  const loop = [...STATS, ...STATS];
  return (
    <div className="sb-land-marquee">
      <div className="sb-land-marquee-track">
        {loop.map((s, i) => (
          <span className="sb-land-stat-chip" key={i}>{s}</span>
        ))}
      </div>
    </div>
  );
}
