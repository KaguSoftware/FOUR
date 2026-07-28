-- Custom levers.
--
-- Replaces the hardcoded gym/food pair with up to four user-defined levers.
-- The uptime rule is UNCHANGED: a day is up if ANY one lever fired. Four levers
-- means four ways to keep the system up, not four things to fail at.
--
-- The central design is a stable `key` plus a freely renameable `label`.
-- `entries.lever` stores the key, so renaming "gym" to "training" keeps six
-- months of history. Archiving hides the button and keeps every row, so nothing
-- a user does today can make a past day worse.
--
-- ORDER MATTERS in this file: create, backfill, then constrain. Adding the
-- foreign keys before the backfill would fail on every existing row.

-- ---------------------------------------------------------------------------
-- levers
-- ---------------------------------------------------------------------------
create table if not exists public.levers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- Stable. Generated from the label once, then never changed.
  key        text not null check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(key) <= 32),
  -- Free to change. What the button says.
  label      text not null check (length(btrim(label)) between 1 and 24),
  position   int  not null check (position between 1 and 4),
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);

-- At most four ACTIVE levers, enforced structurally rather than in app code.
-- Archived rows drop out of the index, so archiving frees its slot.
create unique index if not exists levers_user_position_idx
  on public.levers (user_id, position)
  where archived = false;

create index if not exists levers_user_active_idx
  on public.levers (user_id, archived, position);

alter table public.levers enable row level security;

drop policy if exists levers_owner on public.levers;
create policy levers_owner on public.levers
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Backfill, BEFORE any foreign key exists.
--
-- Sourced from entries and playbook together: a user may have logged a lever
-- without ever adding a playbook item, or added one and never logged it. Both
-- must produce a lever row or the foreign keys below will not validate.
-- ---------------------------------------------------------------------------
insert into public.levers (user_id, key, label, position)
select
  s.user_id,
  s.lever                                  as key,
  s.lever                                  as label,
  row_number() over (
    partition by s.user_id
    -- Preserve the order the UI has always shown: gym, then food, then any
    -- unexpected value alphabetically so the result is deterministic.
    order by case s.lever when 'gym' then 0 when 'food' then 1 else 2 end, s.lever
  )::int                                   as position
from (
  select user_id, lever from public.entries
  union
  select user_id, lever from public.playbook
) as s
on conflict (user_id, key) do nothing;

-- Anyone with a system_state row but no levers at all — an account that signed
-- up and never logged — gets the historical default pair, so the dashboard is
-- never a screen with no buttons on it.
insert into public.levers (user_id, key, label, position)
select st.user_id, v.key, v.label, v.position
from public.system_state st
cross join (values ('gym', 'gym', 1), ('food', 'food', 2)) as v(key, label, position)
where not exists (select 1 from public.levers l where l.user_id = st.user_id)
on conflict (user_id, key) do nothing;

-- ---------------------------------------------------------------------------
-- Now the constraints can be moved.
-- ---------------------------------------------------------------------------
alter table public.entries  drop constraint if exists entries_lever_check;
alter table public.playbook drop constraint if exists playbook_lever_check;

-- The CHECK constraints above were created inline, so their generated names
-- vary by Postgres version. Drop any remaining CHECK on those columns by name
-- discovered at runtime.
do $$
declare
  c record;
begin
  for c in
    select rel.relname as table_name, con.conname as constraint_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname in ('entries', 'playbook')
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%lever%'
  loop
    execute format('alter table public.%I drop constraint %I', c.table_name, c.constraint_name);
  end loop;
end $$;

-- Point both tables at the lever set. Composite, so a user can never reference
-- another user's lever.
--
-- `no action`, NOT `restrict`, and the difference is load-bearing. Both refuse
-- to orphan a row, but RESTRICT checks immediately while NO ACTION defers to
-- the end of the statement. Deleting an auth.users row cascades to `levers`
-- and `entries` in one statement with no guaranteed order between them — under
-- RESTRICT that raises as soon as levers goes first, which would break
-- in-app account deletion, and Apple requires that to work. NO ACTION sees
-- both gone by the end of the statement and passes.
--
-- It still refuses an accidental hard delete of a lever that has entries, which
-- is the protection worth having: levers are archived, never removed.
alter table public.entries
  drop constraint if exists entries_lever_fk;
alter table public.entries
  add constraint entries_lever_fk
  foreign key (user_id, lever) references public.levers (user_id, key)
  on update cascade on delete no action;

alter table public.playbook
  drop constraint if exists playbook_lever_fk;
alter table public.playbook
  add constraint playbook_lever_fk
  foreign key (user_id, lever) references public.levers (user_id, key)
  on update cascade on delete no action;

-- ---------------------------------------------------------------------------
-- system_state: mobile columns
-- ---------------------------------------------------------------------------
alter table public.system_state
  -- Expo push token. Nulled when Expo reports DeviceNotRegistered.
  add column if not exists push_token text,
  add column if not exists push_platform text
    check (push_platform is null or push_platform in ('ios', 'android')),
  -- How the system talks to you. Never changes what counts as up, any number,
  -- or the escalation thresholds — see PRODUCT.md.
  add column if not exists posture text not null default 'strict'
    check (posture in ('strict', 'soft')),
  -- Null until first run completes, which is how the app knows to onboard.
  add column if not exists onboarded_at timestamptz,
  -- Opt-in daily reminder, scheduled on-device. Null means off, which is the
  -- default: the monitor is a pager, not a nag.
  add column if not exists daily_reminder_at time;

-- Existing accounts predate onboarding and already have levers, so mark them
-- done rather than showing a setup flow to someone mid-run.
update public.system_state
   set onboarded_at = coalesce(onboarded_at, now())
 where onboarded_at is null;

-- ---------------------------------------------------------------------------
-- New-user bootstrap: no more seeded gym/food.
--
-- Onboarding writes the user's real levers, so seeding a pair here would put
-- two levers they never chose behind whatever they pick. The playbook starts
-- empty too — the lever sheet always offers "just mark it up", so an empty
-- playbook is a working screen rather than a blocked one.
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

  return new;
end $$;
