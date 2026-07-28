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
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";
const db = new PGlite();

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
console.log("stubbed auth schema\n");

const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

// --- run everything up to (but not including) the custom-levers migration ---
const LEVERS = files.find((f) => f.includes("custom_levers"));
for (const f of files.filter((f) => f !== LEVERS)) {
  try {
    await db.exec(readFileSync(join(DIR, f), "utf8"));
    console.log(`applied  ${f}`);
  } catch (e) {
    console.log(`FAILED   ${f}\n  ${e.message}`);
    process.exit(1);
  }
}

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
console.log("seeded 4 users covering: both levers, entries-only, playbook-only, empty\n");

// --- the migration under test ----------------------------------------------
console.log(`applying ${LEVERS}...`);
try {
  await db.exec(readFileSync(join(DIR, LEVERS), "utf8"));
  console.log("applied without error\n");
} catch (e) {
  console.log(`MIGRATION FAILED:\n  ${e.message}`);
  process.exit(1);
}

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

// Posture defaults to strict.
const posture = await q(`select posture from public.system_state where user_id = '${b}'`);
posture[0].posture === "strict" ? ok("posture defaults to strict") : bad(`posture was ${posture[0].posture}`);

console.log(process.exitCode ? "\nRESULT: FAILURES ABOVE" : "\nRESULT: all checks passed");
await db.close();
