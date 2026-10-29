-- ============================================================
-- Migration: Community chat read receipts
-- ============================================================
-- Safe to run on the existing production database — idempotent
-- (create-if-not-exists / drop-if-exists-then-create).
--
-- DESIGN NOTE — why this is one row per (channel, user), not one row
-- per (message, user):
-- A WhatsApp-style per-message read row (community_message_reads:
-- message_id, user_id) would mean every person who opens a busy
-- channel writes N rows for however many messages are currently on
-- screen, and that write volume only grows with channel activity —
-- exactly the kind of thing that makes a chat feel laggy under load.
-- Instead we track the single timestamp "this user has read this
-- channel up to now" (upserted on ONE row, cheap regardless of how
-- many messages are on screen), and answer "who read message X" by
-- comparing everyone's last_read_at against message X's created_at.
-- This is an approximation (it says "seen the channel after this
-- message was sent", not "definitely scrolled past this exact
-- bubble"), but it's the same approximation every high-volume group
-- chat product makes, it's O(1) to write, and lookups are a single
-- indexed range scan.
-- ============================================================

-- ---------- 1. per-channel last-read watermark ----------
create table if not exists community_channel_reads (
  channel_id uuid not null references community_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists idx_community_channel_reads_channel_read
  on community_channel_reads(channel_id, last_read_at);

alter table community_channel_reads enable row level security;

-- Everyone authenticated (minus anyone the viewer has blocked) can see
-- read watermarks — same visibility rule as the messages themselves,
-- and this table never exposes anything beyond "channel + timestamp".
drop policy if exists "channel_reads read" on community_channel_reads;
create policy "channel_reads read" on community_channel_reads
  for select using (
    auth.role() = 'authenticated' and not is_blocked_by_viewer(user_id)
  );

-- A user can only ever write their own watermark. Not currently the
-- primary write path (mark_channel_read() below is, and being SECURITY
-- DEFINER it bypasses these) — kept as defense in depth in case
-- anything ever writes to this table directly from the client.
drop policy if exists "channel_reads upsert own" on community_channel_reads;
create policy "channel_reads upsert own" on community_channel_reads
  for insert with check (auth.uid() = user_id);

drop policy if exists "channel_reads update own" on community_channel_reads;
create policy "channel_reads update own" on community_channel_reads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- 2. resolve readers for a message ----------
-- security definer so it can join `profiles` for name/mascot the same
-- way get_community_profiles does (a plain client-side select on
-- profiles only ever returns the caller's own row).
--
-- NOTE ON SCOPE: this takes a channel + timestamp, not a message id or
-- sender check — it does NOT verify the caller actually sent a message
-- in this channel at that time. The (i) button in the UI only ever
-- appears on the caller's own messages (see ChatMessage.jsx), so that's
-- what scopes this in practice, not this function. That's an
-- intentional, non-security-critical tradeoff: community channels are
-- already fully public (anyone authenticated can already read every
-- message and see who posted it), so a channel's read-activity
-- watermark isn't materially more sensitive than that. It always
-- excludes the caller from their own results either way.
create or replace function get_message_readers(p_channel_id uuid, p_after timestamptz)
returns table(user_id uuid, name text, mascot text, last_read_at timestamptz)
language sql stable security definer set search_path = public as $$
  select cr.user_id, p.name, p.mascot, cr.last_read_at
  from community_channel_reads cr
  join profiles p on p.user_id = cr.user_id
  where cr.channel_id = p_channel_id
    and cr.last_read_at >= p_after
    and cr.user_id <> auth.uid()
    and not is_blocked_by_viewer(cr.user_id)
  order by cr.last_read_at desc
  limit 200;
$$;
revoke all on function get_message_readers(uuid, timestamptz) from public;
grant execute on function get_message_readers(uuid, timestamptz) to authenticated;

-- ---------- 3. mark a channel read (server clock, not client's) ----------
-- Deliberately NOT a plain client-side upsert with a client-supplied
-- timestamp: comparing "have you read this" against message.created_at
-- (a SERVER timestamp) only works if the read watermark is also a
-- server timestamp. A client clock running even a few seconds behind
-- the server would make freshly-received messages look permanently
-- unread to that person — this function uses now() (server time) so
-- the two sides of the >= comparison in get_message_readers are always
-- on the same clock. auth.uid() also means the client never needs to
-- (and can't) pass a user_id at all.
create or replace function mark_channel_read(p_channel_id uuid)
returns void
language sql security definer set search_path = public as $$
  insert into community_channel_reads (channel_id, user_id, last_read_at)
  values (p_channel_id, auth.uid(), now())
  on conflict (channel_id, user_id) do update set last_read_at = excluded.last_read_at;
$$;
revoke all on function mark_channel_read(uuid) from public;
grant execute on function mark_channel_read(uuid) to authenticated;
