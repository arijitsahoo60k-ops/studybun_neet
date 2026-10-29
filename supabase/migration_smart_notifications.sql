-- ============================================================
-- StudyBun · Smart Notification Architecture
-- Run once in your Supabase project's SQL editor (safe to run
-- standalone against an existing DB — everything is `if not exists`).
--
-- This adds the tables the server-side Vercel cron pipeline needs to:
--   1. know which devices to push to (push_subscriptions)
--   2. know whether/when a user wants pushes (notification_prefs)
--   3. avoid double-sending + give you an audit trail (notification_log)
--
-- The actual AI analysis + sending happens in /api/cron/notify.js using
-- the Supabase SERVICE ROLE key (server-side only, never shipped to the
-- client) — that key bypasses RLS by design, which is exactly what a
-- background job that reads *every* user's data needs. RLS below still
-- fully protects these tables from the browser/anon key.
-- ============================================================

-- ---------- PUSH SUBSCRIPTIONS (Web Push endpoints, one per device) ----------
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now()
);
create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;
drop policy if exists "user access" on push_subscriptions;
create policy "user access" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- NOTIFICATION PREFERENCES (per user, per time-of-day slot) ----------
create table if not exists notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  morning boolean not null default true,   -- ~8:30am IST — plan the day
  afternoon boolean not null default true, -- ~2:30pm IST — midday nudge / check-in
  evening boolean not null default true,   -- ~8:30pm IST — wrap-up / revision reminder
  timezone text not null default 'Asia/Kolkata',
  updated_at timestamptz default now()
);

alter table notification_prefs enable row level security;
drop policy if exists "user access" on notification_prefs;
create policy "user access" on notification_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- NOTIFICATION SEND LOG (dedup guard + audit trail) ----------
create table if not exists notification_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot text not null,                 -- morning | afternoon | evening | test
  send_date date not null default current_date, -- IST calendar date, set by the server
  title text,
  body text,
  model_used text,
  status text not null default 'sent', -- sent | skipped_no_subs | skipped_disabled | ai_failed_used_fallback | error
  error text,
  created_at timestamptz default now(),
  unique (user_id, slot, send_date) -- hard guard: never send the same slot twice in one day
);
create index if not exists idx_notification_log_user on notification_log(user_id, send_date desc);

alter table notification_log enable row level security;
drop policy if exists "user read own log" on notification_log;
-- Users may read their own send history (e.g. a "notification activity" list in
-- Settings) but can never insert/update/delete it themselves — only the
-- service-role cron job writes here, which bypasses RLS entirely.
create policy "user read own log" on notification_log
  for select using (auth.uid() = user_id);

-- ---------- keep updated_at fresh on notification_prefs ----------
create or replace function touch_notification_prefs() returns trigger
language plpgsql as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists trg_touch_notification_prefs on notification_prefs;
create trigger trg_touch_notification_prefs
  before update on notification_prefs
  for each row execute function touch_notification_prefs();
