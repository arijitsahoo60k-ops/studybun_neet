-- ============================================================
-- Migration: Retry idempotency for point-earning inserts
-- ============================================================
-- Safe to run on an existing StudyBun database — ADD COLUMN here is
-- nullable with no default, so it's a metadata-only change (no table
-- rewrite, no lock held on existing rows), and the unique indexes are
-- created with IF NOT EXISTS.
--
-- THE GAP THIS CLOSES:
-- The client-side Retry button added for study_sessions/timer_sessions/
-- question_logs/mock_tests re-sends the exact same insert payload when a
-- save appears to fail. That's correct when the server genuinely rejected
-- the write. But if the original insert actually committed server-side and
-- only the client's response was lost (connection dropped right after
-- commit), the client still shows "failed", and Retry would create a
-- second, genuinely duplicate row — which lb_recompute() then legitimately
-- counts, inflating that user's score by one duplicate entry.
--
-- THE FIX:
-- Each of these 4 tables gets a nullable `client_token` column. The app
-- generates one random token per logical attempt (not per network call) and
-- sends it with the insert; a Retry reuses the SAME token rather than
-- minting a new one. A plain (non-partial) unique index on
-- (user_id, client_token) then makes the write idempotent: Postgres treats
-- NULL as never equal to NULL, so old rows (client_token is null) and any
-- caller that doesn't pass a token are completely unaffected — uniqueness
-- only ever applies to two rows that both carry the same real token, which
-- only happens when a retry targets a write that already exists.
--
-- The app's insert() upserts with onConflict on (user_id, client_token)
-- when a token is supplied, so a genuine retry-after-silent-success now
-- updates the existing row in place (to the same values) and returns it,
-- instead of inserting a duplicate.
-- ============================================================

alter table study_sessions add column if not exists client_token uuid;
alter table timer_sessions add column if not exists client_token uuid;
alter table question_logs  add column if not exists client_token uuid;
alter table mock_tests     add column if not exists client_token uuid;

create unique index if not exists idx_study_sessions_user_token on study_sessions(user_id, client_token);
create unique index if not exists idx_timer_sessions_user_token on timer_sessions(user_id, client_token);
create unique index if not exists idx_question_logs_user_token  on question_logs(user_id, client_token);
create unique index if not exists idx_mock_tests_user_token     on mock_tests(user_id, client_token);
