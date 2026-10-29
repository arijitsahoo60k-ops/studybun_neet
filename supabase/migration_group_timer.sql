-- ============================================================
-- Migration: Group Timer (study rooms with live "studying now" cards)
-- ============================================================
-- Safe to run on the existing production database — additive only,
-- idempotent (create-if-not-exists / create-or-replace / drop-if-exists-
-- then-create). Nothing existing is altered. Run this BEFORE deploying the
-- frontend that calls these functions.
--
-- Depends on migration_community.sql (is_moderator()). Run that first if
-- it somehow isn't there yet (it already is on production).
--
-- Design decisions:
--   • A group is either PUBLIC (listed for everyone, anyone can join in one
--     tap) or PRIVATE (invisible to non-members, joined with a 6-character
--     code). Members of a private group can read the row, so the code is
--     visible to them too (they can pass it on) — non-members can't select
--     the row at all, so there is no way to list or guess groups.
--   • Every write goes through a SECURITY DEFINER function below (create /
--     join / leave). Tables have NO insert/update policies, so nobody can
--     bypass the rules (caps, code generation, who may create a public
--     group) by talking to the table directly.
--   • Nothing about "who is studying right now" lives in the database —
--     that is Supabase Realtime Presence on a per-room channel, exactly
--     like the existing "Studying Now" indicator. The database only knows
--     who belongs to which group.
--   • Group timers are the normal Focus Timer underneath: the session is
--     logged to timer_sessions by the existing code path, so group study
--     time counts in study hours / streak / leaderboard exactly like any
--     other focus session. Nothing in this file touches those tables.
--   • Public groups are created by founders / moderators (is_moderator()).
--     Any member can create PRIVATE groups (max 5 created per person, to
--     stop spam). Flip the one `if` inside gt_create_group if you ever want
--     everyone to be able to create public groups too.
-- ============================================================

-- ---------- 1. groups ----------
create table if not exists study_groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (char_length(trim(name)) between 2 and 40),
  is_public boolean not null default false,
  join_code text unique,
  -- null = seeded/system group (never auto-deleted when it empties out)
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (is_public and join_code is null)
    or (not is_public and join_code is not null)
  )
);
create index if not exists idx_study_groups_public on study_groups(is_public) where is_public;
create index if not exists idx_study_groups_creator on study_groups(created_by);

-- ---------- 2. membership ----------
create table if not exists study_group_members (
  group_id uuid not null references study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists idx_study_group_members_user on study_group_members(user_id);

create or replace function is_study_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from study_group_members where group_id = gid and user_id = auth.uid()
  );
$$;
revoke all on function is_study_group_member(uuid) from public;
grant execute on function is_study_group_member(uuid) to authenticated;

-- ---------- 3. RLS ----------
alter table study_groups enable row level security;
alter table study_group_members enable row level security;

drop policy if exists "study groups read public or member" on study_groups;
create policy "study groups read public or member" on study_groups
  for select using (is_public or is_study_group_member(id));

-- Creator (or a founder/mod) can delete a group outright. Members rows go
-- with it via ON DELETE CASCADE.
drop policy if exists "study groups delete creator or mod" on study_groups;
create policy "study groups delete creator or mod" on study_groups
  for delete using (created_by = auth.uid() or is_moderator(auth.uid()));

-- You can always see your own membership rows, and the other members of a
-- group you're in. (No insert/update/delete policies on purpose — see header.)
drop policy if exists "study group members read" on study_group_members;
create policy "study group members read" on study_group_members
  for select using (user_id = auth.uid() or is_study_group_member(group_id));

-- ---------- 4. helpers ----------
-- 6 characters from a 32-symbol alphabet with no look-alikes (no I/O/0/1).
-- Entropy comes from gen_random_uuid() (strong RNG, built in).
create or replace function gt_make_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := decode(md5(gen_random_uuid()::text), 'hex');
  code text := '';
  i int;
begin
  for i in 0..5 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;
revoke all on function gt_make_code() from public;

-- Hard member caps keep a single room's realtime presence traffic sane
-- (every member's update is broadcast to every other member).
create or replace function gt_group_cap(is_pub boolean) returns int
language sql immutable as $$ select case when is_pub then 60 else 30 end; $$;
revoke all on function gt_group_cap(boolean) from public;

-- ---------- 5. create ----------
create or replace function gt_create_group(p_name text, p_is_public boolean default false)
returns study_groups
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  clean text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  made_count int;
  attempt int := 0;
  new_code text;
  row_out study_groups;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if char_length(clean) < 2 or char_length(clean) > 40 then
    raise exception 'Group name must be 2–40 characters.';
  end if;

  -- The one place that decides who may create PUBLIC groups.
  if p_is_public and not is_moderator(uid) then
    raise exception 'Only founders and moderators can create public groups.';
  end if;

  select count(*) into made_count from study_groups where created_by = uid;
  if made_count >= 5 and not is_moderator(uid) then
    raise exception 'You can create up to 5 groups. Delete one first.';
  end if;

  loop
    attempt := attempt + 1;
    new_code := case when p_is_public then null else gt_make_code() end;
    begin
      insert into study_groups (name, is_public, join_code, created_by)
      values (clean, coalesce(p_is_public, false), new_code, uid)
      returning * into row_out;
      exit;
    exception when unique_violation then
      -- astronomically rare code collision: just roll a new code
      if attempt >= 8 then raise exception 'Could not generate a join code, try again.'; end if;
    end;
  end loop;

  insert into study_group_members (group_id, user_id) values (row_out.id, uid)
  on conflict do nothing;
  return row_out;
end;
$$;
revoke all on function gt_create_group(text, boolean) from public;
grant execute on function gt_create_group(text, boolean) to authenticated;

-- ---------- 6. join ----------
create or replace function gt_join_public(p_group_id uuid)
returns study_groups
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g study_groups;
  n int;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  select * into g from study_groups where id = p_group_id and is_public;
  if not found then raise exception 'That group does not exist any more.'; end if;

  if not exists (select 1 from study_group_members where group_id = g.id and user_id = uid) then
    select count(*) into n from study_group_members where group_id = g.id;
    if n >= gt_group_cap(true) then raise exception 'This group is full.'; end if;
    insert into study_group_members (group_id, user_id) values (g.id, uid) on conflict do nothing;
  end if;
  return g;
end;
$$;
revoke all on function gt_join_public(uuid) from public;
grant execute on function gt_join_public(uuid) to authenticated;

create or replace function gt_join_by_code(p_code text)
returns study_groups
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  g study_groups;
  n int;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if char_length(clean) <> 6 then raise exception 'Codes are 6 characters long.'; end if;

  select * into g from study_groups where join_code = clean and not is_public;
  if not found then raise exception 'No group found with that code.'; end if;

  if not exists (select 1 from study_group_members where group_id = g.id and user_id = uid) then
    select count(*) into n from study_group_members where group_id = g.id;
    if n >= gt_group_cap(false) then raise exception 'This group is full.'; end if;
    insert into study_group_members (group_id, user_id) values (g.id, uid) on conflict do nothing;
  end if;
  return g;
end;
$$;
revoke all on function gt_join_by_code(text) from public;
grant execute on function gt_join_by_code(text) to authenticated;

-- ---------- 7. leave ----------
-- Removes your membership. A user-created group that ends up with nobody in
-- it is deleted (otherwise a private group with a live join code and zero
-- members would sit in the table forever). Seeded groups (created_by null)
-- are never deleted.
create or replace function gt_leave_group(p_group_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  left_over int;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  delete from study_group_members where group_id = p_group_id and user_id = uid;
  select count(*) into left_over from study_group_members where group_id = p_group_id;
  if left_over = 0 then
    delete from study_groups where id = p_group_id and created_by is not null;
  end if;
end;
$$;
revoke all on function gt_leave_group(uuid) from public;
grant execute on function gt_leave_group(uuid) to authenticated;

-- ---------- 7b. delete ----------
-- Goes through a function (not a bare DELETE) because RLS hides private
-- groups from non-members -- including founders/mods -- so a plain DELETE
-- would silently match zero rows for them. Creator or founder/mod only.
create or replace function gt_delete_group(p_group_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  gone int;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  delete from study_groups
  where id = p_group_id and (created_by = uid or is_moderator(uid));
  get diagnostics gone = row_count;
  return gone > 0;
end;
$$;
revoke all on function gt_delete_group(uuid) from public;
grant execute on function gt_delete_group(uuid) to authenticated;

-- ---------- 7c. server clock ----------
-- Milliseconds since epoch on the DB server. The room uses it to align every
-- device's clock, so a member's live "studying for" time is identical on
-- everyone's screen even if their phone clocks disagree.
create or replace function gt_server_time() returns bigint
language sql stable as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint; $$;
revoke all on function gt_server_time() from public;
grant execute on function gt_server_time() to authenticated;

-- ---------- 8. lists ----------
-- Public list with member counts. Counts are computed here (security
-- definer) so the lobby doesn't need read access to everybody's membership.
create or replace function gt_list_public_groups()
returns table(id uuid, name text, member_count bigint, is_member boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.name,
         (select count(*) from study_group_members m where m.group_id = g.id) as member_count,
         exists (select 1 from study_group_members m where m.group_id = g.id and m.user_id = auth.uid()) as is_member,
         g.created_at
  from study_groups g
  where g.is_public
  order by member_count desc, g.name asc;
$$;
revoke all on function gt_list_public_groups() from public;
grant execute on function gt_list_public_groups() to authenticated;

-- Every group (public or private) the caller belongs to.
create or replace function gt_my_groups()
returns table(id uuid, name text, is_public boolean, join_code text, created_by uuid, member_count bigint, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.is_public, g.join_code, g.created_by,
         (select count(*) from study_group_members m2 where m2.group_id = g.id) as member_count,
         g.created_at
  from study_groups g
  join study_group_members m on m.group_id = g.id and m.user_id = auth.uid()
  order by m.joined_at desc;
$$;
revoke all on function gt_my_groups() from public;
grant execute on function gt_my_groups() to authenticated;

-- ---------- 9. starter public rooms ----------
-- A few open rooms so the public list isn't empty on day one. created_by is
-- null (system rooms), so they never auto-delete. Rename/delete freely from
-- the SQL editor. Re-running this file won't duplicate them.
insert into study_groups (name, is_public, created_by)
select v.name, true, null
from (values
  ('Open Study Hall'),
  ('Physics Focus'),
  ('Chemistry Focus'),
  ('Maths Focus')
) as v(name)
where not exists (select 1 from study_groups g where g.is_public and g.name = v.name);
