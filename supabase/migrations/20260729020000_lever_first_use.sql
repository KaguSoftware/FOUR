-- Backdate a lever to its first use.
--
-- `levers.created_at` defaults to `now()`, which is right for a lever someone
-- adds by hand and wrong for every row this schema created on their behalf.
-- The custom-levers migration backfilled the table from existing `entries`, so
-- levers that had been in use for months were all stamped with the moment the
-- migration ran.
--
-- That is invisible until something asks how many levers existed on a past day.
-- `leversOn()` counts spans containing the date, finds none for any day before
-- the stamp, and falls back to its floor of 1 — so a day where you logged one
-- of two levers came out as one of ONE, and rendered fully lit. The symptom is
-- distinctive: recent days correct, everything before the stamp maxed out.
--
-- An entry is proof the lever existed. Whatever `created_at` says, a lever with
-- an entry on some day was there that day, so the earlier of the two wins.

update public.levers l
   set created_at = e.first_used
  from (
    select user_id,
           lever,
           -- Midnight UTC of the first day it was logged. `created_at` is only
           -- ever read as a DATE by the grid, so the time component is noise.
           min(logged_for)::timestamptz as first_used
      from public.entries
     group by user_id, lever
  ) e
 where e.user_id = l.user_id
   and e.lever   = l.key
   and e.first_used < l.created_at;

-- Levers with no entries keep their real creation date: nothing proves they
-- existed earlier, and dating them back would dim past days that genuinely had
-- fewer levers.

comment on column public.levers.created_at is
  'When the lever started counting — backdated to its first entry where one exists, because an entry proves it was there. With archived_at it forms the window the day grid shades against.';
