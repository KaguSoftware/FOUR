-- When a lever was archived, so the grid can ask what a PAST day looked like.
--
-- The day grid shades a cell by `fired / leverCount`, and `leverCount` was
-- whatever the account has active *right now*. That made history rewrite
-- itself: add a third lever today and every day you had ever logged two of two
-- drops from fully lit to two thirds, retroactively, for a decision you made
-- afterwards. Uptime and every number were always immune to this — they key on
-- dates, never on lever identity — but the picture of the month was not, and
-- the picture is what people actually look at.
--
-- `created_at` already told us when a lever started counting. This adds the
-- other end, so a day's denominator is "levers that existed on that day".
--
-- Archiving still does not alter a past day, which was already a product
-- guarantee: a lever archived today was active for every day before today, and
-- the window below says so.

alter table public.levers
  add column if not exists archived_at timestamptz;

comment on column public.levers.archived_at is
  'When `archived` flipped true. Maintained by trigger; do not set by hand. With created_at it forms the window used to shade past days.';

-- Existing archived rows have no record of when it happened. `now()` is the
-- only defensible guess and it errs the safe way: those levers count as active
-- for all of history, so no already-drawn day gets dimmer than it was.
update public.levers
   set archived_at = now()
 where archived = true and archived_at is null;

-- ---------------------------------------------------------------------------
-- Keep the flag and the stamp in agreement, in the database rather than in
-- three clients.
--
-- `archived` stays the source of truth for "is this lever offered today" — the
-- partial exclusion constraint and every active-lever query already key on it.
-- This only stamps the timestamp alongside, so no app code has to remember,
-- and un-archiving (which nothing exposes yet) cannot leave a stale date
-- behind that would silently shorten the lever's life.
-- ---------------------------------------------------------------------------
create or replace function public.stamp_lever_archived()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.archived and not coalesce(old.archived, false) then
    new.archived_at := now();
  elsif not new.archived then
    new.archived_at := null;
  end if;
  return new;
end $$;

drop trigger if exists levers_stamp_archived on public.levers;
create trigger levers_stamp_archived
  before insert or update of archived on public.levers
  for each row execute function public.stamp_lever_archived();
