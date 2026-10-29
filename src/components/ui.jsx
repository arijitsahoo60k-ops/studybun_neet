import React from "react";
import Mascot from "./Mascot";
import { THEMES } from "../data/themes";
import { MOTIFS } from "./decor/Motifs";
import { useRoleIds } from "../hooks/useRoleIds";

export const Card = ({ children, className = "", style, onClick, washi = false, paper = false, glass = false }) => (
  <div className={`sb-card ${glass ? "sb-card-glass" : ""} ${paper ? "sb-paper" : ""} ${className}`} style={style} onClick={onClick}>
    {washi && <span className="sb-washi" aria-hidden="true" />}
    {children}
  </div>
);

export const Btn = ({ children, variant = "primary", onClick, style, type = "button", disabled }) => (
  <button type={type} disabled={disabled} className={`sb-btn sb-btn-${variant}`} onClick={onClick} style={style}>{children}</button>
);

// Small "Founder" pill — shown next to a name wherever founderIds has that
// user_id (Leaderboard rows/podium, Community posts/replies/chat). Purely
// cosmetic; see useFounderIds.
export const FounderBadge = () => (
  <span className="sb-founder-badge" title="StudyBun founder">👑 Founder</span>
);

// Small "Mod" pill — role = 'moderator' in user_roles. Sits between
// Founder and Member: a mod NEVER shows the Member pill, even on a long
// streak, because the role is the more informative thing to say about
// them. Cosmetic only; their actual powers are RLS-enforced.
export const ModBadge = () => (
  <span className="sb-mod-badge" title="StudyBun moderator">⚡ Mod</span>
);

// Single source of truth for the streak threshold — used here and by
// useStreakMemberIds.js's query. Change it in exactly one place.
export const MEMBER_STREAK_MIN = 3;

// The streak ladder. Six named tiers instead of one flat "Member" label —
// a 3-day streak and a 100-day streak are not the same achievement and
// shouldn't wear the same pill. Highest min first: getStreakTier walks
// down until it finds a tier the streak clears. Add a tier here (and a
// matching .sb-streak-<name> rule in GlobalStyle.jsx) to add a rung.
export const STREAK_TIERS = [
  { min: 100, label: "Immortal", className: "sb-streak-immortal" },
  { min: 60, label: "Legend", className: "sb-streak-legend" },
  { min: 30, label: "Titan", className: "sb-streak-titan" },
  { min: 14, label: "Warrior", className: "sb-streak-warrior" },
  { min: 7, label: "Grinder", className: "sb-streak-grinder" },
  { min: MEMBER_STREAK_MIN, label: "Member", className: "sb-streak-member" },
];

export function getStreakTier(streak) {
  if (typeof streak !== "number") return null;
  return STREAK_TIERS.find((t) => streak >= t.min) || null;
}

// The streak pill — shown next to a name wherever founderIds does NOT
// have that user_id but they have a 3+ day real-activity streak (see
// useStreakMemberIds). Same spots as FounderBadge: Leaderboard
// podium/rows/my-rank, Community posts/replies, Community chat.
//
// Which tier renders (and what it's called/colored) depends on the streak
// length itself — see STREAK_TIERS above. `streak` is always a real
// number here (PersonBadge never renders this without one); the fallback
// only guards against a stray direct call.
export const MemberBadge = ({ streak }) => {
  const tier = getStreakTier(streak) || STREAK_TIERS[STREAK_TIERS.length - 1];
  return (
    <span className={`sb-streak-badge ${tier.className}`} title={`${streak}-day streak`}>
      🔥 {tier.label}
    </span>
  );
};

// Single source of truth for "which pill (if any) goes next to this
// user_id". Handles both call shapes: pass `memberIds` (a Map of
// user_id -> current_streak, for Community posts/replies/chat) OR
// `streak` (a number, for Leaderboard rows which already carry
// current_streak inline and don't need a separate query). Either way,
// MemberBadge gets the real day count to render.
//
// Precedence is Founder > Mod > Member — exactly one pill ever renders,
// and a role always beats a streak.
//
// Founder/mod ids come from the shared role snapshot (useRoleIds) rather
// than props. The `founderIds` prop is still accepted and still wins when
// passed, so every existing call site keeps working untouched; new call
// sites don't need to thread anything. Both lists resolve from one cached
// RPC per page load no matter how many badges are on screen.
//
// Renders nothing at all — not even a guess — until the roles have
// actually loaded (they start as `null`), which is what stops a founder
// or a mod from seeing a stray Member badge flash on their own name
// before their role comes back.
export const PersonBadge = ({ founderIds, moderatorIds, memberIds, userId, streak }) => {
  const roles = useRoleIds();
  const founders = founderIds || roles.founderIds;
  const mods = moderatorIds || roles.moderatorIds;
  if (!userId || !founders || !mods) return null; // roles still loading — show nothing, not a guess
  if (founders.has(userId)) return <FounderBadge />;
  if (mods.has(userId)) return <ModBadge />;
  if (memberIds !== undefined) {
    if (!memberIds) return null; // memberIds query also still loading
    return memberIds.has(userId) ? <MemberBadge streak={memberIds.get(userId)} /> : null;
  }
  return typeof streak === "number" && streak >= MEMBER_STREAK_MIN ? <MemberBadge streak={streak} /> : null;
};

export const ProgressBar = ({ pct, color, paw = true }) => {
  const clamped = Math.min(100, Math.max(0, pct || 0));
  return (
    <div className="sb-progress-track">
      <div className="sb-progress-fill" style={{ width: `${clamped}%`, background: color || "var(--accent)" }} />
      {paw && clamped > 2 && (
        <span className="sb-progress-paw" style={{ left: `${clamped}%` }} aria-hidden="true">🐾</span>
      )}
    </div>
  );
};

export function ProgressRing({ pct, size = 84, stroke = 10, color, paw = true }) {
  const clamped = Math.min(100, Math.max(0, pct || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const angle = (clamped / 100) * 2 * Math.PI - Math.PI / 2;
  const px = size / 2 + r * Math.cos(angle);
  const py = size / 2 + r * Math.sin(angle);
  return (
    <svg width={size} height={size} style={{ overflow: "visible" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--soft)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color || "var(--accent)"} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c - (clamped / 100) * c} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s ease" }} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontFamily="var(--font-display)" fontSize={size * 0.22} fill="var(--ink)">{Math.round(clamped)}%</text>
      {paw && clamped > 3 && (
        <text x={px} y={py} textAnchor="middle" dy="0.35em" fontSize={size * 0.16} style={{ transition: "all .6s ease" }}>🐾</text>
      )}
    </svg>
  );
}

export const EmptyState = ({ mascot = "bunny", mood = "idle", text, sub }) => (
  <div className="sb-empty">
    <Mascot species={mascot} mood={mood} size={64} />
    <p className="sb-empty-text">{text}</p>
    {sub && <p className="sb-empty-sub">{sub}</p>}
  </div>
);

export const SectionTitle = ({ icon: Icon, children, right }) => (
  <div className="sb-section-title">
    <span>{Icon && <span className="sb-icon-badge"><Icon size={16} /></span>} {children}</span>
    {right}
  </div>
);

/* Small illustrated layer that drifts behind every page. Each theme supplies
   its own `decor` list (see src/data/themes.js) of 2-4 motif keys resolved
   against the MOTIFS library in ./decor/Motifs — actual different artwork
   per theme (a strawberry, a paw print, a pixel tree...), not one repeated
   emoji recolored. Position, rotation and depth below are fixed per slot
   (no Math.random) so the backdrop never reshuffles on an unrelated
   re-render, only when the theme itself changes. */
const DECOR_POS = [
  { top: "6%", left: "3%", size: 40, rot: -12, depth: "far" },
  { top: "28%", left: "1.5%", size: 26, rot: 8, depth: "near" },
  { top: "62%", left: "3.5%", size: 32, rot: -6, depth: "far" },
  { bottom: "6%", left: "9%", size: 24, rot: 14, depth: "near" },
  { top: "12%", right: "3%", size: 30, rot: 10, depth: "near" },
  { top: "42%", right: "1.5%", size: 38, rot: -9, depth: "far" },
  { top: "72%", right: "4.5%", size: 26, rot: 6, depth: "near" },
  { bottom: "10%", right: "11%", size: 34, rot: -14, depth: "far" },
];

export function DecorLayer({ theme }) {
  if (!theme) return null;
  const motifKeys = theme.decor && theme.decor.length ? theme.decor : ["sparkleStar"];
  return (
    <div className="sb-decor-layer">
      {DECOR_POS.map((pos, i) => {
        const Motif = MOTIFS[motifKeys[i % motifKeys.length]] || MOTIFS.sparkleStar;
        const { size, rot, depth, ...place } = pos;
        return (
          <span
            key={i}
            className={`sb-decor sb-decor-${depth}`}
            style={{
              ...place,
              width: size,
              height: size,
              animationDelay: `${i * 0.6}s`,
              "--sb-decor-rot": `${rot}deg`,
            }}
          >
            <Motif />
          </span>
        );
      })}
    </div>
  );
}

export function ThemePicker({ value, onChange, compact = false }) {
  return (
    <div className={`sb-theme-picker ${compact ? "compact" : ""}`}>
      {Object.entries(THEMES).map(([name, t]) => (
        <button key={name} type="button" className={`sb-theme-chip ${value === name ? "active" : ""}`}
          style={{ background: value === name ? t.soft : "var(--card)", borderColor: t.outline, "--swatch-accent": t.accent, "--swatch-soft": t.soft, "--swatch-ink": t.ink }}
          onClick={() => onChange(name)} title={name}>
          <span className="sb-theme-chip-swatch" style={{ background: t.accent, borderColor: t.outline }} />
          {!compact && name}
        </button>
      ))}
    </div>
  );
}

export function Confetti({ type = "confetti", theme }) {
  if (type === "petals") {
    const pieces = Array.from({ length: 28 });
    return (
      <div className="sb-confetti sb-confetti-petals">
        {pieces.map((_, i) => (
          <span
            key={i}
            className="sb-confetti-emoji"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 0.5}s`,
              animationDuration: `${1.6 + Math.random() * 0.8}s`,
              fontSize: `${14 + Math.random() * 16}px`,
            }}
          >
            {theme?.emoji || "✨"}
          </span>
        ))}
      </div>
    );
  }
  const pieces = Array.from({ length: 24 });
  return (
    <div className="sb-confetti">
      {pieces.map((_, i) => (
        <span key={i} style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 0.3}s`, background: ["var(--accent)", "var(--accent2)", "#FFD98E", "#B8E6C1"][i % 4] }} />
      ))}
    </div>
  );
}

export function LoadingScreen({ mascot = "bunny", message = "Preparing your study desk..." }) {
  return (
    <div className="sb-loading">
      <Mascot species={mascot} mood="studying" size={90} />
      <p>{message}</p>
    </div>
  );
}
