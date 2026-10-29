import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { attachProfiles, fetchOneProfile } from "../lib/communityProfiles";
import { compressImage } from "../lib/compressImage";

const PAGE_SIZE = 20;
// Keep image_url in the select for backward-compat with existing rows
const POST_SELECT = "id, user_id, type, content, subject, chapter, image_url, image_urls, created_at";
const REPLY_SELECT = "id, post_id, user_id, content, image_url, created_at";
const IMAGE_BUCKET = "community-post-images";

export function useCommunityFeed() {
  const { user } = useAuth();
  const userId = user?.id;
  const [posts, setPosts] = useState([]);
  const [repliesByPost, setRepliesByPost] = useState({});
  const [reactionsByPost, setReactionsByPost] = useState({}); // { [postId]: { support: n, helpful: n, lets_go: n, mine: Set } }
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const mounted = useRef(true);

  const loadReactions = useCallback(async (postIds) => {
    if (!postIds.length) return;
    const { data } = await supabase.from("community_reactions").select("post_id, user_id, reaction_type").in("post_id", postIds);
    const grouped = {};
    (data || []).forEach((r) => {
      grouped[r.post_id] ||= { support: 0, helpful: 0, lets_go: 0, mine: new Set() };
      grouped[r.post_id][r.reaction_type]++;
      if (r.user_id === userId) grouped[r.post_id].mine.add(r.reaction_type);
    });
    setReactionsByPost((prev) => ({ ...prev, ...grouped }));
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from("community_posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(PAGE_SIZE);
    if (!mounted.current) return;
    if (!error) {
      const withProfiles = await attachProfiles(data || []);
      if (!mounted.current) return;
      setPosts(withProfiles);
      setHasMore((data || []).length === PAGE_SIZE);
      loadReactions((data || []).map((p) => p.id));
    }
    setLoading(false);
  }, [userId, loadReactions]);

  const loadMore = useCallback(async () => {
    const oldest = posts[posts.length - 1]?.created_at;
    if (!oldest) return;
    const { data, error } = await supabase.from("community_posts").select(POST_SELECT).lt("created_at", oldest).order("created_at", { ascending: false }).limit(PAGE_SIZE);
    if (error) return;
    const withProfiles = await attachProfiles(data || []);
    setHasMore((data || []).length === PAGE_SIZE);
    setPosts((prev) => [...prev, ...withProfiles]);
    loadReactions((data || []).map((p) => p.id));
  }, [posts, loadReactions]);

  useEffect(() => {
    mounted.current = true;
    load();
    if (!userId) return () => { mounted.current = false; };
    const ch = supabase
      .channel("rt:community_posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_posts" }, async (payload) => {
        const prof = await fetchOneProfile(payload.new.user_id);
        setPosts((prev) => (prev.some((p) => p.id === payload.new.id) ? prev : [{ ...payload.new, profiles: prof }, ...prev]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_posts" }, (payload) => {
        setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
      })
      .subscribe();
    return () => { mounted.current = false; supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Helper: upload a single image file, returns public URL or throws
  const uploadImage = useCallback(async (file) => {
    const compressed = await compressImage(file);
    const ext = compressed.type === "image/png" ? "png" : "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, compressed, { contentType: compressed.type, upsert: false });
    if (upErr) throw new Error("upload_failed");
    return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  }, [userId]);

  // Best-effort delete a storage path — silently no-ops if the file is gone.
  // Declared before createPost/addReply since they call it on the
  // upload/insert-failure cleanup paths below.
  const deleteStoragePath = useCallback((url) => {
    if (!url) return;
    const marker = `/${IMAGE_BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const path = url.slice(idx + marker.length);
      supabase.storage.from(IMAGE_BUCKET).remove([path]).catch(() => {});
    }
  }, []);

  const createPost = useCallback(
    async (form) => {
      if (!userId) return { ok: false };
      const content = (form.content || "").trim();
      if (!content) return { ok: false, error: "Write something first." };
      if (content.length > 2000) return { ok: false, error: "That's too long (max 2000 characters)." };

      // form.imageFiles is an array (0-3). Backward-compat: also accept legacy form.imageFile.
      const files = form.imageFiles?.length ? form.imageFiles : (form.imageFile ? [form.imageFile] : []);
      let image_urls = [];

      if (files.length > 0) {
        // Upload all in parallel; if any fail, clean up whichever ones DID
        // succeed (they'd otherwise be orphaned in storage forever, since
        // the post that would reference them never gets created) and
        // surface one error.
        const results = await Promise.allSettled(files.map((f) => uploadImage(f)));
        const failed = results.some((r) => r.status === "rejected");
        if (failed) {
          results.forEach((r) => { if (r.status === "fulfilled") deleteStoragePath(r.value); });
          return { ok: false, error: "Couldn't upload one of your images. Try again." };
        }
        image_urls = results.map((r) => r.value);
      }

      const { data, error: err } = await supabase
        .from("community_posts")
        .insert({ user_id: userId, type: form.type, content, subject: form.subject || null, chapter: form.chapter || null, image_urls })
        .select(POST_SELECT)
        .single();
      if (err) {
        // The post row was never created, so any uploaded images from
        // above are now orphaned too — clean them up before surfacing
        // the error.
        image_urls.forEach(deleteStoragePath);
        const friendly = err.message?.includes("rate_limited") ? "You've posted a lot this hour — try again later." : "Couldn't post that. Try again.";
        return { ok: false, error: friendly };
      }
      setPosts((prev) => [data, ...prev]);
      return { ok: true, data };
    },
    [userId, uploadImage, deleteStoragePath]
  );

  // BUG FIX: an RLS-refused delete returns no error and zero rows, which
  // the old code read as success — the post disappeared from the list and
  // came back on the next load. `.select("id")` lets us tell the two
  // apart now that a moderator can hit a post they may not delete.
  const deletePost = useCallback(async (id) => {
    const target = posts.find((p) => p.id === id);
    const { data, error: err } = await supabase
      .from("community_posts")
      .delete()
      .eq("id", id)
      .select("id");
    if (err) return { ok: false, error: "Couldn't delete that post." };
    if (!data || data.length === 0) return { ok: false, error: "You can't delete that post." };
    setPosts((prev) => prev.filter((p) => p.id !== id));
    // Best-effort cleanup: loop new image_urls array AND legacy image_url
    (target?.image_urls || []).forEach(deleteStoragePath);
    deleteStoragePath(target?.image_url);
    return { ok: true };
  }, [posts, deleteStoragePath]);

  const loadReplies = useCallback(async (postId) => {
    const { data, error } = await supabase
      .from("community_replies")
      .select(REPLY_SELECT)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (!error) {
      const withProfiles = await attachProfiles(data || []);
      setRepliesByPost((prev) => ({ ...prev, [postId]: withProfiles }));
    }
  }, []);

  const addReply = useCallback(
    async (postId, content, imageFile) => {
      if (!userId) return { ok: false };
      const trimmed = (content || "").trim();
      if (!trimmed) return { ok: false };

      let image_url = null;
      if (imageFile) {
        try {
          image_url = await uploadImage(imageFile);
        } catch {
          return { ok: false, error: "Couldn't upload that image. Try again." };
        }
      }

      const { data, error: err } = await supabase
        .from("community_replies")
        .insert({ post_id: postId, user_id: userId, content: trimmed, image_url })
        .select(REPLY_SELECT)
        .single();
      if (err) {
        // The reply row was never created, so an already-uploaded image
        // (if any) is now orphaned — clean it up before surfacing the error.
        deleteStoragePath(image_url);
        const friendly = err.message?.includes("rate_limited") ? "Too many replies for now — try again soon." : "Couldn't send that reply.";
        return { ok: false, error: friendly };
      }
      setRepliesByPost((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), data] }));
      return { ok: true };
    },
    [userId, uploadImage, deleteStoragePath]
  );

  const deleteReply = useCallback(async (postId, replyId) => {
    const target = (repliesByPost[postId] || []).find((r) => r.id === replyId);
    const { data, error: err } = await supabase
      .from("community_replies")
      .delete()
      .eq("id", replyId)
      .select("id");
    if (err) return { ok: false, error: "Couldn't delete that reply." };
    if (!data || data.length === 0) return { ok: false, error: "You can't delete that reply." };
    setRepliesByPost((prev) => ({ ...prev, [postId]: (prev[postId] || []).filter((r) => r.id !== replyId) }));
    // Best-effort cleanup of reply image
    deleteStoragePath(target?.image_url);
    return { ok: true };
  }, [repliesByPost, deleteStoragePath]);

  const toggleReaction = useCallback(
    async (postId, reactionType) => {
      if (!userId) return;
      const current = reactionsByPost[postId] || { support: 0, helpful: 0, lets_go: 0, mine: new Set() };
      const already = current.mine.has(reactionType);
      // optimistic
      setReactionsByPost((prev) => {
        const next = { ...current, mine: new Set(current.mine) };
        if (already) { next[reactionType] = Math.max(0, next[reactionType] - 1); next.mine.delete(reactionType); }
        else { next[reactionType] = next[reactionType] + 1; next.mine.add(reactionType); }
        return { ...prev, [postId]: next };
      });
      if (already) {
        await supabase.from("community_reactions").delete().eq("post_id", postId).eq("user_id", userId).eq("reaction_type", reactionType);
      } else {
        await supabase.from("community_reactions").insert({ post_id: postId, user_id: userId, reaction_type: reactionType });
      }
    },
    [userId, reactionsByPost]
  );

  return { posts, loading, hasMore, loadMore, createPost, deletePost, repliesByPost, loadReplies, addReply, deleteReply, reactionsByPost, toggleReaction, refetch: load };
}
