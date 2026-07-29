-- Reorderable levers.
--
-- Adds nothing to the data model. `position` already meant "which slot this
-- lever sits in"; this makes it possible to CHANGE it, which the previous
-- schema quietly forbade.
--
-- The obstacle was the constraint, not the column. `levers_user_position_idx`
-- is a plain partial unique index, so Postgres validates it row by row, and
-- `position between 1 and 4` means there is no spare slot to park a lever in
-- while its neighbours move. Every possible reorder — as two statements, or as
-- one multi-row UPDATE — passes through a moment where two active levers claim
-- the same position, and a non-deferrable index rejects that moment.
--
-- The fix is a DEFERRABLE constraint. EXCLUDE is the only constraint type that
-- takes both a partial WHERE and DEFERRABLE, so the uniqueness is checked once
-- at COMMIT and the transient collision in the middle is nobody's business.
--
-- THE FOUR-LEVER CAP IS UNCHANGED and is still structural, not app code:
-- `position between 1 and 4` plus uniqueness of position among active rows
-- still means at most four active levers. Only *when* the uniqueness is
-- checked has moved.

-- EXCLUDE with the `=` operator on scalar types needs GiST support for those
-- types, which is what btree_gist provides.
create extension if not exists btree_gist;

alter table public.levers
  drop constraint if exists levers_user_position_excl;

drop index if exists public.levers_user_position_idx;

alter table public.levers
  add constraint levers_user_position_excl
  exclude using gist (user_id with =, position with =)
  where (archived = false)
  deferrable initially deferred;

comment on constraint levers_user_position_excl on public.levers is
  'At most four ACTIVE levers, one per slot. DEFERRABLE so a reorder can pass through a transient collision; see reorder_levers().';

-- ---------------------------------------------------------------------------
-- reorder_levers
--
-- `security invoker`, so RLS still decides which rows are visible and writable
-- — the function is a way to make several writes atomic, never a way around
-- the policy. The `auth.uid()` filter is belt-and-braces on top of that.
--
-- Archived levers are excluded rather than renumbered: an archived lever keeps
-- its old position and drops out of the constraint, and touching it here would
-- resurrect it into a slot someone is using.
-- ---------------------------------------------------------------------------
create or replace function public.reorder_levers(p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  n int := coalesce(array_length(p_ids, 1), 0);
begin
  if n = 0 then
    return;
  end if;

  if n > 4 then
    raise exception 'four levers is the maximum';
  end if;

  -- Reject a partial order outright. Renumbering three of four levers leaves
  -- the fourth on a position one of the three now wants, and the deferred
  -- constraint would fail at COMMIT with an error pointing nowhere useful.
  if n <> (
    select count(*)
      from public.levers
     where user_id = auth.uid()
       and archived = false
       and id = any (p_ids)
  ) then
    raise exception 'reorder must name every active lever exactly once';
  end if;

  update public.levers l
     set position = o.ord
    from unnest(p_ids) with ordinality as o(id, ord)
   where l.id = o.id
     and l.user_id = auth.uid()
     and l.archived = false;
end $$;

revoke all on function public.reorder_levers(uuid[]) from public;
grant execute on function public.reorder_levers(uuid[]) to authenticated;
