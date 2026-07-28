import { canAddLever, uniqueLeverKey, validateLeverLabel } from "@uptime/core";
import { supabase } from "./supabase";

export type LeverResult = { ok: true } | { ok: false; error: string };

/**
 * Create a lever.
 *
 * Shared by Settings and the dashboard's add button, because two places
 * generating keys or picking positions differently is two ways to violate the
 * same constraints. Fails closed at four active, matching the partial unique
 * index in the database.
 */
export async function createLever(
  userId: string,
  label: string,
): Promise<LeverResult> {
  const check = validateLeverLabel(label);
  if (!check.ok) return { ok: false, error: check.reason };

  const { data, error: readError } = await supabase
    .from("levers")
    .select("key, position, archived")
    .eq("user_id", userId);

  if (readError) return { ok: false, error: "Couldn't reach the system." };

  const rows = data ?? [];
  const active = rows.filter((l) => !l.archived);
  if (!canAddLever(active.length)) {
    return { ok: false, error: "Four levers is the maximum. Archive one first." };
  }

  // Lowest free slot, so archiving then adding reuses the gap rather than
  // pushing past the `position between 1 and 4` constraint.
  const taken = new Set(active.map((l) => l.position));
  let position = 1;
  while (taken.has(position)) position++;

  // Unique against EVERY key, archived included — an archived lever still owns
  // its key because its entries still point at it.
  const { error } = await supabase.from("levers").insert({
    user_id: userId,
    key: uniqueLeverKey(label, rows.map((l) => l.key)),
    label: label.trim(),
    position,
  });

  if (error) return { ok: false, error: "Could not add that lever." };
  return { ok: true };
}

/** Rename. The key never moves, so history is untouched. */
export async function renameLever(
  userId: string,
  id: string,
  label: string,
): Promise<LeverResult> {
  const check = validateLeverLabel(label);
  if (!check.ok) return { ok: false, error: check.reason };

  const { error } = await supabase
    .from("levers")
    .update({ label: label.trim() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { ok: false, error: "Could not rename that lever." };
  return { ok: true };
}

/**
 * Archive. Never deletes.
 *
 * Entries keep pointing at the key, so the day grid and the 30-day number are
 * identical afterwards. Refuses the last one, because a dashboard with no
 * buttons is not a state this product has.
 */
export async function archiveLever(
  userId: string,
  id: string,
): Promise<LeverResult> {
  const { data: active } = await supabase
    .from("levers")
    .select("id")
    .eq("user_id", userId)
    .eq("archived", false);

  if ((active ?? []).length <= 1) {
    return { ok: false, error: "Keep at least one lever — add another first." };
  }

  const { error } = await supabase
    .from("levers")
    .update({ archived: true })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { ok: false, error: "Could not archive that lever." };
  return { ok: true };
}
