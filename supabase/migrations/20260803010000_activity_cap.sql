-- Activities: ten per lever, and the ceiling ARCHIVES rather than raising.
--
-- Playbook rows could only ever be created — written as a side effect of
-- logging a lever with a detail, never renamed, never removed, never counted.
-- The list grew without bound behind a picker that only ever showed three, and
-- a typo lived forever. This is the database half of making them editable.
--
-- ⚠ THE TRIGGER MUST NEVER `raise`. The mobile client writes every entry
-- through an offline outbox, and `isPermanent` in
-- apps/mobile/src/lib/outbox.ts treats SQLSTATE 23xxx as unrecoverable: a
-- constraint violation moves that queued tap to the dead-letter list, where it
-- never retries. A raising cap would therefore convert "you already have ten
-- activities" into "the day you logged in the gym is gone", which is the exact
-- failure the whole product exists to prevent. Archiving is silent, reversible,
-- and cannot cost anyone a day.

-- ---------------------------------------------------------------------------
-- 0. Make deleting an activity possible at all
-- ---------------------------------------------------------------------------
-- `entries_playbook_fk` is composite — `(user_id, playbook_id)` references
-- `playbook (user_id, id)` — with a bare `on delete set null`, which nulls
-- EVERY referencing column. `entries.user_id` is `not null`, so the cascade
-- fails its own constraint and the delete is refused:
--
--   null value in column "user_id" of relation "entries" violates not-null
--
-- Nothing hit it before because nothing had ever deleted a playbook row. The
-- composite key was added to stop an entry borrowing another user's activity,
-- and that intent is right; only the referential action is wrong. Postgres 15
-- added a column list on SET NULL, which says exactly what was meant: forget
-- the pointer, keep the row and its owner.
alter table public.entries drop constraint if exists entries_playbook_fk;

alter table public.entries add constraint entries_playbook_fk
  foreign key (user_id, playbook_id)
  references public.playbook (user_id, id)
  on delete set null (playbook_id);

-- ---------------------------------------------------------------------------
-- 1. The ranking index, matching what `rankActivities` actually orders by
-- ---------------------------------------------------------------------------
-- Partial on `archived = false`, because every reader filters on it and a
-- retired row has no business in the index the picker reads.
drop index if exists public.playbook_rank_idx;

create index if not exists playbook_rank_idx
  on public.playbook (user_id, lever, is_pinned desc, use_count desc, last_used_at desc nulls last)
  where archived = false;

-- ---------------------------------------------------------------------------
-- 2. Retire pre-existing excess
-- ---------------------------------------------------------------------------
-- So the editor opens on a list that already obeys its own rule. Ranked by the
-- same order the app ranks by, so what survives is what the picker was already
-- showing.
with ranked as (
  select id,
         row_number() over (
           partition by user_id, lever
           order by is_pinned desc, use_count desc, last_used_at desc nulls last, created_at desc
         ) as rn
    from public.playbook
   where archived = false
)
update public.playbook p
   set archived = true
  from ranked r
 where p.id = r.id
   and r.rn > 10;

-- ---------------------------------------------------------------------------
-- 3. The ceiling
-- ---------------------------------------------------------------------------
create or replace function public.cap_playbook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  over int;
begin
  -- Archiving something never pushes a list over its own limit.
  if new.archived then
    return new;
  end if;

  -- How many would be over the line once this row is counted. `id <> new.id`
  -- so an UPDATE that merely un-archives a row does not count itself twice.
  select count(*) - (10 - 1)
    into over
    from public.playbook
   where user_id = new.user_id
     and lever = new.lever
     and archived = false
     and id <> new.id;

  if over > 0 then
    update public.playbook
       set archived = true
     where id in (
       select id
         from public.playbook
        where user_id = new.user_id
          and lever = new.lever
          and archived = false
          and id <> new.id
        -- The mirror of the ranking order: least entrenched goes first.
        -- Pinned rows sort last, so one is only ever retired when there is
        -- literally nothing else left.
        order by is_pinned asc, use_count asc, last_used_at asc nulls first, created_at asc
        limit over
     );
  end if;

  return new;
end $$;

comment on function public.cap_playbook() is
  'Ten active activities per lever. Archives the least-used rather than raising: a rejected insert comes back through the mobile outbox as a permanent failure and would dead-letter the entry it was attached to.';

drop trigger if exists playbook_cap on public.playbook;

create trigger playbook_cap
  before insert or update of archived, lever on public.playbook
  for each row execute function public.cap_playbook();
