-- Integrity hardening.
--
-- Everything here closes a gap where the database was trusting the client to
-- behave. Each one was reachable from a normal signed-in session, and three of
-- them could quietly corrupt what the product claims never to get wrong: the
-- audit trail, the once-ever ledger, and the day a tap belongs to.
--
-- Ordered so every data cleanup happens BEFORE the constraint that would
-- reject it. `supabase db push` is not reversible and there is no Docker here,
-- so `npm run test:migrations` (PGlite) is the only pre-flight — run it.

-- ---------------------------------------------------------------------------
-- 1. The audit log and the milestone ledger stop being user-writable.
--
-- `init.sql` created every policy as `for all`, which is right for the tables
-- that hold a user's own content. It is wrong for these two, and in opposite
-- directions:
--
--   * `monitor_runs` is the answer to "why didn't it page me". A record the
--     subject can edit or delete is not a record.
--   * `milestones` IS the once-ever rule — the primary key is the mechanism.
--     Deleting a row re-arms a milestone that is documented as firing once in
--     a lifetime, which is the closest thing this product has to a score.
--
-- Reads stay open: both feed the UI. Writes belong to the monitor, which uses
-- the service role and bypasses RLS entirely, so nothing legitimate breaks.
-- ---------------------------------------------------------------------------

drop policy if exists monitor_runs_owner on public.monitor_runs;
create policy monitor_runs_read on public.monitor_runs
  for select using (auth.uid() = user_id);

drop policy if exists milestones_owner on public.milestones;
create policy milestones_read on public.milestones
  for select using (auth.uid() = user_id);

comment on table public.monitor_runs is
  'Append-only from the client''s point of view: readable by its owner, written only by the monitor via the service role. "Why didn''t it page me" must have an answer the subject cannot edit.';

-- ---------------------------------------------------------------------------
-- 2. `entries.detail` gets the cap the app has always claimed it had.
--
-- `DETAIL_MAX = 160` lives in @uptime/core and is enforced by `appendDetail`,
-- but both write paths bypassed it — web wrote `detail.trim()` and the mobile
-- outbox wrote `detail` — into a bare `text` column. Existing rows are
-- truncated first so the constraint can be added without a rewrite failing.
-- ---------------------------------------------------------------------------

update public.entries
   set detail = left(detail, 160)
 where detail is not null and length(detail) > 160;

alter table public.entries drop constraint if exists entries_detail_len;
alter table public.entries add constraint entries_detail_len
  check (detail is null or length(detail) <= 160);

-- The playbook label is the same class of value and had the same gap.
update public.playbook
   set label = left(label, 80)
 where length(label) > 80;

alter table public.playbook drop constraint if exists playbook_label_len;
alter table public.playbook add constraint playbook_label_len
  check (length(btrim(label)) between 1 and 80);

-- ---------------------------------------------------------------------------
-- 3. Weight gets real bounds.
--
-- `signals_shape_check` only ever checked null-ness, so `amount` accepted
-- negatives and anything up to numeric(6,2)'s 9999.99. The 1..999 clamp lived
-- only in the two clients. Weight is opt-in, never affects uptime, and is
-- never interpreted — but it is plotted, and one absurd value rescales the
-- whole chart and hides the actual line.
-- ---------------------------------------------------------------------------

update public.signals
   set amount = least(greatest(amount, 1), 999)
 where amount is not null and (amount < 1 or amount > 999);

alter table public.signals drop constraint if exists signals_amount_range;
alter table public.signals add constraint signals_amount_range
  check (amount is null or (amount >= 1 and amount <= 999));

-- ---------------------------------------------------------------------------
-- 4. `entries.playbook_id` can no longer point at someone else's row.
--
-- The lever foreign key was deliberately made composite — `(user_id, lever)`
-- → `levers(user_id, key)` — so a crafted write could not borrow another
-- account's lever. `playbook_id` was left referencing `playbook(id)` alone,
-- and RLS does not close it: `with check (auth.uid() = user_id)` validates the
-- entry's own owner, never the owner of the row it references.
-- ---------------------------------------------------------------------------

-- Orphan any cross-user reference already present before tightening.
update public.entries e
   set playbook_id = null
  from public.playbook p
 where e.playbook_id = p.id
   and p.user_id <> e.user_id;

-- The composite target needs its own unique key. `id` is already the primary
-- key, so this is redundant as a constraint and required as an FK target.
alter table public.playbook drop constraint if exists playbook_user_id_key;
alter table public.playbook add constraint playbook_user_id_key
  unique (user_id, id);

alter table public.entries drop constraint if exists entries_playbook_id_fkey;
alter table public.entries drop constraint if exists entries_playbook_fk;
alter table public.entries add constraint entries_playbook_fk
  foreign key (user_id, playbook_id)
  references public.playbook (user_id, id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- 5. One monitor row per user per day.
--
-- The pass is idempotent through `system_state.last_paged_on`, but the audit
-- insert was unguarded, so a re-invoked or manually triggered pass appended a
-- second row for the same day. Duplicates are collapsed to the most recent
-- before the index goes on.
-- ---------------------------------------------------------------------------

delete from public.monitor_runs a
 using public.monitor_runs b
 where a.user_id = b.user_id
   and a.ran_on = b.ran_on
   and (a.created_at, a.id) < (b.created_at, b.id);

alter table public.monitor_runs drop constraint if exists monitor_runs_user_day;
alter table public.monitor_runs add constraint monitor_runs_user_day
  unique (user_id, ran_on);

-- ---------------------------------------------------------------------------
-- 6. The timezone column defends itself.
--
-- `system_state.timezone` is plain `text` with no constraint and is written
-- straight from the device by the mobile client. One unparseable value made
-- `logicalDate` throw inside the monitor's per-user loop, which had no
-- try/catch — so a single bad row ended the pass and every user after it was
-- never evaluated. The pager failed closed, for everyone, because of one
-- person's typo.
--
-- The route now validates and falls back on its own; this is the second layer,
-- and the one that stops the bad value being stored in the first place.
--
-- A CHECK cannot do this: the set of valid zones lives in `pg_timezone_names`,
-- which is a view, and CHECK forbids subqueries. A trigger can. It keeps the
-- previous value rather than raising, because `syncTimeZone` on the client
-- ignores its result — failing loudly there would be failing silently anyway,
-- and a rejected write would leave the column holding something worse.
-- ---------------------------------------------------------------------------

create or replace function public.keep_valid_timezone()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.timezone is null
     or not exists (
       select 1 from pg_catalog.pg_timezone_names where name = new.timezone
     )
  then
    new.timezone := coalesce(old.timezone, 'Europe/Istanbul');
  end if;
  return new;
end;
$$;

comment on function public.keep_valid_timezone() is
  'Rejects an unrecognised IANA zone by keeping the previous one. The monitor derives every user''s logical day from this column, so a junk value here is a paging outage rather than a display bug.';

drop trigger if exists system_state_valid_timezone on public.system_state;
create trigger system_state_valid_timezone
  before insert or update of timezone on public.system_state
  for each row execute function public.keep_valid_timezone();

-- Repair anything already stored that Postgres does not recognise.
update public.system_state
   set timezone = 'Europe/Istanbul'
 where timezone is null
    or not exists (
      select 1 from pg_catalog.pg_timezone_names where name = timezone
    );
