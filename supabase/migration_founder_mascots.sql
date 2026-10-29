-- ============================================================
-- Migration: founder-only mascots (lion, dragon, axolotl)
-- ============================================================
-- Safe to re-run (idempotent) — same pattern as every other
-- migration in this folder. Requires migration_founder_tag.sql
-- to have been run first (that's where the 'founder' role and
-- get_founder_ids() come from).
--
-- What this adds:
--   • is_founder(uid) — the missing one-role check. The existing
--     helpers deliberately fold founder into broader powers
--     (is_admin / is_moderator both return true for a founder),
--     so neither of them can answer "is this person *specifically*
--     a founder", which is what mascot access keys off.
--   • A BEFORE UPDATE/INSERT trigger on `profiles` that rejects
--     setting `mascot` to a founder-only species unless the owner
--     of that row actually holds the founder role.
--
-- Why a trigger and not just RLS: the existing profiles policy is
-- a plain "you may update your own row", and RLS can't express
-- "you may update this row, but not to *these* values" without
-- rewriting that policy into something much easier to get wrong.
-- A trigger is also the only thing that covers the row-owner case
-- properly — the client hiding the two buttons stops an honest
-- user, but anyone can send a PATCH with mascot=lion straight to
-- PostgREST using their own token. This is where that request
-- actually dies.
--
-- Note it validates against the *row owner*, not auth.uid(), so a
-- service-role script or an admin panel can't accidentally hand a
-- founder skin to a member either.
-- ============================================================

-- ---------- 1. the strict founder-only check ----------
create or replace function is_founder(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role = 'founder');
$$;
revoke all on function is_founder(uuid) from public;
grant execute on function is_founder(uuid) to authenticated;

-- ---------- 2. which species are locked ----------
-- Kept as a function rather than a table so it stays in lockstep
-- with MASCOTS in src/data/mascots.js with one obvious place to
-- edit. If you add a fourth founder mascot, add it here too.
create or replace function founder_only_mascots() returns text[]
language sql immutable as $$
  select array['lion', 'dragon', 'axolotl']::text[];
$$;

-- ---------- 3. reject the update at the door ----------
create or replace function enforce_founder_mascot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Only care when the incoming value is actually a locked species.
  if new.mascot is null or not (new.mascot = any (founder_only_mascots())) then
    return new;
  end if;

  -- Let an unchanged value through untouched. Without this, a founder
  -- whose role was later revoked could never update *any* other field
  -- on their profile (name, daily goal, theme...) because every one of
  -- those updates carries their existing mascot along with it.
  if tg_op = 'UPDATE' and old.mascot is not distinct from new.mascot then
    return new;
  end if;

  if not is_founder(new.user_id) then
    raise exception 'mascot "%" is reserved for StudyBun founders', new.mascot
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trg_enforce_founder_mascot on profiles;
create trigger trg_enforce_founder_mascot
  before insert or update of mascot on profiles
  for each row execute function enforce_founder_mascot();

-- ---------- 4. sanity check (optional, run by hand) ----------
-- Confirms the lock is live. The first should return the founders'
-- rows only; the second should raise check_violation.
--   select p.user_id, p.name, p.mascot from profiles p where p.mascot in ('lion','dragon','axolotl');
--   update profiles set mascot = 'lion' where user_id = '<some-member-uuid>';
