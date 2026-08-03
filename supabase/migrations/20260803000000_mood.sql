-- The mood reading.
--
-- Replaces the two 1-5 scales (energy, sleep) with a single continuous slider
-- that lives on Home rather than on a screen you had to navigate to. See
-- packages/core/mood.ts.
--
-- NOTHING IS DROPPED HERE, and that is deliberate on two counts:
--
--   1. A shipped TestFlight build still selects `energy`, `sleep`, `note` and
--      `weight`. Deploys and migrations do not land together, so a column or
--      kind removed today breaks whatever version is currently installed on
--      someone's phone. Same sequencing rule as the posture drop.
--   2. Those rows are real history. They still render in the day sheet, where
--      they were written. A reading stops being COLLECTED; it does not stop
--      having happened.
--
-- The dead kinds ('ease', 'lift') and the retired ones can go in a later
-- migration, once no installed client reads them.

-- ---------------------------------------------------------------------------
-- The new kind
-- ---------------------------------------------------------------------------
alter table public.signals
  drop constraint if exists signals_kind_check;

alter table public.signals
  add constraint signals_kind_check
  check (kind in ('energy', 'sleep', 'ease', 'lift', 'note', 'weight', 'mood'));

-- ---------------------------------------------------------------------------
-- The value range, which is now per-kind
-- ---------------------------------------------------------------------------
-- `value` was `int check (value between 1 and 5)` — the felt-state scale. A
-- continuous slider stores 1..100, which that constraint rejects outright.
--
-- The bound is split by kind rather than simply widened to 1..100, because a
-- widened bound would silently accept an `energy` of 87: a row that is not on
-- the scale anything reads it against, and no reader would ever notice. The
-- 1-5 kinds keep their old, honest bound.
alter table public.signals
  drop constraint if exists signals_value_check;

-- The original CHECK was written inline on the column, so it carries the
-- column-constraint name Postgres generated rather than the one above.
alter table public.signals
  drop constraint if exists signals_value_check1;

do $$
declare c text;
begin
  -- Whatever the inline constraint ended up being called, find it by the
  -- column it guards and drop it. Naming it by hand would work on this
  -- database and fail on a rebuild from scratch.
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public'
       and rel.relname = 'signals'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%value%between 1 and 5%'
  loop
    execute format('alter table public.signals drop constraint %I', c);
  end loop;
end $$;

alter table public.signals
  add constraint signals_value_check
  check (
    value is null
    or (kind = 'mood' and value between 1 and 100)
    or (kind <> 'mood' and value between 1 and 5)
  );

-- ---------------------------------------------------------------------------
-- Shape
-- ---------------------------------------------------------------------------
-- A mood row carries `value` and no `amount`, like the scales it replaces. The
-- existing shape check already says `else amount is null`, which covers it —
-- restated here so the whole rule reads in one place rather than being half in
-- the weight migration.
alter table public.signals
  drop constraint if exists signals_shape_check;

alter table public.signals
  add constraint signals_shape_check
  check (
    case
      when kind = 'weight' then amount is not null and value is null
      when kind = 'note'   then true
      when kind = 'mood'   then amount is null
      else amount is null
    end
  );
