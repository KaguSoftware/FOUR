-- Optional weight.
--
-- Amends the original "no weight, no calories" rule, deliberately and narrowly.
-- Weight is OFF by default, and when switched on it is recorded and plotted and
-- nothing else: no goal, no target, no "X above/below", no BMI, no
-- interpretation of the trend. It is a number the user chose to keep, never a
-- score the product keeps on them.
--
-- Critically it is stored in `signals`, not `entries`. `entries` is the only
-- thing uptime derives from, so a weight reading is structurally incapable of
-- making a day up or down. That separation is the guarantee, not a convention.

-- ---------------------------------------------------------------------------
-- signals: allow the new kind
-- ---------------------------------------------------------------------------
alter table public.signals
  drop constraint if exists signals_kind_check;

alter table public.signals
  add constraint signals_kind_check
  check (kind in ('energy', 'sleep', 'ease', 'lift', 'note', 'weight'));

-- `value` is an int 1..5 for the felt-state scales, which cannot hold 78.4kg.
-- Weight gets its own column rather than overloading that one, so the 1..5
-- constraint stays honest for every scalar that is actually a 1..5 scale.
alter table public.signals
  add column if not exists amount numeric(6, 2);

-- A weight row carries `amount` and no `value`; a scale row is the reverse.
-- Enforced so a malformed row cannot reach the readers.
alter table public.signals
  drop constraint if exists signals_shape_check;

alter table public.signals
  add constraint signals_shape_check
  check (
    case
      when kind = 'weight' then amount is not null and value is null
      when kind = 'note'   then true
      else amount is null
    end
  );

-- ---------------------------------------------------------------------------
-- system_state: the opt-in switch
-- ---------------------------------------------------------------------------
alter table public.system_state
  add column if not exists weight_enabled boolean not null default false,
  -- Display only. Never converted, never used in a calculation — the stored
  -- number is whatever the user typed, in whatever unit they picked.
  add column if not exists weight_unit text not null default 'kg'
    check (weight_unit in ('kg', 'lb'));

-- Turning the feature off must not destroy data. `weight_enabled = false`
-- hides the field and the chart; the rows stay, so switching back on restores
-- the history rather than starting from nothing.
