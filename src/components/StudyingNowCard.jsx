import React, { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { Card, SectionTitle, EmptyState } from "./ui";
import Mascot from "./Mascot";
import { fetchProfilesByIds } from "../lib/communityProfiles";

// Only this many bubbles render before the rest collapse into a single
// "+N more" chip -- keeps the card's height sane during exam season when a
// lot of people are studying at once, instead of the layout growing
// unbounded.
const MAX_VISIBLE = 12;

/**
 * "Studying Now" card for the Focus Timer page. `studyingIds` is the same
 * ephemeral Realtime Presence set already shared with Leaderboard/Community
 * (see useStudyPresence) -- a bare Set of user ids, no names. Presence
 * intentionally never broadcasts a name/mascot itself (that would mean every
 * client trusting whatever the *other* client claims about itself), so
 * names are resolved the same trusted way the rest of Community does: a
 * batched get_community_profiles RPC call, cached client-side per user id
 * so re-renders (the set changes constantly as people start/stop) don't
 * re-fetch anyone already resolved.
 */
export default function StudyingNowCard({ studyingIds, userId, bare = false }) {
  const ids = Array.from(studyingIds || []);
  const idsKey = [...ids].sort().join(",");

  const [profiles, setProfiles] = useState(() => new Map());
  const cacheRef = useRef(new Map());

  useEffect(() => {
    const missing = ids.filter((id) => !cacheRef.current.has(id));
    if (!missing.length) return;
    let cancelled = false;
    fetchProfilesByIds(missing).then((fetched) => {
      if (cancelled) return;
      fetched.forEach((profile, id) => cacheRef.current.set(id, profile));
      // Anyone the RPC didn't return (e.g. a since-deleted account) still
      // gets cached as null so we don't refetch them forever.
      missing.forEach((id) => { if (!cacheRef.current.has(id)) cacheRef.current.set(id, null); });
      setProfiles(new Map(cacheRef.current));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // Self always sorts first, then alphabetically by name so the list
  // doesn't visibly reshuffle every time presence syncs.
  const people = ids
    .map((id) => ({ id, profile: profiles.get(id) }))
    .sort((a, b) => {
      if (a.id === userId) return -1;
      if (b.id === userId) return 1;
      return (a.profile?.name || "").localeCompare(b.profile?.name || "");
    });

  const visible = people.slice(0, MAX_VISIBLE);
  const overflow = people.length - visible.length;

  const content = (
    <>
      <SectionTitle icon={Users} right={<span className="sb-studying-live-badge"><span className="sb-studying-live-dot" />{people.length} live</span>}>
        Studying Now
      </SectionTitle>

      {people.length === 0 ? (
        <EmptyState mood="idle" text="No one's studying right now" sub="Start your session above and be the first bubble here!" />
      ) : (
        <div className="sb-studying-bubbles">
          {visible.map(({ id, profile }) => (
            <div key={id} className={`sb-studying-bubble ${id === userId ? "me" : ""}`}>
              <span className="sb-studying-bubble-ring">
                <Mascot species={profile?.mascot || "bunny"} mood="studying" size={38} ambient={false} />
              </span>
              <span className="sb-studying-bubble-name">
                {id === userId ? "You" : (profile?.name || "Study Buddy")}
              </span>
            </div>
          ))}
          {overflow > 0 && (
            <div className="sb-studying-bubble sb-studying-overflow">
              <span className="sb-studying-bubble-ring sb-studying-overflow-ring">+{overflow}</span>
              <span className="sb-studying-bubble-name">more</span>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (bare) return content;
  return <Card className="sb-studying-now">{content}</Card>;
}
