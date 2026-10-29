import React from "react";
import { Lock, Ban, Download } from "lucide-react";

const ITEMS = [
  { icon: Lock, title: "Private, always", blurb: "Your study data lives in your account only. The one exception is the opt-in Leaderboard: enable it and your name, mascot, score, and streak become visible to others. Everything else stays private." },
  { icon: Ban, title: "Never sold, never advertised against", blurb: "This app doesn't have advertisers to sell data to in the first place, and never will." },
  { icon: Download, title: "Exportable anytime", blurb: "A full JSON backup is one click away in Settings, whenever you want it. No asking, no waiting." },
];

export default function TrustSection() {
  return (
    <section className="lp-trust">
      <div className="lp-wrap">
        <h2 className="lp-h2">Nothing sketchy, promise</h2>
        <ul className="lp-trust-grid">
          {ITEMS.map((c) => (
            <li className="lp-trust-item" key={c.title}>
              <span className="lp-trust-icon"><c.icon size={20} aria-hidden="true" /></span>
              <h3>{c.title}</h3>
              <p>{c.blurb}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
