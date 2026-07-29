-- In-app account deletion, as an RPC.
--
-- Apple requires it (Guideline 5.1.1(v)): an app with account creation must
-- offer account deletion, in the app, not via a support email. The schema has
-- been ready for this since the custom-levers migration — the migration
-- harness caught an `on delete restrict` that would have blocked the cascade,
-- and it was changed to `no action` for exactly this moment.
--
-- Why an RPC and not a client-side delete: RLS lets a user touch their own
-- rows in public tables, but `auth.users` is not theirs to delete — only the
-- service role can. A `security definer` function is the narrow bridge: it
-- runs as its owner, deletes exactly one row, and the row it deletes is taken
-- from the caller's own JWT. There is no parameter, so there is nothing to
-- get wrong and nothing to aim at someone else.
--
-- Everything else goes with the row: every table references auth.users with
-- `on delete cascade`, and entries → levers is `no action` (checked at
-- statement end), so the whole account leaves in one statement. This is
-- deletion, not archiving — the one place in the product where "never deletes"
-- gives way, because the data belongs to the user and they asked for it gone.

create or replace function public.delete_own_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

comment on function public.delete_own_account() is
  'Deletes the calling user''s auth row; every public table cascades from it. No parameters on purpose: the target comes from the JWT, so it can only ever be yourself.';

-- Functions are executable by PUBLIC unless told otherwise. This one is for
-- signed-in users only: anon gets nothing to probe, and the service role does
-- not need a grant to keep its powers.
revoke execute on function public.delete_own_account() from public;
revoke execute on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;
