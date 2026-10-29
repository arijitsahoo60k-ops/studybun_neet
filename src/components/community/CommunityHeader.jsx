import React from "react";
import { Users2, CheckCircle2 } from "lucide-react";
import { Card } from "../ui";

/**
 * Real numbers only — "active now" comes from the app's existing Realtime
 * Presence channel (studyingIds, already shared with Leaderboard), and
 * "checked in today" is a genuine count of today's accountability_goals
 * rows. If either is zero, it just shows zero; nothing here is fabricated.
 */
export default function CommunityHeader({ activeNowCount, checkedInTodayCount }) {
  return (
    <Card className="sb-hero" washi>
      <div className="sb-hero-copy">
        <div className="sb-hero-greet">Community</div>
        <div className="sb-hero-line">Study together. Stay accountable.</div>
      </div>
      <div className="sb-community-stats">
        <div className="sb-community-stat">
          <Users2 size={15} />
          <span>{activeNowCount} studying now</span>
        </div>
        <div className="sb-community-stat">
          <CheckCircle2 size={15} />
          <span>{checkedInTodayCount} checked in today</span>
        </div>
      </div>
    </Card>
  );
}
