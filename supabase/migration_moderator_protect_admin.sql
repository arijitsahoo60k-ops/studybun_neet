-- ============================================================
-- Migration: fix moderator canDelete blind spot for the admin tier
-- ============================================================
-- Run AFTER migration_moderator_role.sql. Idempotent — safe to re-run.
--
-- Bug: get_role_ids() (added in migration_moderator_role.sql) returns
-- founders and moderators only — admin was left out on purpose, since
-- there is no badge for it and nobody is currently granted that role.
-- But the client's canDelete() (src/hooks/useCommunityModeration.js)
-- used that same founders list to decide whether to even attempt a
-- delete, and the actual RLS boundary — is_mod_protected() — protects
-- admin AND founder. If an admin (not also a founder) ever posted
-- something, a moderator's UI would offer the Delete button (author
-- not in the founders list, so canDelete said yes) and the request
-- would then be silently refused by RLS. Latent, not currently
-- triggerable (no admin role is granted to anyone today per
-- migration_founder_tag.sql's own notes), but worth closing now rather
-- than after the role is ever used.
--
-- Fix: get_role_ids() gains a third key, `protected`, which is exactly
-- is_mod_protected's own set (admin ∪ founder) — reusing that function
-- rather than re-deriving the query keeps the two permanently in sync.
-- It carries no badge and isn't rendered anywhere; it exists purely so
-- the client's permission check matches the server's.
-- ============================================================

create or replace function get_role_ids() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'founders', coalesce(
      (select jsonb_agg(user_id) from user_roles where role = 'founder'),
      '[]'::jsonb
    ),
    'moderators', coalesce(
      (select jsonb_agg(user_id) from user_roles where role = 'moderator'),
      '[]'::jsonb
    ),
    'protected', coalesce(
      (select jsonb_agg(user_id) from user_roles where role in ('admin', 'founder')),
      '[]'::jsonb
    )
  );
$$;
revoke all on function get_role_ids() from public;
grant execute on function get_role_ids() to authenticated;
