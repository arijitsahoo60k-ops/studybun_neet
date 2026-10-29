-- Adds "why did I get this wrong" tagging to question_logs, in the same
-- spirit as backlog_items.reason -- lets the Question Practice page surface
-- *why* accuracy is low (silly mistakes vs. real concept gaps vs. running
-- out of time), not just the raw percentage.
--
-- Safe to run multiple times; both columns are nullable so every existing
-- row (and every quick-log entry that skips accuracy tracking) is
-- unaffected.

alter table question_logs
  add column if not exists mistake_tag text,        -- Silly Mistake, Concept Gap, Calculation Error, Time Pressure, Guessed Wrong, Custom
  add column if not exists mistake_tag_custom text;  -- free text when mistake_tag = 'Custom'
