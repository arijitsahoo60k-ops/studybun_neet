-- ============================================================
-- Migration: Group Timer v2 — room stats / leaderboard / goal, host
-- controls, real roster
-- ============================================================
-- Run AFTER migration_group_timer.sql. Additive + idempotent: safe on
-- production, safe to re-run. It never touches timer_sessions or any
-- leaderboard table/function — the personal leaderboard is untouched.
--
-- ===================== THE ROOM HOURS RULE (v1) =====================
-- This text is mirrored word-for-word in the app (GT_RULES in
-- src/lib/groupTimer.js, shown under "How are hours counted?") and a test
-- keeps the two in sync. Change both together.
--
--  1. SOURCE. Only saved Focus Timer sessions (timer_sessions) count —
--     rows the server wrote. Live presence ("studying now") is
--     client-supplied and NEVER feeds a number.
--  2. WHICH SESSIONS. completed = true and 0 < actual_minutes <= 600
--     (600 is the database's own single-session ceiling). Any length
--     counts, even 1 minute — minute for minute, no minimum, no bonus
--     points, no multipliers.
--  3. WHOSE MINUTES, FROM WHEN. A session counts for a room if it was
--     saved while the person was a member of that room — wherever they
--     started it. Joining starts counting; leaving/removal stops it.
--     Minutes already earned stay in the room's totals when someone
--     leaves (nothing is ever taken back); the leaderboard lists current
--     members only.
--  4. DAY BOUNDARY. Indian Standard Time (Asia/Kolkata), the same day
--     boundary as the app's streak and the global leaderboard. A session
--     belongs to the IST day it was saved on — exactly one day, exactly
--     one week, never two.
--  5. DAILY CEILING. At most 780 min (13 h) per person per IST day count
--     — the same ceiling the global leaderboard uses. This is the ONLY
--     thing that can ever stop a saved minute from counting.
--  6. PERIODS. today = today's IST date · week = Monday–Sunday (IST) ·
--     last_week = the Mon–Sun before it · all = since the room started
--     counting your membership.
--  7. RANKING. By exact minutes in the period (rounded only for display,
--     once, at the end). Equal minutes share the same rank (1,1,3).
--     Listing order on ties: more sessions, then earlier joiner.
--  8. ROOM STREAK. A day is a "room day" if at least one member's counted
--     minutes that day is >= 10 (the app's genuine-study-day threshold).
--     The streak is the run of consecutive room days ending today — or
--     ending yesterday if today has none yet, so it never shows broken
--     before the day is over.
--  9. ROOM GOAL. Host-set weekly target in hours. Progress = this week's
--     room total (including minutes from members who've since left) /
--     goal. The recap compares last week against the goal as currently set.
-- ====================================================================

-- ---------- 1. new columns on study_groups ----------
alter table study_groups add column if not exists description text;
alter table study_groups add column if not exists rules text;
alter table study_groups add column if not exists goal_hours int;
alter table study_groups add column if not exists focus_lock boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'study_groups_description_len') then
    alter table study_groups add constraint study_groups_description_len
      check (description is null or char_length(description) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'study_groups_rules_len') then
    alter table study_groups add constraint study_groups_rules_len
      check (rules is null or char_length(rules) <= 600);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'study_groups_goal_range') then
    alter table study_groups add constraint study_groups_goal_range
      check (goal_hours is null or (goal_hours between 1 and 10000));
  end if;
end $$;

-- ---------- 2. stints: who was a member, and when ----------
-- One row per continuous membership. This is what lets a member's earlier
-- minutes stay in the room's totals after they leave, and lets a rejoin
-- start a clean new stint (the gap in between never counts).
create table if not exists study_group_stints (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);
create unique index if not exists uq_study_group_open_stint
  on study_group_stints(group_id, user_id) where left_at is null;
create index if not exists idx_study_group_stints_user on study_group_stints(user_id, joined_at);
alter table study_group_stints enable row level security;   -- no policies: functions only

-- Existing members (from before this migration) get an open stint dated from
-- when they actually joined. Re-running adds nothing.
insert into study_group_stints (group_id, user_id, joined_at)
select m.group_id, m.user_id, m.joined_at
from study_group_members m
where not exists (
  select 1 from study_group_stints s where s.group_id = m.group_id and s.user_id = m.user_id and s.left_at is null
);

create table if not exists study_group_bans (
  group_id uuid not null references study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  banned_at timestamptz not null default now(),
  banned_by uuid references auth.users(id) on delete set null,
  primary key (group_id, user_id)
);
alter table study_group_bans enable row level security;     -- no policies: functions only

-- ---------- 3. host helper ----------
-- Host = the group's creator while still a member, or any founder/mod.
-- Seeded rooms (created_by null) are therefore hosted by founders/mods only.
create or replace function is_study_group_host(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    is_moderator(auth.uid())
    or exists (
      select 1 from study_groups g
      where g.id = gid and g.created_by = auth.uid() and is_study_group_member(g.id)
    )
  );
$$;
revoke all on function is_study_group_host(uuid) from public;
grant execute on function is_study_group_host(uuid) to authenticated;

-- ---------- 4. replace v1 membership functions (stints + bans) ----------
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
      if attempt >= 8 then raise exception 'Could not generate a join code, try again.'; end if;
    end;
  end loop;
  insert into study_group_members (group_id, user_id) values (row_out.id, uid) on conflict do nothing;
  insert into study_group_stints (group_id, user_id) values (row_out.id, uid) on conflict do nothing;
  return row_out;
end;
$$;

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
  if exists (select 1 from study_group_bans where group_id = g.id and user_id = uid) then
    raise exception 'You can''t join this group.';
  end if;
  if not exists (select 1 from study_group_members where group_id = g.id and user_id = uid) then
    select count(*) into n from study_group_members where group_id = g.id;
    if n >= gt_group_cap(true) then raise exception 'This group is full.'; end if;
    insert into study_group_members (group_id, user_id) values (g.id, uid) on conflict do nothing;
  end if;
  insert into study_group_stints (group_id, user_id) values (g.id, uid) on conflict do nothing;
  select * into g from study_groups where id = p_group_id;
  return g;
end;
$$;

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
  -- same wording as a wrong code: a banned person learns nothing about the room
  if exists (select 1 from study_group_bans where group_id = g.id and user_id = uid) then
    raise exception 'No group found with that code.';
  end if;
  if not exists (select 1 from study_group_members where group_id = g.id and user_id = uid) then
    select count(*) into n from study_group_members where group_id = g.id;
    if n >= gt_group_cap(false) then raise exception 'This group is full.'; end if;
    insert into study_group_members (group_id, user_id) values (g.id, uid) on conflict do nothing;
  end if;
  insert into study_group_stints (group_id, user_id) values (g.id, uid) on conflict do nothing;
  return g;
end;
$$;

-- Leaving closes your stint (your earned minutes stay in the room's totals).
-- If the creator leaves and others remain, hosting passes to whoever has been
-- a member longest, so a room is never left without a host.
create or replace function gt_leave_group(p_group_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  left_over int;
  heir uuid;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  delete from study_group_members where group_id = p_group_id and user_id = uid;
  update study_group_stints set left_at = now()
    where group_id = p_group_id and user_id = uid and left_at is null;
  select count(*) into left_over from study_group_members where group_id = p_group_id;
  if left_over = 0 then
    delete from study_groups where id = p_group_id and created_by is not null;
  else
    select user_id into heir from study_group_members where group_id = p_group_id order by joined_at asc, user_id limit 1;
    update study_groups set created_by = heir where id = p_group_id and created_by = uid;
  end if;
end;
$$;

-- ---------- 5. host controls ----------
create or replace function gt_update_group(
  p_group_id uuid, p_name text, p_description text, p_rules text, p_goal_hours int
) returns study_groups
language plpgsql security definer set search_path = public as $$
declare
  clean_name text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  clean_desc text := nullif(trim(coalesce(p_description, '')), '');
  clean_rules text := nullif(trim(coalesce(p_rules, '')), '');
  row_out study_groups;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if not is_study_group_host(p_group_id) then raise exception 'Only the host can change this.'; end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 40 then
    raise exception 'Group name must be 2–40 characters.';
  end if;
  if clean_desc is not null and char_length(clean_desc) > 200 then
    raise exception 'Description can be up to 200 characters.';
  end if;
  if clean_rules is not null and char_length(clean_rules) > 600 then
    raise exception 'Rules can be up to 600 characters.';
  end if;
  if p_goal_hours is not null and (p_goal_hours < 1 or p_goal_hours > 10000) then
    raise exception 'Weekly goal must be between 1 and 10000 hours.';
  end if;
  update study_groups
     set name = clean_name, description = clean_desc, rules = clean_rules, goal_hours = p_goal_hours
   where id = p_group_id
  returning * into row_out;
  if not found then raise exception 'That group does not exist any more.'; end if;
  return row_out;
end;
$$;
revoke all on function gt_update_group(uuid, text, text, text, int) from public;
grant execute on function gt_update_group(uuid, text, text, text, int) to authenticated;

create or replace function gt_set_focus_lock(p_group_id uuid, p_locked boolean)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if not is_study_group_host(p_group_id) then raise exception 'Only the host can change this.'; end if;
  update study_groups set focus_lock = coalesce(p_locked, false) where id = p_group_id;
  if not found then raise exception 'That group does not exist any more.'; end if;
  return coalesce(p_locked, false);
end;
$$;
revoke all on function gt_set_focus_lock(uuid, boolean) from public;
grant execute on function gt_set_focus_lock(uuid, boolean) to authenticated;

-- A leaked code stops working the instant a new one is made. People already
-- inside are unaffected (they just see the new code).
create or replace function gt_regenerate_code(p_group_id uuid)
returns study_groups
language plpgsql security definer set search_path = public as $$
declare
  g study_groups;
  attempt int := 0;
  row_out study_groups;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if not is_study_group_host(p_group_id) then raise exception 'Only the host can change this.'; end if;
  select * into g from study_groups where id = p_group_id;
  if not found then raise exception 'That group does not exist any more.'; end if;
  if g.is_public then raise exception 'Public groups have no join code.'; end if;
  loop
    attempt := attempt + 1;
    begin
      update study_groups set join_code = gt_make_code() where id = p_group_id returning * into row_out;
      exit;
    exception when unique_violation then
      if attempt >= 8 then raise exception 'Could not generate a join code, try again.'; end if;
    end;
  end loop;
  return row_out;
end;
$$;
revoke all on function gt_regenerate_code(uuid) from public;
grant execute on function gt_regenerate_code(uuid) to authenticated;

-- Remove (and optionally ban) a member. The host / any founder-mod can't be
-- removed, and you can't remove yourself (use Leave). Earned minutes stay in
-- the room's totals — the stint is closed, not deleted.
create or replace function gt_kick_member(p_group_id uuid, p_user_id uuid, p_ban boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g study_groups;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if not is_study_group_host(p_group_id) then raise exception 'Only the host can remove members.'; end if;
  select * into g from study_groups where id = p_group_id;
  if not found then raise exception 'That group does not exist any more.'; end if;
  if p_user_id = uid then raise exception 'Use Leave group to leave yourself.'; end if;
  if p_user_id = g.created_by or is_moderator(p_user_id) then
    raise exception 'You can''t remove the host.';
  end if;
  if not exists (select 1 from study_group_members where group_id = p_group_id and user_id = p_user_id) then
    raise exception 'That person is not in this group.';
  end if;
  delete from study_group_members where group_id = p_group_id and user_id = p_user_id;
  update study_group_stints set left_at = now()
    where group_id = p_group_id and user_id = p_user_id and left_at is null;
  if coalesce(p_ban, false) then
    insert into study_group_bans (group_id, user_id, banned_by) values (p_group_id, p_user_id, uid)
    on conflict (group_id, user_id) do nothing;
  end if;
end;
$$;
revoke all on function gt_kick_member(uuid, uuid, boolean) from public;
grant execute on function gt_kick_member(uuid, uuid, boolean) to authenticated;

create or replace function gt_unban_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if not is_study_group_host(p_group_id) then raise exception 'Only the host can change this.'; end if;
  delete from study_group_bans where group_id = p_group_id and user_id = p_user_id;
end;
$$;
revoke all on function gt_unban_member(uuid, uuid) from public;
grant execute on function gt_unban_member(uuid, uuid) to authenticated;

create or replace function gt_group_bans(p_group_id uuid)
returns table(user_id uuid, banned_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_study_group_host(p_group_id) then raise exception 'Only the host can see this.'; end if;
  return query select b.user_id, b.banned_at from study_group_bans b where b.group_id = p_group_id order by b.banned_at desc;
end;
$$;
revoke all on function gt_group_bans(uuid) from public;
grant execute on function gt_group_bans(uuid) to authenticated;

-- ---------- 6. roster (offline members too) ----------
-- Every CURRENT member with their last-studied time. Members and hosts only.
-- Raises 'not a member' for everyone else — the client uses that to notice
-- it has been removed.
create or replace function gt_group_roster(p_group_id uuid)
returns table(user_id uuid, joined_at timestamptz, is_host boolean, last_studied_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if not (is_study_group_member(p_group_id) or is_study_group_host(p_group_id)) then
    raise exception 'You are not a member of this group.';
  end if;
  return query
    select m.user_id, m.joined_at,
           (m.user_id = g.created_by or is_moderator(m.user_id)) as is_host,
           (select max(ts.created_at) from timer_sessions ts
             where ts.user_id = m.user_id and ts.completed is true
               and ts.actual_minutes > 0 and ts.actual_minutes <= 600) as last_studied_at
    from study_group_members m
    join study_groups g on g.id = m.group_id
    where m.group_id = p_group_id
    order by m.joined_at asc, m.user_id;
end;
$$;
revoke all on function gt_group_roster(uuid) from public;
grant execute on function gt_group_roster(uuid) to authenticated;

-- ---------- 7. stats / leaderboard / goal / streak (the rule above) ----------
create or replace function gt_group_stats(p_group_id uuid, p_range text default 'week')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Kolkata')::date;
  wk_start date := (now() at time zone 'Asia/Kolkata')::date
                   - (extract(isodow from (now() at time zone 'Asia/Kolkata')::date)::int - 1);
  d_from date;
  d_to date;
  g study_groups;
  result jsonb;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  select * into g from study_groups where id = p_group_id;
  if not found then raise exception 'That group does not exist any more.'; end if;
  if not is_study_group_member(p_group_id) then raise exception 'Join this group to see its stats.'; end if;

  if p_range = 'today' then d_from := today; d_to := today;
  elsif p_range = 'week' then d_from := wk_start; d_to := wk_start + 6;
  elsif p_range = 'last_week' then d_from := wk_start - 7; d_to := wk_start - 1;
  elsif p_range = 'all' then d_from := null; d_to := null;
  else raise exception 'Unknown range.';
  end if;

  -- One statement, no temp tables (this function is STABLE / read-only).
  -- pd: one row per (member, IST day) = every counted session inside that
  -- member's stints, summed, then capped at 780 min  (rules 2-5).
  with pd as (
    select s.user_id, s.d, least(sum(s.m), 780) as m, count(*) as n
    from (
      select ts.user_id,
             (ts.created_at at time zone 'Asia/Kolkata')::date as d,
             ts.actual_minutes::numeric as m
      from study_group_stints st
      join timer_sessions ts
        on ts.user_id = st.user_id
       and ts.created_at >= st.joined_at
       and (st.left_at is null or ts.created_at < st.left_at)
      where st.group_id = p_group_id
        and ts.completed is true
        and ts.actual_minutes > 0 and ts.actual_minutes <= 600
    ) s
    group by s.user_id, s.d
  ),
  win as (
    select * from pd where (d_from is null or d >= d_from) and (d_to is null or d <= d_to)
  ),
  tot as (
    select coalesce(sum(m), 0) as minutes, coalesce(sum(n), 0) as sessions,
           count(distinct user_id) filter (where m > 0) as active
    from win
  ),
  brd as (
    select coalesce(jsonb_agg(jsonb_build_object(
             'user_id', b.user_id, 'minutes', round(b.minutes, 4),
             'sessions', b.sessions, 'rank', b.rnk
           ) order by b.minutes desc, b.sessions desc, b.joined_at asc, b.user_id), '[]'::jsonb) as j
    from (
      select mm.user_id, mm.joined_at,
             coalesce(pu.minutes, 0) as minutes, coalesce(pu.sessions, 0) as sessions,
             rank() over (order by coalesce(pu.minutes, 0) desc) as rnk
      from study_group_members mm
      left join (
        select user_id, sum(m) as minutes, sum(n) as sessions from win group by user_id
      ) pu on pu.user_id = mm.user_id
      where mm.group_id = p_group_id
    ) b
  ),
  dly as (
    select coalesce(jsonb_agg(jsonb_build_object('date', x.d, 'minutes', round(x.m, 4)) order by x.d), '[]'::jsonb) as j
    from (select d, sum(m) as m from win group by d) x
  ),
  -- Room streak (rule 8): over ALL history, independent of the range asked for.
  anc as (
    select case when exists (select 1 from pd where d = today and m >= 10) then today else today - 1 end as a
  ),
  stk as (
    select count(*) as c from (
      select z.d, row_number() over (order by z.d desc) as rn
      from (select distinct d from pd where m >= 10 and d <= (select a from anc)) z
    ) y
    where (select a from anc) - y.d = y.rn - 1
  )
  select jsonb_build_object(
    'rule_version', 'v1',
    'range', p_range,
    'from', d_from, 'to', d_to,
    'total_minutes', round((select minutes from tot), 4),
    'total_sessions', (select sessions from tot),
    'active_members', (select active from tot),
    'members_count', (select count(*) from study_group_members where group_id = p_group_id),
    'goal_hours', g.goal_hours,
    'streak_days', (select c from stk),
    'board', (select j from brd),
    'daily', (select j from dly)
  ) into result;

  return result;
end;
$$;
revoke all on function gt_group_stats(uuid, text) from public;
grant execute on function gt_group_stats(uuid, text) to authenticated;
