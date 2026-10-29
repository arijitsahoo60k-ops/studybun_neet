# StudyBun Community + Accountability — Build Notes

## Setup

1. Run `supabase/migration_community.sql` in your Supabase SQL editor (safe
   to re-run; everything is idempotent).
2. Run `supabase/migration_community_post_images.sql` too — adds the
   `community_posts.image_url` column and creates the
   `community-post-images` storage bucket + RLS policies (also idempotent).
3. Deploy as usual — `vercel.json` now also schedules
   `api/cron/community-cleanup.js` every 30 minutes to physically delete
   expired chat messages. It reuses the same `CRON_SECRET` /
   `SUPABASE_SERVICE_ROLE_KEY` env vars as the existing notify cron.
4. Nothing else to configure — Community reuses your existing Supabase
   client, auth, profile, and presence systems.
5. To promote a user to moderator/admin, insert/update a row in
   `user_roles` using the Supabase dashboard or service role — this is
   intentional; there is no in-app UI or client-writable path to grant
   roles.

## What's included

- **Chat**: realtime, per-channel (General / JEE Main / JEE Advanced /
  Physics / Chemistry / Maths), 1000-char limit, server-side rate limiting
  and duplicate-message guard, mandatory 5-day expiry enforced by an
  actual `DELETE` in Postgres (cron), not a client-side filter. Chat stays
  **text-only on purpose** — see "Chat vs. Post" below.
- **Accountability**: daily check-in with JEE-oriented goal types, live
  "today's check-ins" list of other students, non-shaming status language,
  lightweight completion reporting, weekly summary.
- **Feed**: five post types (check-in/progress/question/tip/milestone),
  optional image attachment, three simple reactions, one-level replies,
  pagination.

## Chat vs. Post

The two surfaces are deliberately different, not just visually:

- **Chat** = fast, disposable, text-only back-and-forth. 5-day expiry.
- **Post** = the thing worth keeping and worth actually looking at — so
  it's the only place that supports an image attachment (mock score
  screenshot, a solved problem, notes, etc). Images are compressed
  client-side (`src/lib/compressImage.js`, max ~1600px / JPEG q0.82, no
  new dependency) before upload to the `community-post-images` Storage
  bucket, at `${userId}/${uuid}.ext`. Bucket is public-read; write/delete
  is restricted by RLS to the uploader's own folder
  (`supabase/migration_community_post_images.sql`). Deleting a post
  best-effort deletes its file too.
- **Safety**: reporting (six reason categories, reporter identity never
  exposed to anyone but the reporter/moderators), blocking (enforced at
  the RLS layer, not just client-side filtering), a `user_roles` table
  that's never writable from the client.
- **Real numbers only**: the "studying now" count reuses the app's
  existing Realtime Presence channel (`useStudyPresence`/`studyingIds`,
  already wired at the app root for Leaderboard); "checked in today" is a
  genuine count of today's `accountability_goals` rows. Nothing is
  fabricated.

## Scope decisions worth knowing about

- **Expiry applies to chat messages only.** The brief calls the 5-day
  rule "mandatory" specifically for messages/chat (§14, §16). Feed posts
  and their replies are treated like the rest of a student's study
  history (sessions, mocks, revisions) and are kept — they just aren't
  chat, so an ever-growing archive isn't the same UX problem the 5-day
  rule exists to solve. Easy to extend later if you'd rather they expire
  too (same trigger-default pattern as `community_messages.expires_at`).
- **Reactions attach to posts, not chat messages** — matches the brief's
  framing of reactions around check-ins/feed items, and keeps message
  deletion free of cascading reaction cleanup.
- **Not implemented** (flagged in the brief as optional/nice-to-have, and
  skipped in the interest of "do not create unnecessary complexity"):
  accountability pairing/buddy matching, full-text search across
  chat/feed, AI-generated daily prompts. All are additive — nothing here
  blocks adding them later.
- **Roles**: `user_roles` is a separate table (not a `profiles.role`
  column) specifically so a compromised or buggy client write can never
  self-grant moderator/admin — there is no RLS policy that allows
  authenticated inserts/updates on it at all.

## Files touched/added

```
supabase/migration_community.sql        (new)
api/cron/community-cleanup.js           (new)
vercel.json                             (cron + function entry added)
src/lib/communityProfiles.js            (new)
src/hooks/useCommunityChannels.js       (new)
src/hooks/useCommunityChat.js           (new)
src/hooks/useAccountability.js          (new)
src/hooks/useCommunityFeed.js           (new)
src/hooks/useCommunityModeration.js     (new)
src/pages/Community.jsx                 (new)
src/components/community/*.jsx          (new, 10 files)
src/styles/CommunityStyle.jsx           (new)
src/App.jsx                             (nav entry + route wired in)
```

`npm run build` passes clean; the Community page code-splits into its own
chunk (~43 kB) exactly like every other page.

---

## Feed v2 — what shipped (Study Feed Redesign)

Run `supabase/migration_community_feed_v2.sql` after the earlier two
community migrations. It is idempotent.

### New capabilities

- **Multi-image posts (up to 3).** New `image_urls text[]` column on
  `community_posts`. New posts write to `image_urls`; the old `image_url`
  column is untouched (left intact permanently — ~170 existing rows use
  it). The client resolves both shapes with one line:
  `post.image_urls?.length ? post.image_urls : (post.image_url ? [post.image_url] : [])`.
  No data migration was run; old and new posts render correctly through
  the same image-grid path.

- **In-app image lightbox.** Tapping any post or reply image opens
  `ImageLightbox.jsx` instead of the browser's own tab/viewer. Follows
  the established `sb-pt-overlay`/`sb-pt-dialog` dialog pattern exactly
  (role="dialog", aria-modal, Escape-to-close, focus-on-open, click-
  backdrop-to-close, body-scroll lock). Left/right arrow-key navigation,
  touch swipe (delta-x ≥ 40px), dot indicator for multi-image sets,
  `object-fit: contain` (viewer, not cropper).

- **Image grid layout.** 1 image: full-width (unchanged from before).
  2 images: equal 2-column, `aspect-ratio:1/1`. 3 images: 1 large left
  spanning 2 rows, 2 stacked right (`max-height: 360px` cap). On ≤480px
  screens the 3-image layout drops to a simple 3-column equal grid (CSS-
  only, no JS breakpoint).

- **Reply images (1 per reply).** New `image_url text` column on
  `community_replies`. Reply composer gets a camera-icon attach button;
  the image shows as a small tap-to-open tile inside the reply row,
  reusing the same `ImageLightbox` component. Reply-image best-effort
  storage cleanup added to `deleteReply`.

- **DOUBT post type.** Added to the `community_posts_type_check`
  constraint, `TYPES` array in `CommunityComposer`, and `TYPE_LABEL` map
  in `CommunityPost`.

- **Reply redesign.** Each reply now shows the replier's mascot avatar
  (22px, `ambient={false}`), a name + PersonBadge row, and a relative
  timestamp (reusing the existing `timeAgo()` helper). Replies are
  visually separated by a subtle bottom border. Reply pagination: the
  first 5 replies are shown; "Show N more replies" reveals the next 5 at
  a time (client-side slice of already-loaded data — no extra backend
  query).

- **Shared image validation.** `src/lib/imageValidation.js` exports a
  `validateImageFile(file)` helper used by both CommunityComposer and
  the reply composer, so the 8 MB / `image/*` checks can't drift apart.

### Scope decisions worth knowing about

- **Pinch-to-zoom not implemented in v1.** `object-fit: contain` at the
  viewport bounds is sufficient for "viewable." Pinch-zoom requires real
  gesture handling across browsers (pointer events, prevent-default
  conflicts with scroll) and a library like Panzoom would be a meaningful
  new dependency. Flagged as a future nice-to-have, not a silent omission.

- **Reply pagination is client-side only.** Replies within a single post
  don't reach the reply count where server-side cursor pagination pays
  off at this scale. The existing `loadReplies` call already fetches all
  replies for a post; the 5-per-page reveal is a purely client-side slice.

- **No reactions on replies.** Unchanged from the original scope decision:
  reactions stay on posts only to keep message deletion free of cascading
  reaction cleanup.

- **`image_url` (singular) on `community_posts` is permanent.** It will
  not be dropped or backfilled. Any future cleanup migration that
  consolidates old rows into `image_urls[]` should be a separate,
  deliberate, opt-in operation with a verified backup — not folded into
  a routine migration.

- **Swipe gesture is a simple delta-x listener.** `touchstart`/`touchend`
  with a 40px threshold. No swipe library added. Does not prevent the
  page's own vertical scroll (swipe detection is horizontal-delta only).

### Files added / changed

```
supabase/migration_community_feed_v2.sql          (new)
src/lib/imageValidation.js                         (new)
src/hooks/useCommunityFeed.js                      (edit)
src/components/community/CommunityComposer.jsx     (edit)
src/components/community/CommunityPost.jsx         (edit)
src/components/community/ImageLightbox.jsx         (new)
src/styles/CommunityStyle.jsx                      (edit)
COMMUNITY_BUILD_NOTES.md                           (this update)
```

`CommunityFeed.jsx` — no changes needed (thin pass-through; `createPost`
and `addReply` signature changes are backward-compatible).

## v2.1 — bugfix pass

A follow-up review of the v2 changes above turned up a handful of real
issues, all fixed:

- **Orphaned storage uploads.** `createPost` (multi-image) and `addReply`
  (single-image) now clean up any already-uploaded image(s) if a later
  step fails — either another image in the same batch failing to upload,
  or the DB insert itself failing (rate limit, etc). Previously a
  successful upload followed by *any* later failure left the file
  permanently orphaned in storage with nothing ever referencing it.
- **Reply pagination could hide your own just-sent reply.** If a post
  already had more replies than fit on the current page, sending a new
  reply appended it past the visible window — it looked like the reply
  didn't send until "Show more" was clicked. `submitReply` now expands
  `replyPage` on success so a new reply is always immediately visible.
- **Composer image validation discarded valid files.** Selecting several
  photos at once where one failed validation (wrong type, too big)
  previously dropped the whole batch. Now each file is validated
  independently — the valid ones are added, one error message surfaces
  for the invalid one(s).
- **Broken-image fallback silently no-op'd on replies.** The reply image
  tile's `onError` handler was tagging it with the post-grid's error
  class name (`sb-post-img-tile--error`), which targets `.sb-post-img` —
  a class the reply tile's `<img>` never has (it uses
  `.sb-post-reply-img`). Renamed to a reply-specific class with a
  matching CSS rule.
- **Focus ring clipped on multi-image grids and reply tiles.** Both use
  `overflow: hidden` for their rounded corners, which cut off the
  outward `outline-offset: 2px` focus ring on keyboard focus. Switched
  both to an inset ring (`outline-offset: -3px`) so it's always fully
  visible.
- **Lightbox dot indicators were a 20px hit area**, short of the 44px
  touch target used everywhere else in this feature. Bumped to 44px;
  the visible dot itself stays 10px via the existing `::after`.
- **Stale comment on the 2-image grid's border-radius reset**, describing
  per-corner rounding that the code doesn't actually do (the outer grid
  container's `overflow: hidden` does the rounding). Comment corrected
  to avoid a future "fix" that breaks it.
