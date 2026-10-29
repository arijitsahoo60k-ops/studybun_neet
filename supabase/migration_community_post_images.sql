-- ============================================================
-- Migration: Community post images
-- ============================================================
-- Run after migration_community.sql. Safe to re-run.
--
-- Scope decision: images are attached to Study Feed **posts** only, not
-- chat messages. Chat is for quick back-and-forth (text, 5-day expiry);
-- a post is the thing meant to stick around and be worth looking at
-- (mock score screenshot, solved problem, notes) — that's the actual
-- distinction between the two surfaces, so only posts get the upload UI.
-- ============================================================

-- ---------- 1. community_posts: image column ----------
alter table community_posts add column if not exists image_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'community_posts_image_url_len') then
    alter table community_posts
      add constraint community_posts_image_url_len check (image_url is null or char_length(image_url) <= 600) not valid;
  end if;
end $$;

-- ---------- 2. storage bucket ----------
-- Public read (images just need a stable URL to render in the feed),
-- writes restricted to the uploader's own folder (see policies below).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-post-images', 'community-post-images', true, 8388608,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------- 3. storage RLS ----------
-- Objects are stored at `${auth.uid()}/${uuid}.ext` — the first path
-- segment is the uploader's own user id, which the policies below check
-- via storage.foldername(name). Nobody can write into another user's
-- folder, and nobody can overwrite/delete another user's file.
drop policy if exists "community post images public read" on storage.objects;
create policy "community post images public read" on storage.objects
  for select using (bucket_id = 'community-post-images');

drop policy if exists "community post images insert own" on storage.objects;
create policy "community post images insert own" on storage.objects
  for insert with check (
    bucket_id = 'community-post-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "community post images delete own" on storage.objects;
create policy "community post images delete own" on storage.objects
  for delete using (
    bucket_id = 'community-post-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
