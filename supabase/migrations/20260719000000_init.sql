-- personal-system — uptime monitor for one body
--
-- Design note: uptime, runs and outages are DERIVED from `entries`.
-- There is deliberately no streak counter anywhere in this schema, because a
-- stored counter is a thing that can be reset to zero, and "back to zero" is
-- the exact failure mode this app exists to prevent. `runs` and `outages` are
-- materialised views of the gaps in `entries`, not sources of truth.

-- ---------------------------------------------------------------------------
-- entries: the only real data
-- ---------------------------------------------------------------------------
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  logged_for  date not null,
  lever       text not null check (lever in ('gym', 'food')),
  detail      text,
  playbook_id uuid,
  created_at  timestamptz not null default now(),
  -- One gym + one food per day. Re-tapping a lever is idempotent, not a dupe.
  unique (user_id, logged_for, lever)
);

create index if not exists entries_user_date_idx
  on public.entries (user_id, logged_for desc);

-- ---------------------------------------------------------------------------
-- playbook: what already worked. Surfaced during re-entry so a restart is
-- reopening a file, never a blank page.
-- ---------------------------------------------------------------------------
create table if not exists public.playbook (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  lever        text not null check (lever in ('gym', 'food')),
  label        text not null,
  use_count    int  not null default 0,
  last_used_at timestamptz,
  is_pinned    boolean not null default false,
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (user_id, lever, label)
);

create index if not exists playbook_rank_idx
  on public.playbook (user_id, lever, is_pinned desc, use_count desc);

alter table public.entries
  add constraint entries_playbook_fk
  foreign key (playbook_id) references public.playbook (id) on delete set null;

-- ---------------------------------------------------------------------------
-- system_state: single row per user, the operator's control panel
-- ---------------------------------------------------------------------------
create table if not exists public.system_state (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  timezone          text not null default 'Europe/Berlin',
  slammed_until     date,
  telegram_chat_id  text,
  last_paged_on     date,
  last_paged_level  int,
  last_plateau_on   date,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- runs / outages: derived from gaps in `entries`, cached for display.
-- A completed run keeps its final length forever — that is what lets the UI
-- say "last run: 31 days" instead of showing a zero.
-- ---------------------------------------------------------------------------
create table if not exists public.runs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  started_on date not null,
  ended_on   date,
  days       int not null,
  unique (user_id, started_on)
);

create table if not exists public.outages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  started_on date not null,
  ended_on   date,
  days       int not null,
  note       text,
  unique (user_id, started_on)
);

-- ---------------------------------------------------------------------------
-- milestones: fired-once ledger. The primary key IS the "once ever" rule, so
-- a double-firing cron cannot double-send.
-- ---------------------------------------------------------------------------
create table if not exists public.milestones (
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         text not null,
  first_hit_on date not null,
  notified_at  timestamptz,
  primary key (user_id, kind)
);

-- ---------------------------------------------------------------------------
-- signals: weekly felt-state samples. Never daily — a daily obligation is the
-- first thing that gets cut. Nothing here ever affects uptime.
-- ---------------------------------------------------------------------------
create table if not exists public.signals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  observed_on date not null,
  kind        text not null check (kind in ('energy', 'sleep', 'ease', 'lift', 'note')),
  value       int check (value between 1 and 5),
  detail      text,
  created_at  timestamptz not null default now(),
  unique (user_id, observed_on, kind)
);

create index if not exists signals_user_date_idx
  on public.signals (user_id, observed_on desc);

-- ---------------------------------------------------------------------------
-- monitor_runs: the monitor is the feature that cannot silently fail. Every
-- cron pass is logged so "why didn't it page me" always has an answer.
-- ---------------------------------------------------------------------------
create table if not exists public.monitor_runs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  ran_on     date not null,
  down_days  int not null,
  action     text not null,
  detail     text,
  created_at timestamptz not null default now()
);

create index if not exists monitor_runs_user_date_idx
  on public.monitor_runs (user_id, ran_on desc);

-- ---------------------------------------------------------------------------
-- Logical "today": the day boundary is 04:00 local, so a 01:30 session counts
-- for the day it feels like rather than the one the calendar says.
-- ---------------------------------------------------------------------------
create or replace function public.logical_date(tz text default 'Europe/Berlin')
returns date
language sql
stable
as $$
  select ((now() at time zone tz) - interval '4 hours')::date;
$$;

-- ---------------------------------------------------------------------------
-- Row level security: single user today, but scoped properly anyway.
-- ---------------------------------------------------------------------------
alter table public.entries      enable row level security;
alter table public.playbook     enable row level security;
alter table public.system_state enable row level security;
alter table public.runs         enable row level security;
alter table public.outages      enable row level security;
alter table public.milestones   enable row level security;
alter table public.signals      enable row level security;
alter table public.monitor_runs enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'entries', 'playbook', 'system_state', 'runs',
    'outages', 'milestones', 'signals', 'monitor_runs'
  ]
  loop
    execute format(
      'drop policy if exists %I_owner on public.%I', t, t
    );
    execute format(
      'create policy %I_owner on public.%I
         for all
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- New user bootstrap: system_state row + the two known-good levers, so the
-- playbook is never an empty page.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.system_state (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.playbook (user_id, lever, label, is_pinned)
  values
    (new.id, 'food', 'shake @ lunch', true),
    (new.id, 'gym',  'treadmill + 2 machines', true)
  on conflict (user_id, lever, label) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
