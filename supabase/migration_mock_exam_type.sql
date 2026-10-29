-- ============================================================
-- Migration: NEET UG & Custom Exam support on Mock Tests
-- ============================================================
-- Safe to run on an existing StudyBun database — every statement here
-- is idempotent (add column if not exists), so re-running it is harmless.
-- Skip this file entirely on a brand new install; supabase/schema.sql
-- already includes all of these columns.
-- ============================================================

alter table mock_tests add column if not exists exam_type text not null default 'NEET UG';
alter table mock_tests add column if not exists input_mode text default 'counts';

-- Drop any legacy JEE-only check constraint so NEET UG and Custom exams work natively
alter table mock_tests drop constraint if exists mock_tests_exam_type_check;

alter table mock_tests add column if not exists biology_marks numeric default 0;
alter table mock_tests add column if not exists botany_marks numeric default 0;
alter table mock_tests add column if not exists zoology_marks numeric default 0;
alter table mock_tests add column if not exists biology_correct numeric;
alter table mock_tests add column if not exists biology_incorrect numeric;
alter table mock_tests add column if not exists botany_correct numeric;
alter table mock_tests add column if not exists botany_incorrect numeric;
alter table mock_tests add column if not exists zoology_correct numeric;
alter table mock_tests add column if not exists zoology_incorrect numeric;
alter table mock_tests add column if not exists physics_correct numeric;
alter table mock_tests add column if not exists physics_incorrect numeric;
alter table mock_tests add column if not exists chemistry_correct numeric;
alter table mock_tests add column if not exists chemistry_incorrect numeric;
alter table mock_tests add column if not exists math_correct numeric;
alter table mock_tests add column if not exists math_incorrect numeric;
alter table mock_tests add column if not exists biology_minutes numeric;
alter table mock_tests add column if not exists botany_minutes numeric;
alter table mock_tests add column if not exists zoology_minutes numeric;
