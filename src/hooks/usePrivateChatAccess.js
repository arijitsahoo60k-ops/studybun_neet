import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

/** Just "does this person have any reason to see the Private Chats nav
 * item" — a plain member only once they've been added to at least one
 * group, a founder always. Deliberately its own tiny hook rather than
 * reusing usePrivateChannels: Community.jsx needs this answer immediately
 * on every render (to decide whether to show the nav pill at all) without
 * paying for the full channel list + member-name resolution that hook
 * does, most of which only matters once the private page is actually
 * opened (and it's lazy-loaded, so that cost is deferred until then).
 * Founder status itself is already known to the caller (useFounderIds /
 * useCommunityModeration's isModerator) — this only answers the
 * membership-count half of the question. */
export function usePrivateChatAccess() {
  const { user } = useAuth();
  const userId = user?.id;
  const [hasMembership, setHasMembership] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!userId) { setHasMembership(false); setLoading(false); return; }

    supabase
      .from("private_channel_members")
      .select("channel_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .then(({ count }) => {
        if (mounted) { setHasMembership((count || 0) > 0); setLoading(false); }
      });

    const rt = supabase
      .channel(`rt:private_chat_access:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "private_channel_members", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") setHasMembership(true);
          // A DELETE might have been the user's last membership, or one of
          // several — re-check rather than assuming false.
          if (payload.eventType === "DELETE") {
            supabase
              .from("private_channel_members")
              .select("channel_id", { count: "exact", head: true })
              .eq("user_id", userId)
              .then(({ count }) => { if (mounted) setHasMembership((count || 0) > 0); });
          }
        }
      )
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(rt); };
  }, [userId]);

  return { hasMembership, loading };
}
