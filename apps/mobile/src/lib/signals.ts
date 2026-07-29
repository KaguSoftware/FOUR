import { supabase } from "./supabase";
import { today } from "./status";
import { appendNote, NOTE_MAX } from "@uptime/core";

/**
 * Signals — the felt-state check and the journal.
 *
 * Kept out of `loadStatus()` on purpose: the dashboard is the screen that has
 * to be instant, and it needs none of this. `/proof` is the only reader.
 */

export type SignalRow = {
  observed_on: string;
  kind: string;
  value: number | null;
  detail: string | null;
};

export type WeightRow = { observed_on: string; amount: number | null };

/**
 * A row limit, not a date range, so the visible window is however many days
 * these rows happen to cover. Daily sampling writes up to three rows a day
 * (energy, sleep, note) — 60 days needs ~180, and weight makes it ~240.
 * A fifth kind would silently start truncating the trend.
 */
const ROW_LIMIT = 280;

/**
 * A read that reports its own failure.
 *
 * These used to return `[]` on error, which meant a dropped connection
 * rendered as the empty state — telling someone with months of journal that
 * they had written nothing. In a product whose whole promise is that history
 * is never truncated, a failed read must never be able to look like an empty
 * one.
 */
export type Read<T> = { rows: T[]; error: string | null };

export async function loadSignals(userId: string): Promise<Read<SignalRow>> {
  const { data, error } = await supabase
    .from("signals")
    .select("observed_on, kind, value, detail")
    .eq("user_id", userId)
    .order("observed_on", { ascending: false })
    .limit(ROW_LIMIT);

  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as SignalRow[], error: null };
}

/**
 * Fetched separately, and only when the opt-in is on. That keeps `amount` out
 * of the main query entirely, so an account with weight off never touches the
 * column.
 */
export async function loadWeights(
  userId: string,
  days: number,
): Promise<Read<WeightRow>> {
  const { data, error } = await supabase
    .from("signals")
    .select("observed_on, amount")
    .eq("user_id", userId)
    .eq("kind", "weight")
    .order("observed_on", { ascending: false })
    .limit(days);

  if (error) return { rows: [], error: error.message };
  return {
    rows: ((data ?? []) as WeightRow[]).filter((w) => w.amount !== null),
    error: null,
  };
}

/**
 * Write today's check.
 *
 * Upserts on `(user_id, observed_on, kind)`, so saving twice in a day EDITS
 * that day rather than adding to it — which is why `/proof` loads the existing
 * note back into the field before you type.
 */
export async function logSignals(
  userId: string,
  input: {
    energy?: number | null;
    sleep?: number | null;
    detail?: string | null;
    /** Only written when the opt-in is on; the caller enforces that. */
    weight?: number | null;
  },
) {
  const day = today();
  const rows: Record<string, unknown>[] = [];

  if (input.energy)
    rows.push({ user_id: userId, observed_on: day, kind: "energy", value: input.energy });
  if (input.sleep)
    rows.push({ user_id: userId, observed_on: day, kind: "sleep", value: input.sleep });
  if (input.detail?.trim()) {
    // Appended, never replaced. The field opens blank every time — being
    // handed back this morning's text is not how a journal is used — so a
    // plain upsert here would quietly overwrite it.
    const { data: existing, error: readError } = await supabase
      .from("signals")
      .select("detail")
      .eq("user_id", userId)
      .eq("observed_on", day)
      .eq("kind", "note")
      .maybeSingle();

    // If we could not read what is already there, we cannot safely append to
    // it: `appendNote(undefined, …)` returns just the new text, and the upsert
    // would then REPLACE the day's journal with it. Failing the whole save is
    // the only honest option — the user still has their text in the field.
    if (readError) return { error: readError };

    rows.push({
      user_id: userId,
      observed_on: day,
      kind: "note",
      value: null,
      detail: appendNote(existing?.detail, input.detail, NOTE_MAX).text,
    });
  }
  if (input.weight != null && Number.isFinite(input.weight))
    rows.push({
      user_id: userId,
      observed_on: day,
      kind: "weight",
      value: null,
      amount: Math.round(Math.min(Math.max(input.weight, 1), 999) * 100) / 100,
    });

  if (!rows.length) return { error: null };

  return supabase
    .from("signals")
    .upsert(rows, { onConflict: "user_id,observed_on,kind" });
}

/**
 * Rewrite one day's entry wholesale.
 *
 * The explicit edit path, reached by tapping a day in the log. This one DOES
 * replace, because that is what editing means — the user is looking at the
 * text they are changing. An empty result deletes the entry rather than
 * leaving a blank row in the log.
 */
export async function rewriteNote(
  userId: string,
  observedOn: string,
  text: string,
) {
  const detail = text.trim().slice(0, NOTE_MAX);

  if (!detail) {
    return supabase
      .from("signals")
      .delete()
      .eq("user_id", userId)
      .eq("observed_on", observedOn)
      .eq("kind", "note");
  }

  return supabase.from("signals").upsert(
    { user_id: userId, observed_on: observedOn, kind: "note", value: null, detail },
    { onConflict: "user_id,observed_on,kind" },
  );
}
