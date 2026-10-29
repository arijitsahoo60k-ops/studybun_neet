-- ============================================================
-- Migration: Community + Accountability
-- ============================================================
-- Safe to run on an existing StudyBun database — idempotent
-- (create-if-not-exists / drop-if-exists-then-create), so
-- re-running it is harmless.
--
-- Scope decisions (see the Community build brief for full context):
--   • The mandatory 5-day expiry applies to community_messages
--     (real-time chat) — that's the one place the brief calls it
--     "mandatory". Feed posts/replies are the student's own study
--     history (check-ins, progress, milestones) and are kept, same
--     as every other StudyBun activity table — they just fall out
--     of the "last 5 days" chat window, not out of existence.
--   • Roles live in their own `user_roles` table, never on
--     `profiles`, and there is deliberately NO insert/update/delete
--     policy for the `authenticated` role on it — nobody can grant
--     themselves moderator/admin from the client. Promote users via
--     the Supabase dashboard/service role only.
--   • Reactions attach to posts (not chat messages) — matches the
--     brief's "keep reactions simple" framing around check-ins/feed
--     items, and keeps message deletion free of cascade fan-out.
--   • Blocking is enforced at the RLS layer itself (not just in the
--     client query), so a blocked user's content is actually
--     unreadable by the blocker at the database level.
-- ============================================================

-- ---------- 0. profiles: community-facing extras ----------
-- Reuses the existing profiles table (name = display name, mascot =
-- avatar, exam = target exam) rather than creating a second identity
-- system. Only adds what's missing.
alter table profiles add column if not exists bio text default '';
alter table profiles add column if not exists prep_year int;
alter table profiles add column if not exists community_opt_out boolean default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_len') then
    alter table profiles add constraint profiles_bio_len check (char_length(bio) <= 160) not valid;
  end if;
end $$;

-- ---------- 1. roles (never trusted from the client) ----------
create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  created_at timestamptz default now()
);

create or replace function is_moderator(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role in ('moderator', 'admin'));
$$;
revoke all on function is_moderator(uuid) from public;
grant execute on function is_moderator(uuid) to authenticated;

create or replace function is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role = 'admin');
$$;
revoke all on function is_admin(uuid) from public;
grant execute on function is_admin(uuid) to authenticated;

alter table user_roles enable row level security;
drop policy if exists "user_roles read own or mod" on user_roles;
create policy "user_roles read own or mod" on user_roles
  for select using (auth.uid() = user_id or is_moderator(auth.uid()));
-- No insert/update/delete policy on purpose: roles are only ever
-- changed by an operator using the service role key.

-- ---------- 2. blocking helper (used throughout RLS below) ----------
create table if not exists community_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table community_blocks enable row level security;
drop policy if exists "blocks manage own" on community_blocks;
create policy "blocks manage own" on community_blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

create or replace function is_blocked_by_viewer(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from community_blocks where blocker_id = auth.uid() and blocked_id = target
  );
$$;
revoke all on function is_blocked_by_viewer(uuid) from public;
grant execute on function is_blocked_by_viewer(uuid) to authenticated;

-- ---------- 3. channels ----------
create table if not exists community_channels (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text default '',
  subject text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table community_channels enable row level security;
drop policy if exists "channels read active" on community_channels;
create policy "channels read active" on community_channels
  for select using (is_active or is_moderator(auth.uid()));
-- Fixed system channels only — no client insert/update/delete policy.

insert into community_channels (name, slug, description, subject, sort_order)
values
  ('General', 'general', 'Say hi, ask anything, cheer each other on.', null, 0),
  ('NEET UG', 'neet-ug', 'Everything NEET UG prep, strategy & updates.', null, 1),
  ('Biology (Botany & Zoology)', 'biology', 'NCERT Biology, Botany & Zoology doubts and high-yield discussions.', 'Biology', 2),
  ('Physics', 'physics', 'Physics doubts, tips, and grind updates.', 'Physics', 3),
  ('Chemistry', 'chemistry', 'Chemistry doubts, tips, and grind updates.', 'Chemistry', 4),
  ('Mathematics (PCMB)', 'mathematics', 'Maths doubts, tips, and grind updates for PCMB students.', 'Maths', 5)
on conflict (slug) do nothing;

-- ---------- 4. chat messages (5-day mandatory expiry) ----------
create table if not exists community_messages (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid not null references community_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 days'),
  updated_at timestamptz not null default now(),
  check (char_length(trim(content)) > 0 and char_length(content) <= 1000)
);
create index if not exists idx_community_messages_channel on community_messages(channel_id, created_at desc);
create index if not exists idx_community_messages_expires on community_messages(expires_at);
create index if not exists idx_community_messages_user on community_messages(user_id, created_at desc);

alter table community_messages enable row level security;

drop policy if exists "messages read" on community_messages;
create policy "messages read" on community_messages
  for select using (
    auth.role() = 'authenticated'
    and not is_blocked_by_viewer(user_id)
  );

drop policy if exists "messages insert own" on community_messages;
create policy "messages insert own" on community_messages
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from community_channels c where c.id = channel_id and c.is_active)
  );

drop policy if exists "messages delete own or mod" on community_messages;
create policy "messages delete own or mod" on community_messages
  for delete using (auth.uid() = user_id or is_moderator(auth.uid()));

-- Server-side rate limiting + basic anti-spam. Deliberately generous
-- (this is defense against flooding/bots, not a leash on normal chat).
create or replace function community_messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  recent_count int;
  last_content text;
  last_at timestamptz;
begin
  select count(*) into recent_count
  from community_messages
  where user_id = NEW.user_id and created_at > now() - interval '60 seconds';
  if recent_count >= 12 then
    raise exception 'rate_limited: too many messages, slow down a little';
  end if;

  select content, created_at into last_content, last_at
  from community_messages
  where user_id = NEW.user_id
  order by created_at desc
  limit 1;

  if last_content is not null and last_content = NEW.content and last_at > now() - interval '20 seconds' then
    raise exception 'rate_limited: duplicate message';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_community_messages_guard on community_messages;
create trigger trg_community_messages_guard
  before insert on community_messages
  for each row execute function community_messages_guard();

-- ---------- 5. accountability goals ----------
create table if not exists accountability_goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  subject text,
  chapter text,
  goal_type text not null default 'custom',
  goal_text text not null,
  target_value numeric,
  actual_value numeric,
  estimated_minutes numeric,
  status text not null default 'planned' check (status in ('planned', 'studying', 'completed', 'partial', 'missed')),
  result_note text,
  created_at timestamptz default now(),
  completed_at timestamptz,
  check (char_length(trim(goal_text)) > 0 and char_length(goal_text) <= 200)
);
create index if not exists idx_accountability_goals_user_date on accountability_goals(user_id, goal_date desc);
create index if not exists idx_accountability_goals_date on accountability_goals(goal_date);

alter table accountability_goals enable row level security;

drop policy if exists "goals read" on accountability_goals;
create policy "goals read" on accountability_goals
  for select using (auth.role() = 'authenticated' and not is_blocked_by_viewer(user_id));

drop policy if exists "goals insert own" on accountability_goals;
create policy "goals insert own" on accountability_goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "goals update own" on accountability_goals;
create policy "goals update own" on accountability_goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals delete own" on accountability_goals;
create policy "goals delete own" on accountability_goals
  for delete using (auth.uid() = user_id);

-- ---------- 6. feed posts ----------
create table if not exists community_posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('CHECK_IN', 'PROGRESS', 'QUESTION', 'TIP', 'MILESTONE')),
  content text not null,
  subject text,
  chapter text,
  goal_id uuid references accountability_goals(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (char_length(trim(content)) > 0 and char_length(content) <= 2000)
);
create index if not exists idx_community_posts_created on community_posts(created_at desc);
create index if not exists idx_community_posts_user on community_posts(user_id, created_at desc);

alter table community_posts enable row level security;

drop policy if exists "posts read" on community_posts;
create policy "posts read" on community_posts
  for select using (auth.role() = 'authenticated' and not is_blocked_by_viewer(user_id));

drop policy if exists "posts insert own" on community_posts;
create policy "posts insert own" on community_posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "posts delete own or mod" on community_posts;
create policy "posts delete own or mod" on community_posts
  for delete using (auth.uid() = user_id or is_moderator(auth.uid()));

create or replace function community_posts_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from community_posts
  where user_id = NEW.user_id and created_at > now() - interval '1 hour';
  if recent_count >= 6 then
    raise exception 'rate_limited: too many posts this hour';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_community_posts_guard on community_posts;
create trigger trg_community_posts_guard
  before insert on community_posts
  for each row execute function community_posts_guard();

-- ---------- 7. one-level replies ----------
create table if not exists community_replies (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now(),
  check (char_length(trim(content)) > 0 and char_length(content) <= 1000)
);
create index if not exists idx_community_replies_post on community_replies(post_id, created_at);

alter table community_replies enable row level security;

drop policy if exists "replies read" on community_replies;
create policy "replies read" on community_replies
  for select using (auth.role() = 'authenticated' and not is_blocked_by_viewer(user_id));

drop policy if exists "replies insert own" on community_replies;
create policy "replies insert own" on community_replies
  for insert with check (auth.uid() = user_id);

drop policy if exists "replies delete own or mod" on community_replies;
create policy "replies delete own or mod" on community_replies
  for delete using (auth.uid() = user_id or is_moderator(auth.uid()));

create or replace function community_replies_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from community_replies
  where user_id = NEW.user_id and created_at > now() - interval '1 hour';
  if recent_count >= 20 then
    raise exception 'rate_limited: too many replies this hour';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_community_replies_guard on community_replies;
create trigger trg_community_replies_guard
  before insert on community_replies
  for each row execute function community_replies_guard();

-- ---------- 8. reactions (posts only) ----------
create table if not exists community_reactions (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('support', 'helpful', 'lets_go')),
  created_at timestamptz default now(),
  unique (user_id, post_id, reaction_type)
);
create index if not exists idx_community_reactions_post on community_reactions(post_id);

alter table community_reactions enable row level security;

drop policy if exists "reactions read" on community_reactions;
create policy "reactions read" on community_reactions
  for select using (auth.role() = 'authenticated');

drop policy if exists "reactions insert own" on community_reactions;
create policy "reactions insert own" on community_reactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "reactions delete own" on community_reactions;
create policy "reactions delete own" on community_reactions
  for delete using (auth.uid() = user_id);

-- ---------- 9. reports ----------
create table if not exists community_reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('message', 'post', 'reply', 'user')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'abuse', 'inappropriate', 'misinformation', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  check (details is null or char_length(details) <= 500)
);
create index if not exists idx_community_reports_status on community_reports(status, created_at desc);

alter table community_reports enable row level security;

drop policy if exists "reports insert own" on community_reports;
create policy "reports insert own" on community_reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists "reports read own or mod" on community_reports;
create policy "reports read own or mod" on community_reports
  for select using (auth.uid() = reporter_id or is_moderator(auth.uid()));

drop policy if exists "reports resolve mod only" on community_reports;
create policy "reports resolve mod only" on community_reports
  for update using (is_moderator(auth.uid())) with check (is_moderator(auth.uid()));

-- ---------- 10. realtime ----------
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'community_messages', 'community_posts', 'community_replies',
    'community_reactions', 'accountability_goals'
  ])
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I;', t);
    end if;
  end loop;
end $$;

-- ---------- 11. helper view: today's real check-in counts ----------
-- Used by the Community header for "students checked in today" — a real
-- count, never a fabricated number. "Active now" reuses the app's existing
-- Realtime Presence channel (useStudyPresence), not a DB table.
create or replace view community_today_checkins as
select count(distinct user_id) as checked_in_today
from accountability_goals
where goal_date = (now() at time zone 'Asia/Kolkata')::date;

grant select on community_today_checkins to authenticated;
