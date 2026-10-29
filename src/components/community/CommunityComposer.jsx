import React, { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Btn } from "../ui";
import { validateImageFile } from "../../lib/imageValidation";

const TYPES = [
  { value: "CHECK_IN", label: "Check-in" },
  { value: "PROGRESS", label: "Progress" },
  { value: "QUESTION", label: "Question" },
  { value: "TIP", label: "Tip" },
  { value: "MILESTONE", label: "Milestone" },
  { value: "DOUBT", label: "Doubt" },
];

const MAX_LEN = 2000;
const MAX_IMAGES = 3;

export default function CommunityComposer({ onSubmit }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("PROGRESS");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  const fileInputRef = useRef(null);

  // imagePreviews are blob: URLs (URL.createObjectURL) — the browser
  // holds that memory until explicitly revoked or the page unloads.
  // clearImages()/removeImage() cover the normal paths (send, cancel,
  // remove one), but if the whole composer unmounts while a preview is
  // still pending (e.g. navigating away from the Community page with an
  // attached-but-unsent photo), nothing was revoking it. Track the
  // latest previews in a ref so this cleanup-on-unmount effect always
  // sees the current list, not a stale one from when it first mounted.
  const previewsRef = useRef(imagePreviews);
  previewsRef.current = imagePreviews;
  useEffect(() => {
    return () => { previewsRef.current.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);

  const pickImage = () => fileInputRef.current?.click();

  const onFileChange = (e) => {
    const incoming = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-picking the same file later
    if (!incoming.length) return;

    const remaining = MAX_IMAGES - imageFiles.length;
    if (remaining <= 0) {
      setErr(`You can attach up to ${MAX_IMAGES} photos per post.`);
      return;
    }

    const candidates = incoming.slice(0, remaining);
    const overLimitDropped = incoming.length - candidates.length;

    // Validate each candidate independently — one bad file (wrong type,
    // too big) shouldn't throw away the good ones sitting next to it in
    // the same selection.
    const valid = [];
    let firstValidationErr = null;
    for (const file of candidates) {
      const validationErr = validateImageFile(file);
      if (validationErr) { firstValidationErr = firstValidationErr || validationErr; }
      else valid.push(file);
    }

    if (firstValidationErr) {
      setErr(firstValidationErr);
    } else if (overLimitDropped > 0) {
      setErr(`Only ${remaining} more photo${remaining > 1 ? "s" : ""} allowed — ${overLimitDropped} dropped.`);
    } else {
      setErr(null);
    }

    if (valid.length === 0) return;
    const newPreviews = valid.map((f) => URL.createObjectURL(f));
    setImageFiles((prev) => [...prev, ...valid]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeImage = (i) => {
    URL.revokeObjectURL(imagePreviews[i]);
    setImageFiles((prev) => prev.filter((_, idx) => idx !== i));
    setImagePreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const clearImages = () => {
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImageFiles([]);
    setImagePreviews([]);
  };

  const resetDraft = () => {
    setContent(""); setSubject(""); setType("PROGRESS"); setErr(null); clearImages();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErr(null);
    const res = await onSubmit({ type, content, subject: subject || null, imageFiles });
    setSubmitting(false);
    if (res.ok) {
      resetDraft();
      setOpen(false);
    } else setErr(res.error);
  };

  if (!open) {
    return (
      <button type="button" className="sb-composer-trigger" onClick={() => setOpen(true)}>
        Share a check-in, progress update, question, tip, milestone, or doubt...
      </button>
    );
  }

  const uploadingLabel = imageFiles.length > 0
    ? `Uploading ${imageFiles.length} photo${imageFiles.length > 1 ? "s" : ""}...`
    : "Posting...";

  return (
    <form className="sb-composer-form" onSubmit={submit}>
      <div className="sb-composer-types">
        {TYPES.map((t) => (
          <button key={t.value} type="button" className={`sb-chip small ${type === t.value ? "active" : ""}`} onClick={() => setType(t.value)}>
            {t.label}
          </button>
        ))}
      </div>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" maxLength={40} />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your mind?"
        maxLength={MAX_LEN}
        rows={3}
        autoFocus
      />

      {/* Images belong to posts, not chat — this is the whole point of
          having both: chat is for quick back-and-forth, a post is for
          something you want to actually show (a mock score screenshot,
          a solved problem, notes) and have stick around. */}
      {imagePreviews.length > 0 && (
        <div className="sb-composer-images-row">
          {imagePreviews.map((src, i) => (
            <div key={i} className="sb-composer-image-thumb">
              <img src={src} alt={`Attachment ${i + 1}`} />
              <button
                type="button"
                className="sb-composer-image-remove"
                onClick={() => removeImage(i)}
                aria-label={`Remove photo ${i + 1}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {imagePreviews.length < MAX_IMAGES && (
        <button type="button" className="sb-composer-attach" onClick={pickImage}>
          <ImagePlus size={15} /> {imagePreviews.length === 0 ? "Add a photo" : "Add another photo"}
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onFileChange} hidden />

      {err && <p className="sb-cm-error">{err}</p>}
      <div className="sb-checkin-btn-row">
        <Btn variant="soft" onClick={() => { resetDraft(); setOpen(false); }}>Cancel</Btn>
        <Btn type="submit" disabled={submitting || !content.trim()}>{submitting ? uploadingLabel : "Post"}</Btn>
      </div>
    </form>
  );
}
