import React, { useState } from "react";
import { ChevronDown, Lock, Download, Ban } from "lucide-react";
import Mascot from "./Mascot";
import ScratchReveal from "./ScratchReveal";

const FEATURES = [
  { emoji: "⏱️", label: "Study timer & sessions", blurb: "Log focused sessions and watch your minutes stack up, subject by subject." },
  { emoji: "✏️", label: "Questions & mocks", blurb: "Track questions solved and mock scores so your progress isn't just a feeling." },
  { emoji: "🗓️", label: "Study calendar", blurb: "Your whole month at a glance, colour-dotted and satisfyingly clickable." },
  { emoji: "🔁", label: "Revision reminders", blurb: "Chapters quietly resurface before you forget them, not after." },
  { emoji: "🧠", label: "AI insights", blurb: "Gentle, Gemini-powered nudges based only on your own study data." },
  { emoji: "🎨", label: "Mascots & themes", blurb: "Pick a buddy and a vibe — sakura, matcha, mossy blockland, and more." },
];

const FAQS = [
  {
    q: "Is StudyBun actually free?",
    a: "Yep — 100% free, no ads, no premium tier hiding behind a paywall. Just a little study buddy.",
  },
  {
    q: "Why do I need to sign in at all?",
    a: "So your streaks, sessions and badges live somewhere safe and sync across every device you open StudyBun on — instead of living only in one browser tab that could get wiped.",
  },
  {
    q: "Where does my data actually go?",
    a: "It's saved in a private database (Supabase) under your account only. Nothing here is public, sold, or handed to advertisers — this app doesn't even have any.",
  },
  {
    q: "What happens when I use the AI features?",
    a: "AI Insights and the Study Buddy chat send the relevant bits of your study data to Google's Gemini API to write your tips — and only when you actually open those features, never in the background.",
  },
  {
    q: "Can I get my data out, or delete it?",
    a: "Settings → Export gives you a full JSON backup anytime, no asking needed. Want your account wiped instead? Reach out to me (see the last question below) and I'll delete it by hand.",
  },
  {
    q: "Who's actually behind this?",
    a: "Built for NEET aspirants building the study tool he wished existed. Bugs, ideas and gentle roasting are all welcome 🐰",
  },
  {
    q: "How do I actually reach you?",
    custom: "scratch",
    a: "Scratch the little card below to reveal it — kept it hidden from bots that scrape pages for emails to spam.",
  },
];

function FaqItem({ q, a, custom, open, onToggle }) {
  return (
    <div className={`sb-faq-item${open ? " open" : ""}`}>
      <button type="button" className="sb-faq-q" onClick={onToggle} aria-expanded={open}>
        <span>{q}</span>
        <ChevronDown size={15} className="sb-faq-chevron" />
      </button>
      {open && (
        <div className="sb-faq-a">
          <p>{a}</p>
          {custom === "scratch" && <ScratchReveal />}
        </div>
      )}
    </div>
  );
}

export default function AuthInfo() {
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <div className="sb-auth-info">
      <div className="sb-auth-info-hero">
        <Mascot species="bunny" mood="happy" size={56} hopLoop />
        <div>
          <div className="sb-auth-info-title">What's StudyBun NEET? 🌸</div>
          <p className="sb-auth-info-sub">A cozy little companion for NEET prep — timers, trackers, and a mascot rooting for you, wrapped in a kawaii bow.</p>
        </div>
      </div>

      <div className="sb-auth-features">
        {FEATURES.map((f, i) => (
          <div className="sb-auth-feature" key={f.label} style={{ animationDelay: `${0.25 + i * 0.06}s` }}>
            <span className="sb-auth-feature-emoji">{f.emoji}</span>
            <div>
              <div className="sb-auth-feature-label">{f.label}</div>
              <div className="sb-auth-feature-blurb">{f.blurb}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="sb-auth-data-note">
        <span className="sb-auth-data-note-icon"><Lock size={15} /></span>
        <div>
          <div className="sb-auth-data-note-title">Your data, in plain kawaii terms</div>
          <div className="sb-auth-data-note-row"><Lock size={11} /> Private to your account, always</div>
          <div className="sb-auth-data-note-row"><Ban size={11} /> Never sold, never advertised against</div>
          <div className="sb-auth-data-note-row"><Download size={11} /> Exportable as JSON, anytime you like</div>
        </div>
      </div>

      <div className="sb-auth-faq">
        <div className="sb-auth-faq-title">Little FAQ 🎀</div>
        {FAQS.map((f, i) => (
          <FaqItem key={f.q} q={f.q} a={f.a} custom={f.custom} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? -1 : i)} />
        ))}
      </div>
    </div>
  );
}
