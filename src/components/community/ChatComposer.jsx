import React, { useCallback, useEffect, useRef, useState } from "react";
import { Send, X, ImagePlus } from "lucide-react";
import { validateImageFile } from "../../lib/imageValidation";

const MAX_LEN = 1000;
// Fallback only, used if the textarea's CSS max-height can't be read
// (e.g. not yet mounted/styled). The real cap normally comes from CSS —
// see resizeToContent() below.
const TEXTAREA_MAX_HEIGHT = 140;

// Split out from CommunityChat on purpose: `draft` used to live in the
// same component as the whole message list, so every keystroke re-ran
// that component and re-rendered every visible message (each with its
// own Mascot SVG avatar). In a busy channel that's what made typing feel
// laggy while other people were also posting. Keeping draft/err/textarea
// state in here means a keystroke only re-renders this small composer,
// never the list above it.
// `placeholder` and `expiryNote` are optional overrides — both default to
// Community Chat's original copy, so this stays a no-op for every existing
// call site. Added for Private Chat, which (a) isn't scoped to "your study
// group" the way Community's channels are, and (b) has no 5-day expiry —
// showing that note there would be actively wrong, not just generic.
// Pass expiryNote={null} to omit the line entirely.
export default function ChatComposer({
  channelId, replyTo, onCancelReply, sendMessage, sending,
  placeholder = "Say something to your study group...",
  expiryNote = "Messages disappear after 5 days.",
}) {
  const [draft, setDraft] = useState("");
  const [imageFile, setImageFile] = useState(null);   // File | null
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null); // blob URL | null
  const [err, setErr] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const submittingRef = useRef(false);
  // Outer wrapper ref — watched by the ResizeObserver below. Deliberately
  // NOT the textarea itself: observing the textarea would mean every call
  // to resizeToContent() (which sets the textarea's own height) could
  // re-trigger the observer on itself. Watching the stable outer zone
  // instead only reacts to layout changes that come from *outside* this
  // component — exactly the cases the old resize-only listener missed.
  const zoneRef = useRef(null);

  // Resets imageFile/imagePreviewUrl without revoking the blob URL itself —
  // revocation happens in exactly one place (the effect below), so this can
  // be a stable, dependency-free callback instead of a plain function that
  // gets redefined (and re-closes over whatever `imagePreviewUrl` happened
  // to be) on every render.
  const clearImage = useCallback(() => {
    setImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // A draft typed for one channel must never end up posted in another.
  useEffect(() => {
    setDraft("");
    setErr(null);
    clearImage();
  }, [channelId, clearImage]);

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  // Auto-grow the textarea up to whatever max-height the current
  // breakpoint's CSS gives it (140px on mobile, more on tablet/desktop —
  // see CommunityStyle.jsx) instead of a single hardcoded JS constant.
  // A fixed constant here would silently override any CSS max-height bump
  // at larger breakpoints, since this effect sets an explicit inline
  // px height on every keystroke. Reading the computed style keeps this
  // in sync with CSS no matter how the breakpoints change later.
  const resizeToContent = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const cssMax = parseFloat(getComputedStyle(el).maxHeight);
    const max = Number.isFinite(cssMax) && cssMax > 0 ? cssMax : TEXTAREA_MAX_HEIGHT;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, []);

  useEffect(() => {
    resizeToContent();
  }, [draft, resizeToContent]);

  // Re-clamp on viewport/orientation changes too (e.g. rotating a tablet,
  // or resizing a browser window across a breakpoint) — without this the
  // textarea would keep whichever max-height applied when it was last
  // typed into until the next keystroke.
  useEffect(() => {
    window.addEventListener("resize", resizeToContent);
    return () => window.removeEventListener("resize", resizeToContent);
  }, [resizeToContent]);

  // BUG FIX (mobile private chat): the `resize` listener above only ever
  // fires for actual window/viewport resizes. It does nothing for a purely
  // CSS-driven layout change — and Private Chat's mobile layout does
  // exactly that: below 768px it keeps both the channel list and the chat
  // pane mounted at all times and just toggles one of them to
  // `display: none` via `.sb-pchat-page[data-pane]` (see PrivateChatStyle.jsx),
  // instead of unmounting. Community Chat's composer never goes through a
  // display:none/flex flip like this, so it never hit this bug — but for
  // Private Chat, the moment you're sat on the channel list, this
  // composer's textarea has a collapsed (zero) box, and switching back to
  // the chat pane doesn't fire `resize`, so it could render at a stale/
  // wrong height until the next keystroke.
  //
  // A ResizeObserver on the composer's own wrapper sidesteps all of that:
  // it fires for *any* reason the box's size changes — a display:none/flex
  // toggle, a sidebar collapsing, an orientation change that doesn't fire
  // `resize`, a parent flex layout reflowing — so this one mechanism keeps
  // the textarea correctly sized on every screen size and every layout,
  // for both Community and Private Chat, without either needing its own
  // special-case handling.
  useEffect(() => {
    const el = zoneRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => resizeToContent());
    ro.observe(el);
    return () => ro.disconnect();
  }, [resizeToContent]);

  // BUG FIX (stale closure / double revoke): this is now the *only* place
  // that ever calls URL.revokeObjectURL. Previously clearImage() and
  // handleImagePick() each also revoked `imagePreviewUrl` directly from
  // their own closures before updating state — which meant every image
  // swap or clear revoked the same blob URL twice (once inline, once again
  // here when the effect's cleanup ran for the old value on the next
  // render). Revoking an already-revoked URL doesn't throw, so this was
  // silent and harmless, but it's wasted work and relied on `clearImage`'s
  // closure always having a fresh `imagePreviewUrl` — a plain (non-memoized)
  // function is redefined every render, so it usually did, but that's an
  // implicit invariant, not a guarantee.
  //
  // Now clearImage()/handleImagePick() only ever call the state setters.
  // React runs this cleanup with the *previous* imagePreviewUrl right
  // before the effect re-runs for the new one, so every replacement (or a
  // clear, which sets it to null) revokes the old URL exactly once, and
  // unmounting revokes whatever was still set. Single source of truth,
  // no closures to go stale.
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  function handleImagePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validErr = validateImageFile(file);
    if (validErr) { setErr(validErr); return; }
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setErr(null);
    // Refocus the textarea so the user can add a caption without extra taps
    textareaRef.current?.focus();
  }

  const handleSend = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    const text = draft.trim();
    if (!text && !imageFile) return;
    submittingRef.current = true;
    setErr(null);
    const res = await sendMessage(text, replyTo, imageFile);
    submittingRef.current = false;
    if (res.ok) {
      setDraft("");
      onCancelReply();
      clearImage();
    } else {
      setErr(res.error || "Couldn't send that.");
    }
    textareaRef.current?.focus();
  };

  const nearLimit = draft.length > MAX_LEN * 0.85;
  const canSend = !sending && (draft.trim().length > 0 || imageFile !== null);

  return (
    <div className="sb-chat-composer-zone" ref={zoneRef}>
      {replyTo && (
        <div className="sb-chat-reply-bar">
          <div className="sb-chat-reply-bar-info">
            <span className="sb-chat-reply-bar-name">Replying to {replyTo.name}</span>
            <span className="sb-chat-reply-bar-text">{replyTo.content}</span>
          </div>
          <button type="button" className="sb-chat-reply-bar-cancel" onClick={onCancelReply} aria-label="Cancel reply">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Image preview strip — shown above the text row when an image is picked */}
      {imageFile && imagePreviewUrl && (
        <div className="sb-chat-img-preview-strip">
          <div className="sb-chat-img-preview-thumb">
            <img src={imagePreviewUrl} alt="Attachment preview" />
            <button
              type="button"
              className="sb-chat-img-preview-remove"
              onClick={clearImage}
              aria-label="Remove image"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      <form className="sb-chat-composer" onSubmit={handleSend}>
        {/* Hidden file input — triggered by the camera button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: "none" }}
          onChange={handleImagePick}
          aria-hidden="true"
          tabIndex={-1}
        />

        {/* Image attach button */}
        <button
          type="button"
          className="sb-chat-attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          aria-label="Attach image"
          title="Attach image"
        >
          <ImagePlus size={18} />
        </button>

        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSend(e); }}
          placeholder={imageFile ? "Add a caption (optional)..." : placeholder}
          maxLength={MAX_LEN}
          rows={1}
          disabled={sending}
        />
        <button type="submit" disabled={!canSend} aria-label="Send message">
          <Send size={18} />
        </button>
      </form>

      <div className="sb-chat-composer-foot">
        <span className="sb-chat-hint"><kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line</span>
        {draft.length > 0 && (
          <span className={`sb-chat-counter ${nearLimit ? "warn" : ""}`}>{draft.length}/{MAX_LEN}</span>
        )}
      </div>
      {err && <p className="sb-cm-error">{err}</p>}
      {expiryNote && <p className="sb-muted small sb-chat-expiry-note">{expiryNote}</p>}
    </div>
  );
}
