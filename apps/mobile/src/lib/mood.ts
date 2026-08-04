import { MOOD_KIND, MOOD_MAX, MOOD_MIN } from "@four/core";
import { supabase } from "./supabase";

/**
 * Reading and writing today's mood.
 *
 * **Not through the outbox, deliberately.** The outbox exists because a missed
 * LOG is a lost day, and every lever tap goes through it for that reason. A
 * mood reading is not a day — nothing derives from it, and a reading that
 * needed a connection and did not get one costs nothing. Adding it to a queue
 * keyed on `(logged_for, lever)` would mean widening that key for a row that
 * has no lever, which is a real cost for no gain.
 *
 * The upsert is on `(user_id, observed_on, kind)`, so setting it twice in a day
 * replaces rather than appends. That is right for a state reading and wrong for
 * a journal, which is why the journal was a separate thing and is now gone.
 */
export async function loadMood(
  userId: string,
  date: string,
): Promise<{ value: number | null; error: string | null }> {
  const { data, error } = await supabase
    .from("signals")
    .select("value")
    .eq("user_id", userId)
    .eq("observed_on", date)
    .eq("kind", MOOD_KIND)
    .maybeSingle();

  if (error) return { value: null, error: error.message };
  return { value: data?.value ?? null, error: null };
}

export async function saveMood(
  userId: string,
  date: string,
  value: number,
): Promise<{ error: string | null }> {
  // Clamped here as well as in core: the column's CHECK rejects anything
  // outside 1..100, and a rejected write surfaces as a failed save with a
  // constraint name in it rather than as anything the user could act on.
  const clamped = Math.min(Math.max(Math.round(value), MOOD_MIN), MOOD_MAX);

  const { error } = await supabase.from("signals").upsert(
    { user_id: userId, observed_on: date, kind: MOOD_KIND, value: clamped },
    { onConflict: "user_id,observed_on,kind" },
  );

  return { error: error?.message ?? null };
}
