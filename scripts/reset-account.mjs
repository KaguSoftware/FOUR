/**
 * Wipe all logged data for the dev account and restore the seeded playbook.
 * Use after seeding synthetic history for testing.
 *
 *   node scripts/reset-account.mjs
 */
import { signIn } from "./_session.mjs";

const { sb, user } = await signIn();

for (const t of [
  "entries",
  "signals",
  "milestones",
  "monitor_runs",
  "runs",
  "outages",
]) {
  const { error } = await sb.from(t).delete().eq("user_id", user.id);
  console.log(`cleared ${t}:`, error ? error.message : "ok");
}

await sb
  .from("system_state")
  .update({
    last_paged_on: null,
    last_paged_level: null,
    last_plateau_on: null,
    slammed_until: null,
  })
  .eq("user_id", user.id);

await sb.from("playbook").delete().eq("user_id", user.id);
await sb.from("playbook").insert([
  { user_id: user.id, lever: "food", label: "shake @ lunch", is_pinned: true },
  {
    user_id: user.id,
    lever: "gym",
    label: "treadmill + 2 machines",
    is_pinned: true,
  },
]);

const { data: entries } = await sb
  .from("entries")
  .select("id")
  .eq("user_id", user.id);
console.log("entries remaining:", entries.length);
