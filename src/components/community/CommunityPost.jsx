import React, { useEffect, useRef, useState } from "react";
import { HeartHandshake, Lightbulb, Rocket, MessageSquare, Camera, X } from "lucide-react";
import Mascot from "../Mascot";
import ContentActions from "./ContentActions";
import ImageLightbox from "./ImageLightbox";
import LinkifiedText from "./LinkifiedText";
import { PersonBadge } from "../ui";
import { validateImageFile } from "../../lib/imageValidation";

const TYPE_LABEL = {
  CHECK_IN: "CHECK-IN",
  PROGRESS: "PROGRESS",
  QUESTION: "QUESTION",
  TIP: "TIP",
  MILESTONE: "MILESTONE",
  DOUBT: "DOUBT",
};
const REACTIONS = [
  { key: "support", label: "Support", icon: HeartHandshake },
  { key: "helpful", label: "Helpful", icon: Lightbulb },
  { key: "lets_go", label: "Let's go", icon: Rocket },
];

const REPLY_PAGE_SIZE = 5;

function timeAgo(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Resolve images for a post — handles old single image_url and new image_urls[] */
function resolvePostImages(post) {
  if (post.image_urls?.length) return post.image_urls;
  if (post.image_url) return [post.image_url];
  return [];
}

/** Image grid — 1, 2, or 3 images in the layout described in the spec */
function PostImageGrid({ images, onOpen }) {
  if (!images.length) return null;
  const count = images.length;

  return (
    <div className={`sb-post-img-grid sb-post-img-grid-${count}`}>
      {images.map((url, i) => (
        <button
          key={i}
          type="button"
          className="sb-post-img-tile"
          onClick={() => onOpen(i)}
          aria-label={`View photo ${i + 1} of ${count}`}
        >
          <img
            src={url}
            alt={`Photo ${i + 1} of ${count}`}
            className="sb-post-img"
            loading="lazy"
            onError={(e) => { e.currentTarget.parentElement.classList.add("sb-post-img-tile--error"); e.currentTarget.style.visibility = "hidden"; }}
          />
        </button>
      ))}
    </div>
  );
}

export default function CommunityPost({ post, reactions, currentUserId, myProfile, moderation, founderIds, memberIds, onToggleReaction, replies, onLoadReplies, onAddReply, onDelete, onDeleteReply }) {
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyImageFile, setReplyImageFile] = useState(null);
  const [replyImagePreview, setReplyImagePreview] = useState(null);
  const [replyErr, setReplyErr] = useState(null);
  const [replySending, setReplySending] = useState(false);
  const [replyPage, setReplyPage] = useState(1); // how many "pages" of REPLY_PAGE_SIZE to show
  const [lightbox, setLightbox] = useState(null); // { images, startIndex } | null
  // BUG FIX: the result of onDelete/onDeleteReply was discarded, so a
  // failed delete (network, or a refusal now that a mod can aim at
  // content they may not remove) left the post sitting there with no
  // explanation. Shown with the existing .sb-cm-error class.
  const [actionErr, setActionErr] = useState(null);
  const replyFileRef = useRef(null);

  // Same leak as the composer's imagePreviews: replyImagePreview is a
  // blob: URL that only gets revoked on send/remove — if this post
  // unmounts while one is pending (post deleted from under the user,
  // navigating away mid-attach), nothing revokes it. Ref keeps this
  // effect's cleanup seeing the latest value without re-subscribing.
  const replyImagePreviewRef = useRef(replyImagePreview);
  replyImagePreviewRef.current = replyImagePreview;
  useEffect(() => {
    return () => { if (replyImagePreviewRef.current) URL.revokeObjectURL(replyImagePreviewRef.current); };
  }, []);

  const isOwn = post.user_id === currentUserId;
  const name = isOwn ? (myProfile?.name || "You") : (post.profiles?.name || "Study Buddy");
  const mascotSpecies = isOwn ? (myProfile?.mascot || "bunny") : (post.profiles?.mascot || "bunny");
  const r = reactions || { support: 0, helpful: 0, lets_go: 0, mine: new Set() };
  const postImages = resolvePostImages(post);

  const toggleReplies = () => {
    setShowReplies((v) => !v);
    if (!showReplies && !replies) onLoadReplies(post.id);
  };

  // Visible replies with pagination
  const allReplies = replies || [];
  const visibleReplies = allReplies.slice(0, replyPage * REPLY_PAGE_SIZE);
  const hiddenCount = allReplies.length - visibleReplies.length;

  // Reply image attach
  const pickReplyImage = () => replyFileRef.current?.click();
  const onReplyFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const validationErr = validateImageFile(file);
    if (validationErr) { setReplyErr(validationErr); return; }
    setReplyErr(null);
    setReplyImageFile(file);
    setReplyImagePreview(URL.createObjectURL(file));
  };
  const removeReplyImage = () => {
    if (replyImagePreview) URL.revokeObjectURL(replyImagePreview);
    setReplyImageFile(null);
    setReplyImagePreview(null);
  };

  const submitReply = async (e) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text || replySending) return;
    setReplySending(true);
    setReplyErr(null);
    const res = await onAddReply(post.id, text, replyImageFile || undefined);
    setReplySending(false);
    if (res.ok) {
      setReplyText("");
      removeReplyImage();
      // The reply just sent is appended to the end of the list. If it
      // falls past the currently-visible page (e.g. there were already
      // 6+ replies with more hidden), expand the page count so the
      // person immediately sees their own reply instead of it silently
      // landing behind a "Show more" click.
      const newTotal = allReplies.length + 1;
      setReplyPage((p) => Math.max(p, Math.ceil(newTotal / REPLY_PAGE_SIZE)));
    } else {
      setReplyErr(res.error || "Couldn't send that reply.");
    }
  };

  return (
    <div className="sb-post">
      <div className="sb-post-head">
        <Mascot species={mascotSpecies} mood="happy" size={30} ambient={false} />
        <div className="sb-post-who">
          <div className="sb-post-name">{name}<PersonBadge founderIds={founderIds} memberIds={memberIds} userId={post.user_id} /></div>
          <div className="sb-post-meta"><span className="sb-post-type">{TYPE_LABEL[post.type] || post.type}</span> · {timeAgo(post.created_at)}</div>
        </div>
        <ContentActions
          authorId={post.user_id}
          currentUserId={currentUserId}
          canDelete={moderation.canDelete(post.user_id)}
          targetType="post"
          targetId={post.id}
          onReport={moderation.report}
          onBlock={() => moderation.blockUser(post.user_id)}
          onDelete={async () => {
            setActionErr(null);
            const res = await onDelete(post.id);
            if (res && !res.ok) setActionErr(res.error || "Couldn't delete that post.");
          }}
        />
      </div>
      {(post.subject || post.chapter) && (
        <div className="sb-post-tag">{post.subject}{post.chapter ? ` — ${post.chapter}` : ""}</div>
      )}
      <div className="sb-post-content"><LinkifiedText text={post.content} /></div>
      {actionErr && <div className="sb-cm-error">{actionErr}</div>}

      {/* Image grid — handles 0/1/2/3 images, backward-compat with old image_url */}
      <PostImageGrid images={postImages} onOpen={(i) => setLightbox({ images: postImages, startIndex: i })} />

      <div className="sb-post-actions">
        {REACTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={`sb-post-reaction ${r.mine?.has(key) ? "active" : ""}`}
            onClick={() => onToggleReaction(post.id, key)}
          >
            <Icon size={13} /> {label}{r[key] ? ` (${r[key]})` : ""}
          </button>
        ))}
        <button type="button" className="sb-post-reaction" onClick={toggleReplies}>
          <MessageSquare size={13} /> {replies?.length ? `${replies.length} repl${replies.length === 1 ? "y" : "ies"}` : "Reply"}
        </button>
      </div>

      {showReplies && (
        <div className="sb-post-replies">
          {visibleReplies.map((rp) => {
            const rpName = rp.user_id === currentUserId ? (myProfile?.name || "You") : (rp.profiles?.name || "Study Buddy");
            const rpMascot = rp.user_id === currentUserId ? (myProfile?.mascot || "bunny") : (rp.profiles?.mascot || "bunny");
            return (
              <div key={rp.id} className="sb-post-reply">
                <Mascot species={rpMascot} mood="happy" size={22} ambient={false} />
                <div className="sb-post-reply-body">
                  <div className="sb-post-reply-head">
                    <span className="sb-post-reply-name">
                      {rpName}<PersonBadge founderIds={founderIds} memberIds={memberIds} userId={rp.user_id} />
                    </span>
                    <span className="sb-post-reply-time">{timeAgo(rp.created_at)}</span>
                  </div>
                  <div className="sb-post-reply-text"><LinkifiedText text={rp.content} /></div>
                  {rp.image_url && (
                    <button
                      type="button"
                      className="sb-post-reply-img-tile"
                      onClick={() => setLightbox({ images: [rp.image_url], startIndex: 0 })}
                      aria-label={`View photo shared by ${rpName}`}
                    >
                      <img
                        src={rp.image_url}
                        alt={`Photo shared by ${rpName}`}
                        className="sb-post-reply-img"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.parentElement.classList.add("sb-post-reply-img-tile--error"); e.currentTarget.style.visibility = "hidden"; }}
                      />
                    </button>
                  )}
                </div>
                <ContentActions
                  authorId={rp.user_id}
                  currentUserId={currentUserId}
                  canDelete={moderation.canDelete(rp.user_id)}
                  targetType="reply"
                  targetId={rp.id}
                  onReport={moderation.report}
                  onBlock={() => moderation.blockUser(rp.user_id)}
                  onDelete={async () => {
                    setActionErr(null);
                    const res = await onDeleteReply(post.id, rp.id);
                    if (res && !res.ok) setActionErr(res.error || "Couldn't delete that reply.");
                  }}
                />
              </div>
            );
          })}

          {hiddenCount > 0 && (
            <button
              type="button"
              className="sb-post-replies-show-more"
              onClick={() => setReplyPage((p) => p + 1)}
            >
              {/* The button reveals one more REPLY_PAGE_SIZE batch per
                  click, not every hidden reply at once — so the label
                  must say how many THIS click will reveal
                  (min(REPLY_PAGE_SIZE, hiddenCount)), not the full
                  hiddenCount, or it overpromises on threads with more
                  than 2 pages (e.g. "Show 7 more" then only 5 appear). */}
              Show {Math.min(REPLY_PAGE_SIZE, hiddenCount)} more {Math.min(REPLY_PAGE_SIZE, hiddenCount) === 1 ? "reply" : "replies"}
            </button>
          )}

          {/* Reply composer */}
          <form className="sb-post-reply-form" onSubmit={submitReply}>
            <div className="sb-post-reply-input-row">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Reply..."
                maxLength={1000}
                disabled={replySending}
              />
              <button
                type="button"
                className="sb-post-reply-attach"
                onClick={pickReplyImage}
                aria-label="Attach a photo to your reply"
                title="Attach photo"
                disabled={replySending}
              >
                <Camera size={15} />
              </button>
              <button type="submit" disabled={!replyText.trim() || replySending}>
                {replySending ? "…" : "Send"}
              </button>
            </div>
            <input ref={replyFileRef} type="file" accept="image/*" onChange={onReplyFileChange} hidden />
            {replyImagePreview && (
              <div className="sb-post-reply-img-preview">
                <img src={replyImagePreview} alt="Reply attachment preview" />
                <button type="button" className="sb-composer-image-remove" onClick={removeReplyImage} aria-label="Remove image">
                  <X size={12} />
                </button>
              </div>
            )}
            {replyErr && <p className="sb-cm-error">{replyErr}</p>}
          </form>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          startIndex={lightbox.startIndex}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
