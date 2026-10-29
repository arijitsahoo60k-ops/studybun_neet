import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { fetchProfilesByIds } from "../lib/communityProfiles";

const CHANNEL_SELECT = "id, name, created_by, created_at, updated_at, last_message_at, last_message_preview, last_message_user_id";

/** Private Chats — the list of channels the current user can see (their own
 * memberships, or every channel at all if they're a founder — see the RLS
 * policies in migration_private_chat.sql, this hook never has to know
 * which case it is), plus create/rename/delete/add-member/remove-member/
 * leave actions. Server-side RLS is the real gate on all of those — this
 * hook doesn't re-check founder status before calling them, it just
 * surfaces whatever error Postgres sends back if the caller isn't allowed.
 *
 * Sibling to useCommunityChannels rather than an extension of it: that
 * hook's fixed, tiny, rarely-changing system-channel list doesn't need
 * realtime at all, while this one has to react live to being added to (or
 * removed from) a channel, someone renaming a group, or a new message
 * reordering the list. Different enough shape that forcing them into one
 * hook would mean a pile of "if private" branches inside community's own
 * (already load-bearing) chat plumbing. */
export function usePrivateChannels() {
  const { user } = useAuth();
  const userId = user?.id;
  const [channels, setChannels] = useState([]); // [{ ...row, memberIds: Set, members: [{user_id,name,mascot}] }]
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  // Keep a ref to activeChannelId so callbacks that don't re-create on
  // every id change (deleteChannel, leaveChannel) can still read the
  // current value without capturing a stale closure.
  const activeChannelIdRef = useRef(activeChannelId);
  useEffect(() => { activeChannelIdRef.current = activeChannelId; }, [activeChannelId]);

  const load = useCallback(async () => {
    if (!userId) { setChannels([]); setLoading(false); return; }
    setLoading(true);

    const { data: rows, error: chErr } = await supabase
      .from("private_channels")
      .select(CHANNEL_SELECT)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });

    if (!mounted.current) return;
    if (chErr) {
      setError(chErr);
      setLoading(false);
      return;
    }

    const ids = (rows || []).map((r) => r.id);
    let membersByChannel = new Map();
    if (ids.length) {
      const { data: memberRows } = await supabase
        .from("private_channel_members")
        .select("channel_id, user_id")
        .in("channel_id", ids);
      const allUserIds = (memberRows || []).map((m) => m.user_id);
      const profileMap = await fetchProfilesByIds(allUserIds);
      for (const m of memberRows || []) {
        const list = membersByChannel.get(m.channel_id) || [];
        const prof = profileMap.get(m.user_id);
        list.push({ user_id: m.user_id, name: prof?.name || "Study Buddy", mascot: prof?.mascot || "bunny" });
        membersByChannel.set(m.channel_id, list);
      }
    }

    if (!mounted.current) return;
    const withMembers = (rows || []).map((r) => {
      const members = membersByChannel.get(r.id) || [];
      return { ...r, members, memberIds: new Set(members.map((m) => m.user_id)) };
    });
    setError(null);
    setChannels(withMembers);
    // If the previously-active channel is gone from this list (deleted, or
    // I was removed from it), clear it — don't keep pointing at a channel
    // I can no longer see. `??` here would be a no-op bug: it only ever
    // replaces null/undefined, so a truthy stale id would sail right
    // through instead of getting cleared.
    setActiveChannelId((prev) => (prev && withMembers.some((c) => c.id === prev) ? prev : null));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    load();
    if (!userId) return () => { mounted.current = false; };

    // Any channel row I can see appearing/changing/disappearing (RLS scopes
    // this to my own memberships, or everything if I'm a founder) —
    // covers new-channel creation, rename, delete, and last_message_*
    // updates reordering the list on every new message.
    const channelsRt = supabase
      .channel(`rt:private_channels:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "private_channels" }, () => {
        load();
      })
      .subscribe();

    // Being added to (or removed from) an EXISTING channel doesn't touch
    // private_channels itself, only my own membership row — needs its own
    // subscription, filtered to just me.
    const membersRt = supabase
      .channel(`rt:private_channel_members:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "private_channel_members", filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();

    return () => {
      mounted.current = false;
      supabase.removeChannel(channelsRt);
      supabase.removeChannel(membersRt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const createChannel = useCallback(async (name, memberUserIds = []) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return { ok: false, error: "Give the channel a name." };
    if (!userId) return { ok: false };

    const { data, error: err } = await supabase
      .from("private_channels")
      .insert({ name: trimmed, created_by: userId })
      .select(CHANNEL_SELECT)
      .single();
    if (err) return { ok: false, error: "Couldn't create that channel. Try again." };

    const memberSet = new Set([userId, ...memberUserIds]);
    const { error: memErr } = await supabase
      .from("private_channel_members")
      .insert([...memberSet].map((uid) => ({ channel_id: data.id, user_id: uid, added_by: userId })));
    if (memErr) {
      // Channel exists but members failed to attach — surface it, the
      // realtime/refetch above will still show the (nearly-empty) channel
      // so it's not silently lost.
      await load();
      return { ok: false, error: "Channel created, but couldn't add everyone. Try adding members again." };
    }

    await load();
    return { ok: true, data };
  }, [userId, load]);

  const renameChannel = useCallback(async (channelId, newName) => {
    const trimmed = (newName || "").trim();
    if (!trimmed) return { ok: false, error: "Name can't be empty." };
    const { error: err } = await supabase
      .from("private_channels")
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq("id", channelId);
    if (err) return { ok: false, error: "Couldn't rename that channel." };
    return { ok: true };
  }, []);

  // BUG FIX: was missing `load` in the dependency array, which meant the
  // realtime subscription wouldn't re-trigger a fresh fetch after delete —
  // the channel list panel could stay stale until the next unrelated event.
  // Also reads activeChannelId via ref instead of closing over the state
  // value so this callback never goes stale between renders.
  const deleteChannel = useCallback(async (channelId) => {
    const { error: err } = await supabase.from("private_channels").delete().eq("id", channelId);
    if (err) return { ok: false, error: "Couldn't delete that channel." };
    if (activeChannelIdRef.current === channelId) setActiveChannelId(null);
    await load();
    return { ok: true };
  }, [load]);

  const addMembers = useCallback(async (channelId, memberUserIds = []) => {
    if (!memberUserIds.length) return { ok: true };
    const { error: err } = await supabase
      .from("private_channel_members")
      .insert(memberUserIds.map((uid) => ({ channel_id: channelId, user_id: uid, added_by: userId })));
    if (err) return { ok: false, error: "Couldn't add everyone. Try again." };
    await load();
    return { ok: true };
  }, [userId, load]);

  const removeMember = useCallback(async (channelId, memberUserId) => {
    const { error: err } = await supabase
      .from("private_channel_members")
      .delete()
      .eq("channel_id", channelId)
      .eq("user_id", memberUserId);
    if (err) return { ok: false, error: "Couldn't remove that member." };
    await load();
    return { ok: true };
  }, [load]);

  // BUG FIX: was closing over `activeChannelId` state (via the dep array)
  // AND `removeMember` (which itself deps on load). The previous version
  // had both in deps, which was correct but could produce a stale
  // `activeChannelId` snapshot if the channel changed between the user
  // clicking Leave and the async completing. Now reads via ref for safety.
  const leaveChannel = useCallback(async (channelId) => {
    if (!userId) return { ok: false };
    const res = await removeMember(channelId, userId);
    if (res.ok && activeChannelIdRef.current === channelId) setActiveChannelId(null);
    return res;
  }, [userId, removeMember]);

  // Founder-only — the RPC itself enforces this server-side and raises if
  // the caller isn't a founder; this just surfaces that as {ok:false}.
  const fetchDirectory = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("get_private_chat_directory");
    if (err) return { ok: false, error: "Only founders can see the full member list.", data: [] };
    return { ok: true, data: data || [] };
  }, []);

  return {
    channels, activeChannelId, setActiveChannelId, loading, error,
    createChannel, renameChannel, deleteChannel, addMembers, removeMember, leaveChannel,
    fetchDirectory, refetch: load,
  };
}
