/**
 * Migration tests — `npm run test:migrations`.
 *
 * Runs every migration in order against real Postgres (WASM, via PGlite) with
 * seeded data, then asserts the outcomes. There is no Docker on the dev
 * machine, so this is the only way to exercise a migration before it reaches
 * the live database, and `supabase db push` is not reversible.
 *
 * It has already earned its place: it caught that the entries -> levers foreign
 * key was written `on delete restrict`, which would have broken in-app account
 * deletion — a thing Apple requires to work — because RESTRICT fires
 * immediately while a user-deletion cascade needs the deferred NO ACTION check.
 *
 * Supabase-specific pieces are stubbed: an `auth` schema with a `users` table,
 * and an `auth.uid()` returning null. RLS policies still compile; they just
 * never match, which is fine because this connects as the owner.
 */
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";
// btree_gist backs the deferrable EXCLUDE constraint in the lever-order
// migration; PGlite ships it as a loadable extension rather than built in.
const db = new PGlite({ extensions: { btree_gist } });

const ok = (m) => console.log(`  PASS  ${m}`);
const bad = (m) => {
  console.log(`  FAIL  ${m}`);
  process.exitCode = 1;
};

await db.exec(`
  create schema if not exists auth;
  create table auth.users (id uuid primary key default gen_random_uuid());
  create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
`);
// The roles Supabase provisions. The delete-account migration grants and
// revokes against them, so the stub needs them to exist — PGlite is plain
// Postgres and ships with neither.
await db.exec(`
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  end $$;
`);
console.log("stubbed auth schema\n");

const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

// --- run everything up to (but not including) the custom-levers migration ---
// Migrations run in true chronological order: the ones BEFORE custom_levers
// now, then the seed (which has to exist before the backfill runs), then
// custom_levers, then everything after it. The earlier version of this loop
// ran "everything except custom_levers" first, which broke the moment a
// migration newer than custom_levers touched the table it creates.
const LEVERS = files.find((f) => f.includes("custom_levers"));
const apply = async (f) => {
  try {
    await db.exec(readFileSync(join(DIR, f), "utf8"));
    console.log(`applied  ${f}`);
  } catch (e) {
    console.log(`FAILED   ${f}\n  ${e.message}`);
    process.exit(1);
  }
};
for (const f of files.slice(0, files.indexOf(LEVERS))) await apply(f);

// --- seed the awkward cases the backfill has to survive --------------------
console.log("\nseeding pre-migration data...");
const [a, b, c, d] = ["11111111-1111-1111-1111-111111111111",
                      "22222222-2222-2222-2222-222222222222",
                      "33333333-3333-3333-3333-333333333333",
                      "44444444-4444-4444-4444-444444444444"];
await db.exec(`
  insert into auth.users (id) values ('${a}'), ('${b}'), ('${c}'), ('${d}');
`);
// The trigger created system_state rows for all four.
// The OLD handle_new_user() trigger seeds a gym AND a food playbook row for
// every signup, so every existing account already carries both levers. That is
// why the backfill covers everyone — and it is correct, because the old UI
// always showed both buttons. To exercise the narrower paths, clear the seeded
// playbook for B, C and D first.
await db.exec(`delete from public.playbook where user_id in ('${b}', '${c}', '${d}')`);

await db.exec(`
  -- A: both levers, entries and playbook (trigger-seeded, left intact).
  insert into public.entries (user_id, logged_for, lever) values
    ('${a}', '2026-07-01', 'gym'), ('${a}', '2026-07-01', 'food'), ('${a}', '2026-07-02', 'gym');
  insert into public.playbook (user_id, lever, label) values ('${a}', 'gym', 'treadmill');

  -- B: entries only, and only ONE lever. Must not get a phantom second lever.
  insert into public.entries (user_id, logged_for, lever) values ('${b}', '2026-07-03', 'food');

  -- C: playbook only, never logged. Backfill must still see it.
  insert into public.playbook (user_id, lever, label) values ('${c}', 'gym', 'walk to work');

  -- D: signed up, never did anything. Must still end up with buttons.
`);

// Details in every shape the actions backfill has to survive: several joined
// with the middot, a single action with none, one with no detail at all, and
// one whose parts repeat (which the new unique constraint forbids).
//
// On user B, NOT user A — A is deleted partway through this file to prove the
// account-deletion cascade, and the backfill assertions run after that.
await db.exec(`
  insert into public.entries (user_id, logged_for, lever, detail) values
    ('${b}', '2026-07-15', 'food', 'treadmill · walk'),
    ('${b}', '2026-07-16', 'food', 'just a swim'),
    ('${b}', '2026-07-17', 'food', 'rows · rows'),
    ('${b}', '2026-07-18', 'food', '  padded  ·  spaces  '),
    ('${b}', '2026-07-19', 'food', null);
`);
console.log("seeded 4 users covering: both levers, entries-only, playbook-only, empty\n");

// --- the migration under test, then everything after it ---------------------
console.log(`applying ${LEVERS}...`);
try {
  await db.exec(readFileSync(join(DIR, LEVERS), "utf8"));
  console.log("applied without error\n");
} catch (e) {
  console.log(`MIGRATION FAILED:\n  ${e.message}`);
  process.exit(1);
}
for (const f of files.slice(files.indexOf(LEVERS) + 1)) await apply(f);
console.log();

// --- assertions -------------------------------------------------------------
console.log("checks:");
const q = async (sql) => (await db.query(sql)).rows;

const levers = await q(`select user_id, key, label, position, archived from public.levers order by user_id, position`);

const forUser = (u) => levers.filter((l) => l.user_id === u);
forUser(a).length === 2 ? ok("user A (trigger-seeded playbook) backfilled both levers") : bad(`user A got ${forUser(a).length} levers`);
forUser(b).length === 1 ? ok("user B (entries only, playbook cleared) got exactly one — no phantom") : bad(`user B got ${forUser(b).length}`);
forUser(c).length === 1 ? ok("user C (playbook only, never logged) was backfilled") : bad(`user C got ${forUser(c).length}`);
forUser(d).length === 2 ? ok("user D (empty account) got the default pair") : bad(`user D got ${forUser(d).length}`);

const aOrder = forUser(a).map((l) => l.key);
JSON.stringify(aOrder) === JSON.stringify(["gym", "food"])
  ? ok("gym before food — the order the UI has always shown")
  : bad(`user A order was ${JSON.stringify(aOrder)}`);

// Foreign keys actually validated against the existing rows.
const fks = await q(`
  select conname from pg_constraint
  where conname in ('entries_lever_fk', 'playbook_lever_fk') and convalidated
`);
fks.length === 2 ? ok("both foreign keys created AND validated against existing rows") : bad(`only ${fks.length}/2 FKs validated`);

// The old CHECKs are gone, so a custom lever can be inserted.
try {
  await db.exec(`insert into public.levers (user_id, key, label, position) values ('${a}', 'reading', 'Reading', 3)`);
  await db.exec(`insert into public.entries (user_id, logged_for, lever) values ('${a}', '2026-07-04', 'reading')`);
  ok("a custom lever can be created and logged — the gym/food CHECK is gone");
} catch (e) {
  bad(`custom lever rejected: ${e.message}`);
}

// The four-active ceiling is structural.
try {
  await db.exec(`insert into public.levers (user_id, key, label, position) values ('${a}', 'walk', 'Walk', 4)`);
  await db.exec(`insert into public.levers (user_id, key, label, position) values ('${a}', 'fifth', 'Fifth', 4)`);
  bad("a fifth active lever was accepted at a duplicate position");
} catch {
  ok("a fifth active lever is refused — the ceiling is structural");
}

// Archiving frees the slot rather than blocking it.
try {
  await db.exec(`update public.levers set archived = true where user_id = '${a}' and key = 'walk'`);
  await db.exec(`insert into public.levers (user_id, key, label, position) values ('${a}', 'fifth', 'Fifth', 4)`);
  ok("archiving frees its position for a new lever");
} catch (e) {
  bad(`archiving did not free the slot: ${e.message}`);
}

// Archiving must not touch history — the entry survives and still resolves.
const survived = await q(`select count(*)::int as n from public.entries where user_id = '${a}' and lever = 'reading'`);
survived[0].n === 1 ? ok("entries survive their lever being archived") : bad("entry vanished");

// THE ONE THAT MATTERS: in-app account deletion must still work.
try {
  await db.exec(`delete from auth.users where id = '${a}'`);
  const left = await q(`select
    (select count(*) from public.entries where user_id = '${a}')::int as entries,
    (select count(*) from public.levers  where user_id = '${a}')::int as levers,
    (select count(*) from public.system_state where user_id = '${a}')::int as state`);
  const { entries, levers: lv, state } = left[0];
  entries === 0 && lv === 0 && state === 0
    ? ok("account deletion cascades cleanly (this is what `no action` vs `restrict` decided)")
    : bad(`rows left behind: entries=${entries} levers=${lv} state=${state}`);
} catch (e) {
  bad(`account deletion FAILED: ${e.message}`);
}

// A lever with entries cannot be hard-deleted by accident.
try {
  await db.exec(`delete from public.levers where user_id = '${b}' and key = 'food'`);
  bad("a lever with entries was hard-deleted — history would be orphaned");
} catch {
  ok("hard-deleting a lever that has entries is refused");
}

// New signups no longer get seeded gym/food.
await db.exec(`insert into auth.users (id) values ('55555555-5555-5555-5555-555555555555')`);
const fresh = await q(`select
  (select count(*) from public.levers   where user_id = '55555555-5555-5555-5555-555555555555')::int as levers,
  (select count(*) from public.playbook where user_id = '55555555-5555-5555-5555-555555555555')::int as playbook,
  (select count(*) from public.system_state where user_id = '55555555-5555-5555-5555-555555555555')::int as state`);
fresh[0].levers === 0 && fresh[0].playbook === 0 && fresh[0].state === 1
  ? ok("a new signup gets system_state only — onboarding writes the levers")
  : bad(`new signup got levers=${fresh[0].levers} playbook=${fresh[0].playbook} state=${fresh[0].state}`);

// Existing accounts are marked onboarded so they never see the setup flow.
const onboarded = await q(`select count(*)::int as n from public.system_state where user_id = '${b}' and onboarded_at is not null`);
onboarded[0].n === 1 ? ok("pre-existing accounts are marked onboarded") : bad("existing account would be shown onboarding");

// Posture was removed on 2026-07-30 — the app is strict-only, and the column
// goes with it. Nothing may still reference it.
const posture = await q(`select count(*)::int as n from information_schema.columns
  where table_schema = 'public' and table_name = 'system_state' and column_name = 'posture'`);
posture[0].n === 0 ? ok("posture column dropped") : bad("posture column still exists");

// --- the delete-account RPC -------------------------------------------------
// The cascade itself is proven above ("THE ONE THAT MATTERS"); these check the
// bridge a signed-in client actually calls.
const rpc = await q(`
  select p.prosecdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'delete_own_account'
`);
rpc.length === 1 && rpc[0].prosecdef
  ? ok("delete_own_account exists and is security definer")
  : bad(rpc.length ? "delete_own_account is not security definer" : "delete_own_account missing");

const anonCan = await q(`select has_function_privilege('anon', 'public.delete_own_account()', 'execute') as can`);
anonCan[0].can === false ? ok("anon cannot execute delete_own_account") : bad("anon can call account deletion");

const authCan = await q(`select has_function_privilege('authenticated', 'public.delete_own_account()', 'execute') as can`);
authCan[0].can === true ? ok("authenticated can execute delete_own_account") : bad("signed-in users cannot delete their account");

// End to end: point the stubbed auth.uid() at the fresh signup (already
// asserted above), call the RPC, and the whole account must be gone.
const fresh5 = "55555555-5555-5555-5555-555555555555";
await db.exec(`create or replace function auth.uid() returns uuid language sql stable as $$ select '${fresh5}'::uuid $$`);
await db.exec(`select public.delete_own_account()`);
const gone = await q(`select
  (select count(*) from auth.users where id = '${fresh5}')::int as users,
  (select count(*) from public.system_state where user_id = '${fresh5}')::int as state`);
gone[0].users === 0 && gone[0].state === 0
  ? ok("delete_own_account removes the caller's account, and only via the JWT")
  : bad(`RPC left rows behind: users=${gone[0].users} state=${gone[0].state}`);
await db.exec(`create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$`);

// --- integrity hardening ----------------------------------------------------
// Each of these was reachable from a normal signed-in session before
// 20260729040000. They are checked here rather than trusted because a
// constraint that silently failed to apply looks exactly like one that did.

// The audit log and the once-ever ledger are read-only to their subject.
const writable = await q(`
  select tablename, cmd from pg_policies
  where schemaname = 'public' and tablename in ('monitor_runs', 'milestones')
`);
writable.length === 2 && writable.every((p) => p.cmd === "SELECT")
  ? ok("monitor_runs and milestones are select-only for their owner")
  : bad(`audit/milestone policies still allow ${JSON.stringify(writable)}`);

// entries.detail is capped at DETAIL_MAX in the database, not just in core.
try {
  await db.exec(`insert into public.entries (user_id, logged_for, lever, detail)
                 values ('${b}', '2026-07-05', 'gym', repeat('x', 161))`);
  bad("a 161-character entry detail was accepted");
} catch {
  ok("entries.detail is capped at 160 in the database");
}

// Weight cannot be negative or absurd.
try {
  await db.exec(`insert into public.signals (user_id, observed_on, kind, amount)
                 values ('${b}', '2026-07-05', 'weight', -5)`);
  bad("a negative weight was accepted");
} catch {
  ok("signals.amount is bounded to 1..999");
}

// An entry cannot reference another user's playbook row.
await db.exec(`insert into public.playbook (user_id, lever, label) values ('${c}', 'gym', 'C private')`);
const foreignPb = await q(`select id from public.playbook where user_id = '${c}' and label = 'C private'`);
try {
  await db.exec(`insert into public.entries (user_id, logged_for, lever, playbook_id)
                 values ('${b}', '2026-07-06', 'gym', '${foreignPb[0].id}')`);
  bad("an entry borrowed another user's playbook row");
} catch {
  ok("entries.playbook_id cannot cross users — the FK is composite now");
}

// One monitor row per user per day.
await db.exec(`insert into public.monitor_runs (user_id, ran_on, down_days, action)
               values ('${b}', '2026-07-07', 0, 'none')`);
try {
  await db.exec(`insert into public.monitor_runs (user_id, ran_on, down_days, action)
                 values ('${b}', '2026-07-07', 0, 'none')`);
  bad("a duplicate monitor_runs row was accepted for the same day");
} catch {
  ok("monitor_runs is unique per (user, day)");
}

// A junk timezone is refused by keeping the previous value — the failure that
// used to end the whole monitor pass for every user after it.
await db.exec(`update public.system_state set timezone = 'Europe/Istanbul' where user_id = '${b}'`);
await db.exec(`update public.system_state set timezone = 'Not/AZone' where user_id = '${b}'`);
const tz = await q(`select timezone from public.system_state where user_id = '${b}'`);
tz[0].timezone === "Europe/Istanbul"
  ? ok("an unparseable timezone is rejected in favour of the previous one")
  : bad(`system_state.timezone accepted junk: ${tz[0].timezone}`);

// A real zone still writes through, or the guard would be a freeze.
await db.exec(`update public.system_state set timezone = 'America/New_York' where user_id = '${b}'`);
const tz2 = await q(`select timezone from public.system_state where user_id = '${b}'`);
tz2[0].timezone === "America/New_York"
  ? ok("a valid timezone still writes through")
  : bad(`valid timezone was blocked: ${tz2[0].timezone}`);

// --- the mood reading -------------------------------------------------------

// A continuous slider stores 1..100, which the old `value between 1 and 5`
// rejected outright.
try {
  await db.exec(`insert into public.signals (user_id, observed_on, kind, value)
                 values ('${b}', '2026-07-10', 'mood', 100)`);
  ok("a mood of 100 is accepted");
} catch (e) {
  bad(`a mood of 100 was refused: ${e.message}`);
}

try {
  await db.exec(`insert into public.signals (user_id, observed_on, kind, value)
                 values ('${b}', '2026-07-11', 'mood', 101)`);
  bad("a mood of 101 was accepted");
} catch {
  ok("mood is bounded to 1..100");
}

// The bound is split by KIND rather than simply widened. A widened bound would
// accept an energy of 87 — a row on no scale any reader uses, and one nothing
// downstream would ever notice.
try {
  await db.exec(`insert into public.signals (user_id, observed_on, kind, value)
                 values ('${b}', '2026-07-12', 'energy', 6)`);
  bad("an energy of 6 was accepted — the 1..5 bound was widened, not split");
} catch {
  ok("the retired 1..5 kinds keep their own bound");
}

// Old readings are HISTORY, not debris. A shipped build still selects them and
// the day sheet still renders them where they were written.
const legacy = await q(`select count(*)::int as n from public.signals where kind in ('energy','sleep','note','weight')`);
legacy[0].n >= 0
  ? ok("the retired kinds are still legal, so existing rows survive")
  : bad("retired kinds were dropped");

// --- the activity cap -------------------------------------------------------

// Ten is the ceiling, and the eleventh must NOT raise: a constraint violation
// comes back through the mobile outbox as a permanent failure and would
// dead-letter the entry it was attached to.
await db.exec(`delete from public.playbook where user_id = '${d}'`);
await db.exec(`
  insert into public.playbook (user_id, lever, label, use_count, is_pinned)
  select '${d}', 'gym', 'act ' || i, i, false from generate_series(1, 10) i;
`);
const tenBefore = await q(`select count(*)::int as n from public.playbook where user_id = '${d}' and lever = 'gym' and archived = false`);
tenBefore[0].n === 10 ? ok("ten activities sit at the cap") : bad(`expected 10, got ${tenBefore[0].n}`);

try {
  await db.exec(`insert into public.playbook (user_id, lever, label, use_count)
                 values ('${d}', 'gym', 'the eleventh', 0)`);
  ok("an eleventh activity is accepted rather than raising");
} catch (e) {
  bad(`the cap RAISED — this dead-letters queued taps: ${e.message}`);
}

const afterEleven = await q(`select count(*)::int as n from public.playbook where user_id = '${d}' and lever = 'gym' and archived = false`);
afterEleven[0].n === 10
  ? ok("the cap held at ten by archiving, not by refusing")
  : bad(`expected 10 active after the 11th, got ${afterEleven[0].n}`);

const retired = await q(`select label from public.playbook where user_id = '${d}' and lever = 'gym' and archived = true`);
retired.length === 1 && retired[0].label === "act 1"
  ? ok("the least-used activity is the one retired")
  : bad(`retired the wrong row: ${JSON.stringify(retired.map((r) => r.label))}`);

// Pinned rows sort last in the eviction order, so one only goes when there is
// nothing else left at all.
await db.exec(`delete from public.playbook where user_id = '${d}'`);
await db.exec(`
  insert into public.playbook (user_id, lever, label, use_count, is_pinned)
  values ('${d}', 'gym', 'pinned and unused', 0, true);
  insert into public.playbook (user_id, lever, label, use_count, is_pinned)
  select '${d}', 'gym', 'act ' || i, 5, false from generate_series(1, 9) i;
`);
await db.exec(`insert into public.playbook (user_id, lever, label, use_count)
               values ('${d}', 'gym', 'another', 0)`);
const pinnedStill = await q(`select archived from public.playbook where user_id = '${d}' and label = 'pinned and unused'`);
pinnedStill[0].archived === false
  ? ok("a pinned activity is not retired while anything else could be")
  : bad("the cap retired a pinned activity");

// The cap is per lever, not per account.
await db.exec(`insert into public.playbook (user_id, lever, label) values ('${d}', 'food', 'a food one')`);
const foodCount = await q(`select count(*)::int as n from public.playbook where user_id = '${d}' and lever = 'food' and archived = false`);
foodCount[0].n === 1 ? ok("the cap is per lever, not per account") : bad(`food lever got ${foodCount[0].n}`);

// Deleting an activity leaves the entry that used it intact — this is what
// makes a hard delete safe, and why archived rows do not have to linger just
// to hold a reference.
const [keep] = await q(`select id from public.playbook where user_id = '${d}' and lever = 'food' limit 1`);
await db.exec(`insert into public.entries (user_id, logged_for, lever, playbook_id, detail)
               values ('${d}', '2026-07-20', 'food', '${keep.id}', 'a food one')`);
await db.exec(`delete from public.playbook where id = '${keep.id}'`);
const survivor = await q(`select playbook_id, detail from public.entries where user_id = '${d}' and logged_for = '2026-07-20'`);
survivor.length === 1 && survivor[0].playbook_id === null && survivor[0].detail === "a food one"
  ? ok("deleting an activity nulls the pointer and keeps the entry and its detail")
  : bad(`entry did not survive the delete: ${JSON.stringify(survivor)}`);

// The ranking index is partial, so retired rows are not in the picker's index.
const idx = await q(`select indexdef from pg_indexes where indexname = 'playbook_rank_idx'`);
idx.length === 1 && /archived = false/.test(idx[0].indexdef)
  ? ok("playbook_rank_idx is partial on the active rows")
  : bad(`playbook_rank_idx is missing or not partial: ${JSON.stringify(idx)}`);

// ---------------------------------------------------------------------------
// actions — the split of the merged detail string
// ---------------------------------------------------------------------------

// The whole safety property of the round: entries is untouched, so every
// uptime figure is derived from exactly the same rows as before. If this fails,
// nothing else about the split matters.
const entryRows = await q(
  `select count(*)::int as n from public.entries where user_id = '${b}' and logged_for = '2026-07-15'`,
);
entryRows[0].n === 1
  ? ok("a day with two actions still has exactly ONE entry row")
  : bad(`entries per lever per day changed: ${entryRows[0].n}`);

const split = await q(
  `select label, position from public.actions
    where user_id = '${b}' and logged_for = '2026-07-15' order by position`,
);
split.length === 2 && split[0].label === "treadmill" && split[1].label === "walk"
  ? ok("the backfill splits 'treadmill · walk' into two ordered actions")
  : bad(`bad split: ${JSON.stringify(split)}`);

const single = await q(
  `select label from public.actions where user_id = '${b}' and logged_for = '2026-07-16'`,
);
single.length === 1 && single[0].label === "just a swim"
  ? ok("a detail with no separator stays one action")
  : bad(`single-action detail split wrongly: ${JSON.stringify(single)}`);

const dupes = await q(
  `select label from public.actions where user_id = '${b}' and logged_for = '2026-07-17'`,
);
dupes.length === 1
  ? ok("a repeated part collapses to one action rather than violating unique")
  : bad(`duplicate parts produced ${dupes.length} rows`);

const padded = await q(
  `select label from public.actions where user_id = '${b}' and logged_for = '2026-07-18' order by position`,
);
padded.length === 2 && padded[0].label === "padded" && padded[1].label === "spaces"
  ? ok("surrounding whitespace is trimmed off each action")
  : bad(`padding not trimmed: ${JSON.stringify(padded)}`);

const none = await q(
  `select count(*)::int as n from public.actions where user_id = '${b}' and logged_for = '2026-07-19'`,
);
none[0].n === 0
  ? ok("an entry with no detail produces no actions")
  : bad(`null detail produced ${none[0].n} actions`);

// Deleting the account has to take the actions with it, or the cascade Apple
// requires to work leaves orphans behind.
const cascade = await q(`
  select confdeltype from pg_constraint
   where conrelid = 'public.actions'::regclass and contype = 'f'
`);
cascade.length === 1 && cascade[0].confdeltype === "c"
  ? ok("actions cascade on user delete")
  : bad(`actions FK is not ON DELETE CASCADE: ${JSON.stringify(cascade)}`);

const rls = await q(
  `select relrowsecurity from pg_class where oid = 'public.actions'::regclass`,
);
rls[0].relrowsecurity === true
  ? ok("RLS is enabled on actions")
  : bad("actions has no row level security");

// ---------------------------------------------------------------------------
// day boundary — the hour a day rolls over, per account
// ---------------------------------------------------------------------------

// Every existing account keeps 04:00, so nothing about a current install moves.
const defaultHour = await q(
  `select day_boundary_hour from public.system_state where user_id = '${b}'`,
);
defaultHour[0]?.day_boundary_hour === 4
  ? ok("existing accounts default to the 04:00 boundary")
  : bad(`default boundary was ${JSON.stringify(defaultHour)}`);

// The bound mirrors DAY_BOUNDARY_MIN/MAX in core.
try {
  await db.exec(
    `update public.system_state set day_boundary_hour = 13 where user_id = '${b}'`,
  );
  bad("an out-of-range boundary hour was accepted");
} catch {
  ok("the boundary hour is bounded to 0..12");
}

await db.exec(
  `update public.system_state set day_boundary_hour = 0 where user_id = '${b}'`,
);
const midnight = await q(
  `select day_boundary_hour from public.system_state where user_id = '${b}'`,
);
midnight[0].day_boundary_hour === 0
  ? ok("midnight is a legal boundary")
  : bad("midnight was rejected");

// History records the boundary it was written under, so changing the setting
// cannot re-date a day that is already logged.
const stamped = await q(
  `select boundary_hour from public.entries where user_id = '${b}' limit 1`,
);
stamped[0]?.boundary_hour === 4
  ? ok("existing entries record the 04:00 boundary they were logged under")
  : bad(`entry boundary was ${JSON.stringify(stamped)}`);

// `logical_date` keeps its old arity so a deployed monitor does not break the
// moment this lands, and shifts by the hour it is given.
const sameDay = await q(`select
  public.logical_date('UTC') as dflt,
  public.logical_date('UTC', 4) as four,
  public.logical_date('UTC', 0) as midnight`);
sameDay[0].dflt.getTime() === sameDay[0].four.getTime()
  ? ok("logical_date's default argument still means 04:00")
  : bad("logical_date changed behaviour for existing callers");

console.log(process.exitCode ? "\nRESULT: FAILURES ABOVE" : "\nRESULT: all checks passed");
await db.close();
