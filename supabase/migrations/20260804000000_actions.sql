-- ---------------------------------------------------------------------------
-- actions: the several things you did on one lever on one day.
--
-- THE PROBLEM
--
-- `entries` is `unique (user_id, logged_for, lever)` — one row per lever per
-- day — and its `detail` is a single free-text string. Logging "treadmill" and
-- then "walk" on the same lever therefore folded the two together into
-- `treadmill · walk` (see `appendDetail` in packages/core/levers.ts). That was
-- deliberate and it is documented as such, but on hardware it reads as the app
-- inventing a thing you never did: one activity with a strange name, rather
-- than the two you actually logged.
--
-- THE SHAPE, AND WHY IT IS A CHILD TABLE
--
-- The alternative was widening the entries key to include `detail`. That was
-- rejected, and the reason is worth writing down because it is not obvious:
--
--   1. **Uptime must not be able to move.** `uptime.ts` derives up-days from
--      `new Set(entries.logged_for)` — DISTINCT DAYS, not row counts. Leaving
--      `entries` at one row per lever per day means every derived figure
--      (uptime, runs, outages, all-time, both grids, the pixel wall) is
--      arithmetically untouched by this migration. A widened key would make
--      "how many rows does this day have" a number that suddenly varies, and
--      every reader would have to be re-audited to prove it did not care.
--
--   2. **The offline outbox key stays as it is.** It is `(logged_for, lever)`
--      with last-write-wins collapsing. Widening it is explicitly flagged in
--      apps/mobile/AGENTS.md as load-bearing: a queued delete flushed after a
--      queued log deletes the row the log just upserted. This migration never
--      opens that.
--
-- NOTHING IS DROPPED, and that is the same sequencing rule the mood and
-- posture migrations followed. A shipped TestFlight build still reads
-- `entries.detail`, and deploys and migrations do not land together, so the
-- clients keep writing `detail` exactly as before. This table is additive and
-- read only by clients that know about it. `entries.detail` can stop being
-- written in a later round, once no installed client reads it.
--
-- NO TIMESTAMPS. Deliberate, and an owner decision (2026-08-04): actions carry
-- no clock time, are not ordered by one, and none is displayed. `position`
-- gives them their order within a day. `created_at` exists because every table
-- here has one for forensics; nothing reads it and nothing should start.
-- ---------------------------------------------------------------------------
create table if not exists public.actions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  logged_for date not null,
  lever      text not null,
  label      text not null check (length(btrim(label)) between 1 and 160),
  -- Order within the day, not a clock time. Assigned by the client as
  -- "one past whatever is already there".
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  -- The same thing twice in one day is a mis-tap, not two facts — which is the
  -- rule `appendDetail` already applied when it collapsed duplicates. Enforcing
  -- it here means the client cannot drift from it.
  unique (user_id, logged_for, lever, label)
);

-- Every read is "the actions for these days", so the day is the leading column
-- after the owner. Matches `entries_user_date_idx`.
create index if not exists actions_user_date_idx
  on public.actions (user_id, logged_for desc);

-- ---------------------------------------------------------------------------
-- RLS, matching every other user-owned table: you see and write your own rows.
-- ---------------------------------------------------------------------------
alter table public.actions enable row level security;

drop policy if exists actions_owner on public.actions;
create policy actions_owner on public.actions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Backfill: split what is already recorded.
--
-- `" · "` has always been the joiner (`appendDetail`), so every existing detail
-- is either one action or several separated by it. Splitting on it recovers the
-- original list exactly.
--
-- `with ordinality` is what gives each part its `position` — the order inside
-- the string is the order they were logged, and it is the only ordering
-- information that exists. Blank parts are dropped rather than becoming empty
-- rows; `on conflict do nothing` covers a detail that already contained the
-- same text twice, which the unique constraint above now forbids.
-- ---------------------------------------------------------------------------
insert into public.actions (user_id, logged_for, lever, label, position)
select
  e.user_id,
  e.logged_for,
  e.lever,
  btrim(part.label),
  part.ord::int
from public.entries e
cross join lateral
  unnest(string_to_array(e.detail, ' · ')) with ordinality as part(label, ord)
where e.detail is not null
  and btrim(part.label) <> ''
on conflict (user_id, logged_for, lever, label) do nothing;
