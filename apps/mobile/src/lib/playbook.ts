import {
  canAddActivity,
  normalizeActivityLabel,
  validateActivityLabel,
  type ActivityRow,
} from "@uptime/core";
import { supabase } from "./supabase";

/**
 * Activity CRUD — the per-lever playbook.
 *
 * **Online-only, deliberately, and this is the one thing to understand here.**
 * Every lever tap goes through the offline outbox because a missed LOG is a
 * lost day. A rename that needs a connection and does not get one costs
 * nothing comparable, and the outbox's queue is keyed `(logged_for, lever)`
 * with last-write-wins collapsing — an activity op has no date, so it would
 * mean widening that key for no benefit. Worse, a queued delete flushed after
 * a queued log would delete the row the log had just upserted.
 *
 * `lib/levers.ts` is online-only for exactly the same reason. Failures surface
 * through `useNotify`.
 */
export type ActivityResult = { ok: true } | { ok: false; error: string };

const fail = (error: unknown): ActivityResult => ({
  ok: false,
  error: error instanceof Error ? error.message : String(error),
});

/** Active activities for one lever, unranked — callers use `rankActivities`. */
export async function loadActivities(
  userId: string,
  lever: string,
): Promise<{ rows: ActivityRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("playbook")
    .select("id, lever, label, use_count, last_used_at, is_pinned, archived")
    .eq("user_id", userId)
    .eq("lever", lever);

  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as ActivityRow[], error: null };
}

export async function createActivity(
  userId: string,
  lever: string,
  label: string,
): Promise<ActivityResult> {
  const check = validateActivityLabel(label);
  if (!check.ok) return { ok: false, error: check.reason };

  // The explicit add is the half of the cap that REFUSES. The implicit one —
  // logging a lever with a new detail — never can, because refusing there
  // would block a log. See `retireCandidate`.
  const { rows, error } = await loadActivities(userId, lever);
  if (error) return { ok: false, error };
  if (!canAddActivity(rows.filter((r) => !r.archived).length)) {
    return { ok: false, error: "full" };
  }

  const { error: insertError } = await supabase.from("playbook").insert({
    user_id: userId,
    lever,
    label: normalizeActivityLabel(label),
  });

  return insertError ? fail(insertError) : { ok: true };
}

export async function renameActivity(
  userId: string,
  id: string,
  label: string,
): Promise<ActivityResult> {
  const check = validateActivityLabel(label);
  if (!check.ok) return { ok: false, error: check.reason };

  const { error } = await supabase
    .from("playbook")
    .update({ label: normalizeActivityLabel(label) })
    // RLS is the boundary, but the filter is this codebase's habit and it
    // costs nothing.
    .eq("id", id)
    .eq("user_id", userId);

  return error ? fail(error) : { ok: true };
}

/**
 * A hard delete, and the asymmetry with levers is deliberate.
 *
 * "Archive never deletes" exists because archiving a LEVER must not change
 * uptime. An activity is a label on a shortcut chip and is structurally
 * incapable of affecting it, so the rule's reason does not reach here. Two
 * things make the delete safe:
 *
 * - `entries.playbook_id` is `on delete set null (playbook_id)` and nothing in
 *   either client ever READS that column — `entries.detail` keeps the text. So
 *   this loses a pointer nobody dereferences.
 * - `unique (user_id, lever, label)` includes archived rows. Archive-only
 *   would mean a name you can neither see nor re-add, and the second attempt
 *   fails with a unique violation about a row that is invisible.
 *
 * The cap's own eviction still ARCHIVES, because that one is the system
 * removing something the user did not ask about and has to be recoverable.
 */
export async function deleteActivity(
  userId: string,
  id: string,
): Promise<ActivityResult> {
  const { error } = await supabase
    .from("playbook")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return error ? fail(error) : { ok: true };
}

/** Bring back something the cap retired. */
export async function restoreActivity(
  userId: string,
  id: string,
): Promise<ActivityResult> {
  const { error } = await supabase
    .from("playbook")
    .update({ archived: false })
    .eq("id", id)
    .eq("user_id", userId);

  return error ? fail(error) : { ok: true };
}
