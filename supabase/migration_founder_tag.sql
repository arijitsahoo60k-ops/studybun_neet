-- ============================================================
-- Migration: Founder role + badge
-- ============================================================
-- Safe to re-run (idempotent) — same pattern as the other
-- migrations in this folder.
--
-- What this adds:
--   • A new 'founder' role value on top of the existing
--     user/moderator/admin tiers in `user_roles`. Founder implies
--     every admin/moderator permission (delete any post/comment/
--     message, etc. — nothing else to wire up, the existing RLS
--     policies already key off `is_moderator()`/`is_admin()`).
--   • `get_founder_ids()` — a tiny public-facing RPC that returns
--     just the user_ids with role = 'founder', so the client can
--     render the small "Founder" badge next to their name on the
--     Leaderboard and in Community. This is meant to be visible to
--     everyone (that's the point of the badge), so it's fine that
--     it's callable by any signed-in user — it leaks nothing beyond
--     "these are the founders", same info the badge itself shows.
--   • Same as every other role change: there is still NO insert/
--     update policy on `user_roles` for the client. Granting the
--     founder role only happens below, run by you with the SQL
--     editor / service role — never from the app.
-- ============================================================

-- ---------- 1. widen the role check to allow 'founder' ----------
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'user_roles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%in%';
  if cname is not null then
    execute format('alter table user_roles drop constraint %I', cname);
  end if;
  alter table user_roles
    add constraint user_roles_role_check check (role in ('user', 'moderator', 'admin', 'founder'));
end $$;

-- ---------- 2. founder gets full admin/mod powers ----------
create or replace function is_moderator(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role in ('moderator', 'admin', 'founder'));
$$;
revoke all on function is_moderator(uuid) from public;
grant execute on function is_moderator(uuid) to authenticated;

create or replace function is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role in ('admin', 'founder'));
$$;
revoke all on function is_admin(uuid) from public;
grant execute on function is_admin(uuid) to authenticated;

-- ---------- 3. public lookup so the client can render the badge ----------
create or replace function get_founder_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(user_id), array[]::uuid[]) from user_roles where role = 'founder';
$$;
revoke all on function get_founder_ids() from public;
grant execute on function get_founder_ids() to authenticated;

-- ---------- 4. grant it to Poco + Astha ----------
-- Run this first to get your two user_ids (adjust the names if your
-- `profiles.name` doesn't exactly match what's in the app):
--   select user_id, name from profiles where name in ('Poco', 'Astha');
-- Then paste the two ids in place of the placeholders below and run it.
-- Safe to re-run — upserts, doesn't duplicate rows.
--
-- insert into user_roles (user_id, role) values
--   ('11111111-1111-1111-1111-111111111111', 'founder'),
--   ('22222222-2222-2222-2222-222222222222', 'founder')
-- on conflict (user_id) do update set role = excluded.role;
