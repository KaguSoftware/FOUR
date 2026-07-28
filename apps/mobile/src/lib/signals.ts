import { supabase } from "./supabase";
import { today } from "./status";
import { NOTE_MAX } from "@uptime/core";

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

export async function loadSignals(userId: string) {
  const { data, error } = await supabase
    .from("signals")
    .select("observed_on, kind, value, detail")
    .eq("user_id", userId)
    .order("observed_on", { ascending: false })
    .limit(ROW_LIMIT);

  if (error) return [];
  return (data ?? []) as SignalRow[];
}

/**
 * Fetched separately, and only when the opt-in is on. That keeps `amount` out
 * of the main query entirely, so an account with weight off never touches the
 * column.
 */
export async function loadWeights(userId: string, days: number) {
  const { data, error } = await supabase
    .from("signals")
    .select("observed_on, amount")
    .eq("user_id", userId)
    .eq("kind", "weight")
    .order("observed_on", { ascending: false })
    .limit(days);

  if (error) return [];
  return ((data ?? []) as WeightRow[]).filter((w) => w.amount !== null);
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
  if (input.detail?.trim())
    rows.push({
      user_id: userId,
      observed_on: day,
      kind: "note",
      value: null,
      detail: input.detail.trim().slice(0, NOTE_MAX),
    });
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
