-- ============================================================
-- Focus Timer music: per-user settings + own playlists.
--
--   focus_music_settings   one row per user (same shape as
--                          focus_mode_settings, read/written through
--                          useDeviceRow): is music on, Stations vs My
--                          music, which station / playlist, volume,
--                          shuffle, loop.
--   focus_playlists        a user's named playlists.
--   focus_playlist_tracks  the YouTube videos inside a playlist, in
--                          `sort_order`. Title/author are cached from
--                          YouTube's oEmbed at add-time so the list
--                          renders instantly without hitting YouTube.
--
-- Deleting a playlist cascades to its tracks; deleting the playlist a
-- user had selected just nulls focus_music_settings.playlist_id.
--
-- Safe to run standalone against an existing DB (everything is
-- guarded / idempotent) -- also folded into schema.sql for fresh
-- installs.
-- ============================================================

create table if not exists focus_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort_order int not null default 0,
  created_at timestamptz default now()
);
create index if not exists idx_focus_playlists_user on focus_playlists(user_id, sort_order);

create table if not exists focus_playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  playlist_id uuid not null references focus_playlists(id) on delete cascade,
  -- YouTube video ids are always 11 chars of [A-Za-z0-9_-].
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text check (title is null or char_length(title) <= 200),
  author text check (author is null or char_length(author) <= 120),
  sort_order int not null default 0,
  created_at timestamptz default now(),
  unique (playlist_id, video_id)
);
create index if not exists idx_focus_playlist_tracks_pl on focus_playlist_tracks(playlist_id, sort_order);
create index if not exists idx_focus_playlist_tracks_user on focus_playlist_tracks(user_id);

create table if not exists focus_music_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  source text not null default 'stations' check (source in ('stations', 'own')),
  -- free text on purpose (like focus_mode_settings.scene): the client
  -- validates against the current station list, so adding/removing
  -- stations never needs a migration.
  station_id text,
  playlist_id uuid references focus_playlists(id) on delete set null,
  volume int not null default 70 check (volume between 0 and 100),
  shuffle boolean not null default false,
  loop_playlist boolean not null default true,
  updated_at timestamptz default now()
);

-- ---------- RLS ----------
alter table focus_playlists enable row level security;
drop policy if exists "user access" on focus_playlists;
create policy "user access" on focus_playlists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A track must belong to one of the caller's OWN playlists, so nobody can
-- attach rows to someone else's playlist id.
alter table focus_playlist_tracks enable row level security;
drop policy if exists "user access" on focus_playlist_tracks;
create policy "user access" on focus_playlist_tracks
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from focus_playlists p where p.id = playlist_id and p.user_id = auth.uid())
  );

alter table focus_music_settings enable row level security;
drop policy if exists "user access" on focus_music_settings;
create policy "user access" on focus_music_settings
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      playlist_id is null
      or exists (select 1 from focus_playlists p where p.id = playlist_id and p.user_id = auth.uid())
    )
  );

-- ---------- Realtime ----------
do $$
declare
  t text;
begin
  foreach t in array array['focus_playlists', 'focus_playlist_tracks', 'focus_music_settings']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
