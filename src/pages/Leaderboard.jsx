import React, { useState } from "react";
import { Crown, Flame, Info, Sparkles, Medal, ChevronDown, X } from "lucide-react";
import { Card, SectionTitle, EmptyState, PersonBadge, ProgressBar, STREAK_TIERS } from "../components/ui";
import Mascot from "../components/Mascot";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { useFounderIds } from "../hooks/useFounderIds";

const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };

function PodiumSpot({ row, rank, isMe, isStudyingNow, founderIds }) {
  if (!row) return <div className="sb-podium-spot empty" />;
  return (
    <div className={`sb-podium-spot p${rank} ${isMe ? "me" : ""}`} style={{ animationDelay: `${rank * 0.08}s` }}>
      <div className="sb-podium-medal">{MEDAL[rank]}</div>
      <div className="sb-podium-avatar-wrap">
        <div className="sb-podium-avatar"><Mascot species={row.mascot} mood="happy" size={rank === 1 ? 52 : 42} ambient={false} /></div>
        {isStudyingNow && <span className="sb-lb-online-dot" title="Studying right now" />}
      </div>
      <div className="sb-podium-name">{row.display_name}{isMe && <span className="sb-lb-you-tag">You</span>}</div>
      <PersonBadge founderIds={founderIds} userId={row.user_id} streak={row.current_streak} />
      {row.current_streak > 0 && (
        <div className="sb-lb-streak"><Flame size={11} /> {row.current_streak}</div>
      )}
      <div className="sb-podium-score">{Math.round(row.study_score).toLocaleString()}<span>pts</span></div>
      <div className="sb-podium-bar" />
    </div>
  );
}

function ScoreRow({ row, rank, isMe, isStudyingNow, founderIds }) {
  return (
    <div className={`sb-lb-row ${isMe ? "me" : ""}`} style={{ animationDelay: `${Math.min(rank, 14) * 0.03}s` }}>
      <div className="sb-lb-rank">#{rank}</div>
      <div className="sb-lb-avatar-wrap">
        <div className="sb-lb-avatar"><Mascot species={row.mascot} mood="happy" size={34} ambient={false} /></div>
        {isStudyingNow && <span className="sb-lb-online-dot" title="Studying right now" />}
      </div>
      <div className="sb-lb-who">
        <div className="sb-lb-name">{row.display_name}{isMe && <span className="sb-lb-you-tag">You</span>}<PersonBadge founderIds={founderIds} userId={row.user_id} streak={row.current_streak} /></div>
        {row.current_streak > 0 && (
          <div className="sb-lb-streak"><Flame size={11} /> {row.current_streak}-day streak</div>
        )}
      </div>
      <div className="sb-lb-score">
        {Math.round(row.study_score).toLocaleString()}
        <span>pts</span>
      </div>
    </div>
  );
}

function SkeletonRow({ i }) {
  return <div className="sb-lb-row sb-lb-skeleton" style={{ animationDelay: `${i * 0.05}s` }} />;
}

// The old page had two always-on cards ("Fair & anti-cheat scoring" and
// "Streak tiers") sitting above the podium, each with its own toggle. Even
// collapsed, that's two full card shells (border + shadow + padding) of
// dead weight before you reach the actual leaderboard. This merges both
// into a single optional drawer, toggled from the hero, that's simply not
// rendered at all when closed — and switches between the two write-ups via
// tabs when open, so reading either one costs the same one tap it used to.
function InfoDrawer({ tab, onTab, onClose, tierRows }) {
  return (
    <Card className="sb-lb-info-panel" washi>
      <div className="sb-lb-info-head">
        <SectionTitle icon={Info}>Leaderboard info</SectionTitle>
        <button className="sb-lb-info-close" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>
      <div className="sb-lb-info-tabs">
        <button className={`sb-lb-info-tab ${tab === "scoring" ? "active" : ""}`} onClick={() => onTab("scoring")}>
          <Sparkles size={13} /> Scoring
        </button>
        <button className={`sb-lb-info-tab ${tab === "tiers" ? "active" : ""}`} onClick={() => onTab("tiers")}>
          <Flame size={13} /> Streak tiers
        </button>
      </div>
      {tab === "scoring" ? (
        <p className="sb-lb-info-text">
          Your Study Score looks at your last 30 days — genuine study days, completed focus sessions,
          minutes actually spent (timer-verified time counts more than self-logged time), questions
          practiced, mocks taken, and chapters finished — plus a bonus for your current streak. Every
          signal is capped per day, so logging one big fake session (or a hundred tiny ones) never earns
          more than a real day's worth of points. Idle or abandoned timers don't count — only sessions
          that actually finish.
        </p>
      ) : (
        <div className="sb-tier-list">
          {tierRows.map((tier) => (
            <div className="sb-tier-row" key={tier.className}>
              <span className={`sb-streak-badge ${tier.className}`}>🔥 {tier.label}</span>
              <span className="sb-tier-days">{tier.range}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function LeaderboardPage(p) {
  const { top, myRank, amInTop, pointsToTop20, loading, error, refetch } = useLeaderboard();
  const founderIds = useFounderIds();
  const [showInfo, setShowInfo] = useState(false);
  const [infoTab, setInfoTab] = useState("scoring");
  // Ascending (Member first) for the legend — STREAK_TIERS itself is ordered
  // highest-min-first since that's what getStreakTier needs to walk down.
  // Each tier's upper bound is just the next tier's min minus 1; the top
  // tier (index 0 here, after reversing) has no ceiling.
  const tierRows = [...STREAK_TIERS].reverse().map((tier, i, arr) => {
    const next = arr[i + 1];
    return { ...tier, range: next ? `${tier.min}–${next.min - 1} days` : `${tier.min}+ days` };
  });
  const userId = p.userId;
  const studyingIds = p.studyingIds || new Set();

  // Only meaningful when pointsToTop20 is non-null, which the hook only
  // ever sets once both myRank and a full 20-row top list exist — so
  // top[19] is safe to read here without an extra guard.
  const top20Pct = pointsToTop20 != null
    ? Math.min(100, (myRank.study_score / top[19].study_score) * 100)
    : null;

  return (
    <div className="sb-page">
      <Card className="sb-hero" washi>
        <div className="sb-hero-copy">
          <div className="sb-hero-greet"><Crown size={22} style={{ marginRight: 6, verticalAlign: "-3px" }} />Leaderboard</div>
          <div className="sb-hero-line">Top 20 study buddies, ranked by Study Score ✨</div>
        </div>
        <div className="sb-lb-hero-actions">
          <div className="sb-lb-live-badge"><span className="sb-lb-live-dot" />Live</div>
          <button
            className={`sb-lb-info-btn ${showInfo ? "active" : ""}`}
            onClick={() => setShowInfo((v) => !v)}
            aria-expanded={showInfo}
          >
            <Info size={13} /> Info <ChevronDown size={12} />
          </button>
        </div>
      </Card>

      {showInfo && (
        <InfoDrawer tab={infoTab} onTab={setInfoTab} onClose={() => setShowInfo(false)} tierRows={tierRows} />
      )}

      {error && (
        <Card>
          <p className="sb-muted" style={{ fontSize: 12.5, marginBottom: 8 }}>Couldn't load the leaderboard right now — try again in a moment.</p>
          <button className="sb-chip small" onClick={refetch}>Retry</button>
        </Card>
      )}

      {loading ? (
        <Card washi>
          <SectionTitle icon={Crown}>Top 20</SectionTitle>
          <div className="sb-lb-list">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} i={i} />)}
          </div>
        </Card>
      ) : top.length === 0 ? (
        <Card washi>
          <SectionTitle icon={Crown}>Top 20</SectionTitle>
          <EmptyState mascot={p.mascot} mood="idle" text="No scores yet" sub="Be the first to log a study session and claim the crown 👑" />
        </Card>
      ) : (
        <>
          {top.length >= 2 && (
            <Card className="sb-podium-card" washi>
              <div className="sb-podium">
                <PodiumSpot row={top[1]} rank={2} isMe={top[1]?.user_id === userId} isStudyingNow={studyingIds.has(top[1]?.user_id)} founderIds={founderIds} />
                <PodiumSpot row={top[0]} rank={1} isMe={top[0]?.user_id === userId} isStudyingNow={studyingIds.has(top[0]?.user_id)} founderIds={founderIds} />
                <PodiumSpot row={top[2]} rank={3} isMe={top[2]?.user_id === userId} isStudyingNow={studyingIds.has(top[2]?.user_id)} founderIds={founderIds} />
              </div>
            </Card>
          )}

          <Card washi>
            <SectionTitle icon={Medal}>{top.length > 3 ? "Rest of the Top 20" : "Top 20"}</SectionTitle>
            <div className="sb-lb-list">
              {(top.length > 3 ? top.slice(3) : top).map((row, i) => {
                const rank = top.length > 3 ? i + 4 : i + 1;
                return (
                  <ScoreRow
                    key={row.user_id}
                    row={row}
                    rank={rank}
                    isMe={row.user_id === userId}
                    isStudyingNow={studyingIds.has(row.user_id)}
                    founderIds={founderIds}
                  />
                );
              })}
            </div>
          </Card>
        </>
      )}

      {!loading && !amInTop && myRank && (
        <Card className="sb-lb-you-card">
          <SectionTitle icon={Sparkles}>Your rank</SectionTitle>
          <div className="sb-lb-you-row">
            <div className="sb-lb-avatar-wrap">
              <div className="sb-lb-avatar"><Mascot species={p.mascot} mood="happy" size={40} /></div>
            </div>
            <div className="sb-lb-who">
              <div className="sb-lb-name">#{myRank.rank.toLocaleString()} <span className="sb-muted small">of {myRank.total_users.toLocaleString()}</span><PersonBadge founderIds={founderIds} userId={userId} streak={myRank.current_streak} /></div>
              {myRank.current_streak > 0 && (
                <div className="sb-lb-streak"><Flame size={11} /> {myRank.current_streak}-day streak</div>
              )}
            </div>
            <div className="sb-lb-score">
              {Math.round(myRank.study_score).toLocaleString()}
              <span>pts</span>
            </div>
          </div>
          {pointsToTop20 != null && (
            <div className="sb-lb-you-progress">
              <div className="sb-lb-you-progress-label">
                <span>Progress to Top 20</span>
                <strong>{top20Pct >= 100 ? "Almost there" : `${Math.round(top20Pct)}%`}</strong>
              </div>
              <ProgressBar pct={top20Pct} />
              <p className="sb-muted" style={{ fontSize: 12, marginTop: 10 }}>
                {pointsToTop20 > 0
                  ? `Just ${Math.ceil(pointsToTop20).toLocaleString()} points from cracking the Top 20 — keep going! 🐾`
                  : "You're right on the edge of the Top 20 — one more session could do it!"}
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
