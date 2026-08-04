-- ---------------------------------------------------------------------------
-- The day boundary, per account.
--
-- The day rolls over at 04:00, not midnight, so a 01:30 session belongs to the
-- day that just ended rather than the one that technically started. That hour
-- was a constant in two independent places — `DAY_BOUNDARY_HOUR` in
-- packages/core and `interval '4 hours'` inside `logical_date()` here — and
-- both had to agree or the pager fires on a different day than the one on
-- screen.
--
-- It becomes a setting. 4 stays the default, and every existing account keeps
-- it, so nothing about a current install changes.
--
-- TWO THINGS THIS MIGRATION IS CAREFUL ABOUT
--
-- 1. **History is never re-dated.** `entries.logged_for` is already a stored
--    date, decided by whichever boundary was in force when it was written. It
--    is not recomputed from a timestamp, so moving this setting cannot reach
--    backwards and change which day a past session belongs to — and therefore
--    cannot move uptime, a run, or an outage. That is the whole reason the
--    boundary is stored per entry going forward (`entries.boundary_hour`
--    below) rather than being read live: a figure this product has already
--    shown must not be renegotiable. Owner's call, 2026-08-04.
--
-- 2. **`logical_date()` keeps its old signature working.** The monitor calls
--    it, and a deployed monitor must not break the moment this lands. The
--    hour is a second parameter with a default of 4, so every existing call
--    site behaves exactly as before.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- The setting
-- ---------------------------------------------------------------------------
alter table public.system_state
  add column if not exists day_boundary_hour int not null default 4;

-- 0 is midnight — a real choice, and the one people expect if they have never
-- thought about it. 12 is the far end of anything defensible: past noon the
-- "day" stops matching the word. Anything outside that is a bug in a client,
-- not a preference.
alter table public.system_state
  drop constraint if exists system_state_day_boundary_hour_check;

alter table public.system_state
  add constraint system_state_day_boundary_hour_check
  check (day_boundary_hour between 0 and 12);

-- ---------------------------------------------------------------------------
-- What each entry was filed under
--
-- Written by the client at log time and never updated. Nothing derives uptime
-- from it — `logged_for` remains the only thing any reader keys off — but it
-- makes a past day self-describing, so "why is this session on that day"
-- always has an answer, and a future migration could re-date history correctly
-- if that ever became something the owner wanted.
--
-- Existing rows get 4 because that is genuinely the boundary they were logged
-- under; it is the only value that has ever existed.
-- ---------------------------------------------------------------------------
alter table public.entries
  add column if not exists boundary_hour int not null default 4;

-- ---------------------------------------------------------------------------
-- The server's own clock, now per user
--
-- Same shape as before with the hour parameterised. The monitor resolves it
-- from `system_state` per user, so the pager and the phone agree.
--
-- **The old one-argument version has to be DROPPED, not replaced.** Postgres
-- identifies a function by its argument types, so `create or replace` with an
-- extra parameter creates a SECOND function rather than updating the first.
-- Both would then have a valid single-argument form via the defaults, and
-- every existing `logical_date('Europe/Istanbul')` call — the monitor's —
-- would fail with "function is not unique" rather than picking one. Caught by
-- `npm run test:migrations`, which is exactly the class of thing it exists for.
--
-- `stable`, `language sql` and the `tz` default are otherwise unchanged from
-- the Istanbul-defaulted version in 20260719010000.
-- ---------------------------------------------------------------------------
drop function if exists public.logical_date(text);

create or replace function public.logical_date(
  tz text default 'Europe/Istanbul',
  boundary_hour int default 4
)
returns date
language sql
stable
as $$
  select ((now() at time zone tz) - make_interval(hours => boundary_hour))::date;
$$;
