-- ============================================================
-- Migration: lion mascot unlocked for moderators too
-- ============================================================
-- Run AFTER migration_founder_mascots.sql and
-- migration_moderator_role.sql. Idempotent — safe to re-run.
--
-- migration_founder_mascots.sql locked lion/dragon/axolotl to founders
-- via founder_only_mascots() + the enforce_founder_mascot trigger. This
-- carves lion out of that: it now also accepts a moderator, while
-- dragon and axolotl stay exactly as founder-only as before. Keep this
-- in lockstep with `unlockedFor` on MASCOTS.lion in src/data/mascots.js
-- if you ever change which species this applies to.
-- ============================================================

-- ---------- 1. lion leaves the strict founder-only list ----------
create or replace function founder_only_mascots() returns text[]
language sql immutable as $$
  select array['dragon', 'axolotl']::text[];
$$;

-- ---------- 2. the moderator-unlockable list (currently just lion) ----------
create or replace function mod_unlockable_mascots() returns text[]
language sql immutable as $$
  select array['lion']::text[];
$$;

-- ---------- 3. widen the trigger to check both lists ----------
-- Same shape as the original enforce_founder_mascot: only cares about
-- incoming values that are actually locked, lets an unchanged value
-- through so a role change never blocks unrelated profile edits, and
-- validates against the row owner (new.user_id) rather than auth.uid()
-- so a service-role script can't slip a locked mascot onto someone else.
create or replace function enforce_founder_mascot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.mascot is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.mascot is not distinct from new.mascot then
    return new;
  end if;

  if new.mascot = any (mod_unlockable_mascots()) then
    if is_founder(new.user_id) or is_moderator(new.user_id) then
      return new;
    end if;
    raise exception 'mascot "%" is reserved for StudyBun founders and moderators', new.mascot
      using errcode = 'check_violation';
  end if;

  if new.mascot = any (founder_only_mascots()) then
    if is_founder(new.user_id) then
      return new;
    end if;
    raise exception 'mascot "%" is reserved for StudyBun founders', new.mascot
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

-- Trigger already exists from migration_founder_mascots.sql; the
-- CREATE OR REPLACE on the function above is enough, no need to
-- recreate `trg_enforce_founder_mascot` itself.

-- ---------- 4. sanity check (optional, run by hand) ----------
--   -- should succeed for a moderator, fail for a plain member:
--   update profiles set mascot = 'lion' where user_id = '<some-mod-uuid>';
--   -- should still fail for a moderator (dragon/axolotl stay founder-only):
--   update profiles set mascot = 'dragon' where user_id = '<some-mod-uuid>';
