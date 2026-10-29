import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { attachProfiles, fetchOneProfile, getCachedProfile } from "../lib/communityProfiles";
import { compressImage } from "../lib/compressImage";

const PAGE_SIZE = 50;
// image_url added — everything else unchanged from the original SELECT list.
const SELECT = "id, channel_id, user_id, content, image_url, created_at, expires_at, reply_to_id, reply_to_user_id, reply_to_name, reply_to_content";

const CHAT_IMAGE_BUCKET = "community-chat-images";

// ─── helpers (unchanged from original) ────────────────────────────────────────

function insertSorted(list, msg) {
  if (list.some((m) => m.id === msg.id)) return list;
  const t = new Date(msg.created_at).getTime();
  let idx = list.length;
  for (let i = list.length - 1; i >= 0; i--) {
    if (new Date(list[i].created_at).getTime() <= t) {
      idx = i + 1;
      break;
    }
    if (i === 0) idx = 0;
  }
  return [...list.slice(0, idx), msg, ...list.slice(idx)];
}

const MAX_LOADED_MESSAGES = 400;
const TRIM_HIGH_WATER = 500;
function capMessages(list) {
  if (list.length <= TRIM_HIGH_WATER) return { list, trimmed: false };
  return { list: list.slice(list.length - MAX_LOADED_MESSAGES), trimmed: true };
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useCommunityChat(channelId) {
  const { user } = useAuth();
  const userId = user?.id;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const mounted = useRef(true);
  const activeChannelIdRef = useRef(channelId);
  const trimmedRef = useRef(false);

  const load = useCallback(async () => {
    if (!channelId || !userId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("community_messages")
      .select(SELECT)
      .eq("channel_id", channelId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    if (!mounted.current || activeChannelIdRef.current !== channelId) return;
    if (err) {
      setError(err);
    } else {
      setError(null);
      const withProfiles = await attachProfiles((data || []).slice().reverse());
      if (!mounted.current || activeChannelIdRef.current !== channelId) return;
      setMessages(withProfiles);
      setHasMore((data || []).length === PAGE_SIZE);
    }
    setLoading(false);
  }, [channelId, userId]);

  const loadOlder = useCallback(async () => {
    if (!channelId || messages.length === 0) return;
    const oldest = messages[0]?.created_at;
    const { data, error: err } = await supabase
      .from("community_messages")
      .select(SELECT)
      .eq("channel_id", channelId)
      .gt("expires_at", new Date().toISOString())
      .lt("created_at", oldest)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    if (activeChannelIdRef.current !== channelId) return;
    if (err) { setError(err); return; }
    const older = await attachProfiles((data || []).slice().reverse());
    if (activeChannelIdRef.current !== channelId) return;
    setHasMore((data || []).length === PAGE_SIZE);
    setMessages((prev) => {
      const existing = new Set(prev.map((m) => m.id));
      return [...older.filter((m) => !existing.has(m.id)), ...prev];
    });
  }, [channelId, messages]);

  useEffect(() => {
    if (trimmedRef.current) {
      trimmedRef.current = false;
      setHasMore(true);
    }
  }, [messages]);

  useEffect(() => {
    mounted.current = true;
    activeChannelIdRef.current = channelId;
    load();

    if (!channelId || !userId) return () => { mounted.current = false; };

    const rtChannel = supabase
      .channel(`rt:community_messages:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages", filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          if (activeChannelIdRef.current !== channelId) return;
          const newMsg = payload.new;
          const cachedProfile = getCachedProfile(newMsg.user_id);
          setMessages((prev) => {
            const { list, trimmed } = capMessages(insertSorted(prev, { ...newMsg, profiles: cachedProfile }));
            if (trimmed) trimmedRef.current = true;
            return list;
          });
          if (cachedProfile) return;
          const prof = await fetchOneProfile(newMsg.user_id);
          if (activeChannelIdRef.current !== channelId) return;
          setMessages((prev) => prev.map((m) => (m.id === newMsg.id ? { ...m, profiles: prof } : m)));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "community_messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          if (activeChannelIdRef.current !== channelId) return;
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "community_messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          if (activeChannelIdRef.current !== channelId) return;
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m)));
        }
      )
      .subscribe();

    return () => {
      mounted.current = false;
      supabase.removeChannel(rtChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, userId]);

  // ── upload helper ──────────────────────────────────────────────────────────
  // Compresses the file client-side (reuses the existing compressImage lib),
  // uploads to community-chat-images/${userId}/${uuid}.ext, returns the
  // public URL on success or throws on failure.
  // Called inside sendMessage — not exported separately so callers can't
  // bypass the content validation or fire stale uploads after channel switch.
  const uploadChatImage = useCallback(async (file) => {
    const compressed = await compressImage(file, { maxDimension: 1200, quality: 0.82 });
    const ext = compressed.type === "image/png" ? "png" : "jpeg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(CHAT_IMAGE_BUCKET)
      .upload(path, compressed, { contentType: compressed.type, upsert: false });
    if (upErr) throw upErr;
    const { data: urlData } = supabase.storage
      .from(CHAT_IMAGE_BUCKET)
      .getPublicUrl(path);
    return urlData.publicUrl;
  }, [userId]);

  // ── sendMessage ────────────────────────────────────────────────────────────
  // Now accepts an optional `imageFile` (File | null).
  // Either content or an image (or both) is required — matches DB constraint.
  const sendMessage = useCallback(
    async (content, replyTo, imageFile = null) => {
      const trimmed = (content || "").trim();
      if (!trimmed && !imageFile) return { ok: false, error: "Nothing to send." };
      if (!channelId || !userId || sending) return { ok: false };
      if (trimmed.length > 1000) return { ok: false, error: "Message is too long (max 1000 characters)." };

      setSending(true);

      // Upload image first (if any) — if it fails we bail before inserting
      // the row so there's no phantom message with a broken image_url.
      let image_url = null;
      if (imageFile) {
        try {
          image_url = await uploadChatImage(imageFile);
        } catch (upErr) {
          setSending(false);
          return { ok: false, error: "Couldn't upload the image. Try again." };
        }
      }

      const { data, error: err } = await supabase
        .from("community_messages")
        .insert({
          channel_id: channelId,
          user_id: userId,
          content: trimmed,
          image_url,
          reply_to_id: replyTo?.id ?? null,
          reply_to_user_id: replyTo?.user_id ?? null,
          reply_to_name: replyTo?.name ?? null,
          reply_to_content: replyTo?.content ?? null,
        })
        .select(SELECT)
        .single();

      setSending(false);
      if (err) {
        const isBanned = err.message?.includes("chat_banned");
        const friendly = isBanned
          ? "You're blocked from Community Chat right now."
          : err.message?.includes("rate_limited")
          ? "You're sending messages too fast — take a breath and try again in a bit."
          : err.message?.includes("invalid_reply")
          ? "That message isn't available to reply to anymore."
          : "Couldn't send that message. Try again.";
        // `code` is additive — lets the caller re-check block state when
        // the server refused for that reason (e.g. a missed realtime event).
        return { ok: false, error: friendly, ...(isBanned ? { code: "chat_banned" } : {}) };
      }

      if (activeChannelIdRef.current === channelId) {
        setMessages((prev) => {
          const { list, trimmed: wasTrimmed } = capMessages(insertSorted(prev, { ...data, profiles: getCachedProfile(userId) }));
          if (wasTrimmed) trimmedRef.current = true;
          return list;
        });
      }
      return { ok: true, data };
    },
    [channelId, userId, sending, uploadChatImage]
  );

  // BUG FIX: a delete refused by RLS comes back with NO error and zero
  // rows affected — PostgREST treats "matched nothing you're allowed to
  // touch" as a successful no-op. The old code read that as success and
  // optimistically dropped the message from the list, so a moderator
  // deleting something they aren't allowed to (a founder's message, now
  // that mods exist) watched it vanish and then reappear on the next
  // load. `.select("id")` makes the response carry the rows that were
  // actually deleted, so zero rows is detectable and reportable.
  const deleteMessage = useCallback(async (id) => {
    const { data, error: err } = await supabase
      .from("community_messages")
      .delete()
      .eq("id", id)
      .select("id");
    if (err) return { ok: false, error: "Couldn't delete that message." };
    if (!data || data.length === 0) {
      return { ok: false, error: "You can't delete that message." };
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
    return { ok: true };
  }, []);

  // ── read receipts ───────────────────────────────────────────────────────────
  // One write per (channel, user) — see migration_community_chat_read_receipts.sql
  // for why this is a single watermark row rather than a row per message.
  // Throttled to at most once every 4s per channel so a burst of incoming
  // messages (or the caller re-invoking this on every render) doesn't turn
  // into a write per message — read receipts only need "roughly now", not
  // per-message precision.
  // Goes through the mark_channel_read RPC (server-side now()) rather than
  // a client-side upsert with a client-supplied timestamp — a device clock
  // running behind the server would otherwise make freshly-arrived
  // messages look permanently unread, since "seen" is judged by comparing
  // this watermark against each message's (server-timestamped) created_at.
  const lastMarkRef = useRef({ channelId: null, at: 0 });
  const markChannelRead = useCallback(() => {
    if (!channelId || !userId) return;
    const now = Date.now();
    const last = lastMarkRef.current;
    if (last.channelId === channelId && now - last.at < 4000) return;
    lastMarkRef.current = { channelId, at: now };
    supabase
      .rpc("mark_channel_read", { p_channel_id: channelId })
      .then(({ error: rpcErr }) => {
        if (rpcErr) console.error("markChannelRead failed:", rpcErr.message);
      });
  }, [channelId, userId]);

  return { messages, loading, error, sending, sendMessage, deleteMessage, hasMore, loadOlder, refetch: load, markChannelRead };
}
