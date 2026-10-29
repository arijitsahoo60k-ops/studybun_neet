import React, { useState } from "react";
import { Trophy, Lock, CheckCircle2, Info } from "lucide-react";
import { Card, SectionTitle, ProgressBar } from "../components/ui";
import { formatISTTimestamp } from "../lib/dateIST";

const TIER_ORDER = ["Bronze", "Silver", "Gold", "Platinum", "Legendary", "Special"];

const TIER_INFO = {
  Bronze: { color: "#c78a52", blurb: "Your first steps — usually a session or two away." },
  Silver: { color: "#9aa5b1", blurb: "A couple of real weeks of showing up." },
  Gold: { color: "#d4af37", blurb: "A month-plus of genuine discipline." },
  Platinum: { color: "#7fb3c9", blurb: "Multiple months of sustained grind." },
  Legendary: { color: "#a06cd5", blurb: "6–12 months of daily use. The hardest badges in StudyBun — most people never see these unlock." },
  Special: { color: "#e07a9e", blurb: "Not about grinding a number — earned by a specific moment in your journey." },
};

function fmtDate(iso) {
  if (!iso) return "";
  return formatISTTimestamp(iso, { day: "numeric", month: "short", year: "numeric" });
}

export default function AchievementsPage(p) {
  const [tier, setTier] = useState("All");
  const defs = p.achievementDefs;
  const unlockedIds = new Set(p.unlockedAchievements.map((a) => a.id));
  const unlockDates = {};
  (p.achievementRows || []).forEach((r) => { unlockDates[r.achievement_key] = r.unlocked_at; });

  const tiers = ["All", ...TIER_ORDER];
  const visible = tier === "All" ? defs : defs.filter((a) => a.tier === tier);

  return (
    <div className="sb-page">
      <Card>
        <SectionTitle icon={Trophy}>Achievements ({p.unlockedAchievements.length}/{defs.length})</SectionTitle>
        <ProgressBar pct={(p.unlockedAchievements.length / defs.length) * 100} />
      </Card>

      <Card>
        <SectionTitle icon={Info}>How this works</SectionTitle>
        <p className="sb-muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
          Every badge below shows exactly what to achieve and how to unlock it — nothing here is a mystery.
          Badges get harder as the tier goes up: Bronze is your first session, Legendary asks for months of
          genuine, near-daily use. Streak-based badges track your <strong>longest-ever</strong> streak, so once
          you've earned one it's yours for good, even if a later day gets missed.
        </p>
        <div className="sb-chip-row" style={{ marginTop: 12 }}>
          {TIER_ORDER.map((t) => (
            <span key={t} className="sb-chip small" style={{ background: "transparent", cursor: "default" }}>
              <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 999, background: TIER_INFO[t].color, marginRight: 6 }} />
              {t}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <div className="sb-chip-row">
          {tiers.map((t) => (
            <button key={t} className={`sb-chip small ${tier === t ? "active" : ""}`} onClick={() => setTier(t)}>
              {t}
            </button>
          ))}
        </div>
        {tier !== "All" && <p className="sb-muted" style={{ fontSize: 12, marginTop: 10 }}>{TIER_INFO[tier].blurb}</p>}
      </Card>

      <div className="sb-achv-grid">
        {visible.map((a) => {
          const unlocked = unlockedIds.has(a.id);
          const pct = a.target ? Math.min(100, ((a.current || 0) / a.target) * 100) : 0;
          return (
            <Card key={a.id} className={`sb-achv-card ${unlocked ? "unlocked" : "locked"}`}>
              <div className="sb-achv-top">
                <div className="sb-achv-emoji">{a.emoji}</div>
                <div className="sb-achv-heading">
                  <div className="sb-achv-label">{a.label}</div>
                  <span className="sb-achv-tier" style={{ color: TIER_INFO[a.tier]?.color }}>{a.tier}</span>
                </div>
                {unlocked ? <CheckCircle2 size={18} className="sb-achv-status-icon unlocked" /> : <Lock size={16} className="sb-achv-status-icon" />}
              </div>

              <p className="sb-achv-goal"><strong>Goal:</strong> {a.goal}</p>

              {unlocked ? (
                <div className="sb-achv-unlocked-row">
                  <CheckCircle2 size={13} />
                  <span>Unlocked{unlockDates[a.id] ? ` · ${fmtDate(unlockDates[a.id])}` : ""}</span>
                </div>
              ) : (
                <>
                  <p className="sb-achv-howto">{a.howTo}</p>
                  {a.target > 1 && (
                    <>
                      <ProgressBar pct={pct} paw={false} />
                      <div className="sb-achv-progress-label">{Math.min(a.current || 0, a.target)} / {a.target}</div>
                    </>
                  )}
                </>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
