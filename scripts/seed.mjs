/**
 * Seed synthetic history so a state can be inspected in the browser.
 *
 *   node scripts/seed.mjs <runDays> <downDays>
 *
 * e.g. `node scripts/seed.mjs 31 11` builds a 31-day run that ended 11 whole
 * days ago — the re-entry takeover, with a completed run behind it.
 */
import { signIn, dayOffset } from "./_session.mjs";

const runDays = Number(process.argv[2] ?? 31);
const down = Number(process.argv[3] ?? 11);

const { sb, user } = await signIn();

// Anchor on the account's own logical today so seeding matches what the app
// computes rather than drifting with the runner's clock.
const { data: state } = await sb
  .from("system_state")
  .select("timezone")
  .eq("user_id", user.id)
  .single();

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: state?.timezone ?? "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(Date.now() - 4 * 3600_000));

await sb.from("entries").delete().eq("user_id", user.id);
await sb
  .from("system_state")
  .update({ last_paged_on: null, last_paged_level: null })
  .eq("user_id", user.id);

const rows = [];
for (let i = 0; i < runDays; i++) {
  rows.push({
    user_id: user.id,
    logged_for: dayOffset(today, -(down + runDays - i)),
    lever: "gym",
    detail: "treadmill + 2 machines",
  });
}
const { error } = await sb.from("entries").insert(rows);
if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(
  `seeded ${runDays}-day run ending ${dayOffset(today, -down - 1)}; today is ${today} (down ${down})`,
);
