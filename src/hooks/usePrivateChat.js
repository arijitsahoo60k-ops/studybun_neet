import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { attachProfiles, getCachedProfile, fetchOneProfile } from "../lib/communityProfiles";
import { compressImage } from "../lib/compressImage";

// Same shape as useCommunityChat — messages for ONE channel at a time,
// paginated + realtime. Kept as a sibling file rather than a shared/
// parameterized hook: the two tables diverge slightly (no expires_at here,
// membership replaces the "is_active channel" insert check) and community
// chat is high-traffic, load-bearing code that's better left untouched.
const PAGE_SIZE = 50;
const SELECT = "id, channel_id, user_id, content, image_url, created_at, reply_to_id, reply_to_user_id, reply_to_name, reply_to_content";

const CHAT_IMAGE_BUCKET = "private-chat-images";

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

export function usePrivateChat(channelId) {
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

  // Keep a ref to messages so loadOlder can read the current list without
  // re-creating itself (and thus re-triggering the realtime useEffect)
  // every time a new message arrives. The previous version had `messages`
  // in loadOlder's dep array — correct for correctness but caused the
  // realtime subscription to tear down and re-subscribe on every incoming
  // message, which introduced a brief gap where new messages could be
  // missed. Now loadOlder reads via ref and is stable across message updates.
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const load = useCallback(async () => {
    if (!channelId || !userId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("private_messages")
      .select(SELECT)
      .eq("channel_id", channelId)
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

  // BUG FIX: removed `messages` from the dep array — was causing the
  // realtime subscription to be rebuilt on every incoming message (because
  // loadOlder captured `messages` in its closure and was re-created each
  // time). Now reads via messagesRef, which is always current, without
  // making loadOlder a new function reference on each render.
  const loadOlder = useCallback(async () => {
    const currentMessages = messagesRef.current;
    if (!channelId || currentMessages.length === 0) return;
    const oldest = currentMessages[0]?.created_at;
    const { data, error: err } = await supabase
      .from("private_messages")
      .select(SELECT)
      .eq("channel_id", channelId)
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
  }, [channelId]);

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
      .channel(`rt:private_messages:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "private_messages", filter: `channel_id=eq.${channelId}` },
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
        { event: "DELETE", schema: "public", table: "private_messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          if (activeChannelIdRef.current !== channelId) return;
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "private_messages", filter: `channel_id=eq.${channelId}` },
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

  const uploadChatImage = useCallback(async (file) => {
    const compressed = await compressImage(file, { maxDimension: 1200, quality: 0.82 });
    const ext = compressed.type === "image/png" ? "png" : "jpeg";
    const path = `${channelId}/${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(CHAT_IMAGE_BUCKET)
      .upload(path, compressed, { contentType: compressed.type, upsert: false });
    if (upErr) throw upErr;
    const { data: urlData } = supabase.storage
      .from(CHAT_IMAGE_BUCKET)
      .getPublicUrl(path);
    return urlData.publicUrl;
  }, [channelId, userId]);

  const sendMessage = useCallback(
    // BUG FIX: renamed local `trimmed` variable to `textContent` to avoid
    // shadowing the outer `trimmedRef` (boolean flag for capMessages). The
    // previous code had `const trimmed = (content || "").trim()` inside
    // sendMessage while `trimmedRef` (a ref, not a variable) existed in the
    // same scope. Although JS doesn't actually shadow refs (it's
    // trimmedRef.current vs trimmed), the naming collision was confusing and
    // the destructure `const { list, trimmed: wasTrimmed }` from capMessages
    // further down proved they're meant to be different things. Renamed here
    // to make the intent clear and eliminate any future maintenance hazard.
    async (content, replyTo, imageFile = null) => {
      const textContent = (content || "").trim();
      if (!textContent && !imageFile) return { ok: false, error: "Nothing to send." };
      if (!channelId || !userId || sending) return { ok: false };
      if (textContent.length > 1000) return { ok: false, error: "Message is too long (max 1000 characters)." };

      setSending(true);

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
        .from("private_messages")
        .insert({
          channel_id: channelId,
          user_id: userId,
          content: textContent,
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
        const friendly = err.message?.includes("rate_limited")
          ? "You're sending messages too fast — take a breath and try again in a bit."
          : err.message?.includes("invalid_reply")
          ? "That message isn't available to reply to anymore."
          : "Couldn't send that message. Try again.";
        return { ok: false, error: friendly };
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

  // BUG FIX: same RLS-refusal blind spot as useCommunityChat's
  // deleteMessage — a delete the policy rejects returns no error and
  // zero rows, which the old code counted as success and removed from
  // the list anyway. `.select("id")` surfaces the row count so a refused
  // delete reports back instead of silently faking it.
  const deleteMessage = useCallback(async (id) => {
    const { data, error: err } = await supabase
      .from("private_messages")
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

  return { messages, loading, error, sending, sendMessage, deleteMessage, hasMore, loadOlder, refetch: load };
}
