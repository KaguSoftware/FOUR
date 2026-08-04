/**
 * What a single day actually contained.
 *
 * The grid says how much of a day fired; this says what it was. Both clients
 * ask that question from a tapped cell, and two implementations of "what
 * happened on the 14th" would be two answers to it — so the assembly lives
 * here with everything else that is derived.
 *
 * **This derives nothing about uptime.** A day's detail is a lookup, not a
 * judgement: it must not compute a score, a streak, or a verdict. The grid
 * already carries the only reading of a day this product makes.
 */

import type { Entry } from "./uptime";

/**
 * A felt-state sample. Mirrors the `signals` row, minus the ids.
 *
 * No `amount`. That column arrives with the optional-weight migration, so
 * selecting it is only safe behind the account's opt-in — and weight is a
 * measurement rather than something you did, so it stays on `/proof` where
 * that guard already exists.
 */
export type Signal = {
  observed_on: string;
  kind: string;
  value: number | null;
  detail: string | null;
};

/**
 * One thing done on one lever on one day. Mirrors the `actions` row.
 *
 * **No timestamp, by design.** Actions carry an order, not a clock time — see
 * the `actions` migration. Nothing displays when something happened and
 * nothing should start; `position` is the only ordering that exists.
 */
export type Action = {
  logged_for: string;
  lever: string;
  label: string;
  position: number;
};

/** One lever that fired, named as it was named at the time. */
export type DayLever = {
  key: string;
  label: string;
  /**
   * The day's record for this lever as ONE string.
   *
   * Kept because a client that predates the actions table still has only this,
   * and because it is what `entries.detail` holds. Prefer `actions` when it is
   * non-empty — this is the fallback, not the source.
   */
  detail: string | null;
  /**
   * What was actually done, in order, one entry each.
   *
   * Empty for a day logged with no detail, and for any day written by a client
   * that predates the split. Renderers must handle that by falling back to
   * `detail` rather than showing nothing.
   */
  actions: string[];
};

export type DayDetail = {
  date: string;
  levers: DayLever[];
  signals: Signal[];
  /** No lever fired. NOT a verdict — see the note in `dayDetail`. */
  empty: boolean;
  /** Later than the day being viewed from. Distinct from empty. */
  future: boolean;
};

/**
 * Everything known about `date`, ready to render.
 *
 * `labels` maps a lever key to its display name and must include ARCHIVED
 * levers. A day that fired a lever since renamed or retired has to keep
 * naming the lever it actually fired; falling back to the raw key is the
 * honest last resort, never a guess at what it might have been called.
 *
 * `empty` and `future` are separate flags on purpose. A day that has not
 * happened yet is not a day you skipped, and collapsing the two is how a
 * calendar starts accusing people of missing tomorrow.
 *
 * **One `DayLever` per lever, however many actions it holds.** The lever is
 * still the thing that fired — that is what `entries` records and what uptime
 * reads — so two actions on one lever is one lever with two actions, never the
 * lever listed twice. Getting that wrong is what made "treadmill · walk" look
 * like a single invented activity in the first place.
 */
export function dayDetail(
  date: string,
  entries: readonly Entry[],
  signals: readonly Signal[],
  labels: ReadonlyMap<string, string>,
  today: string,
  actions: readonly Action[] = [],
): DayDetail {
  // Indexed by lever once rather than scanned per entry, and kept in `position`
  // order — the order they were logged, which is the only ordering actions have.
  const byLever = new Map<string, string[]>();
  for (const a of [...actions]
    .filter((a) => a.logged_for === date)
    .sort((x, y) => x.position - y.position)) {
    const list = byLever.get(a.lever) ?? [];
    list.push(a.label);
    byLever.set(a.lever, list);
  }

  const levers: DayLever[] = entries
    .filter((e) => e.logged_for === date)
    .map((e) => ({
      key: e.lever,
      label: labels.get(e.lever) ?? e.lever,
      detail: e.detail,
      actions: byLever.get(e.lever) ?? [],
    }));

  return {
    date,
    levers,
    signals: signals.filter((s) => s.observed_on === date),
    empty: levers.length === 0,
    future: date > today,
  };
}

/**
 * Lever key to display label, archived included.
 *
 * Deliberately asks for no more than it reads. Both clients keep their own row
 * type for the `levers` table and the two do not agree on field names, so
 * demanding a whole row here would only force a cast at each call site.
 */
export function leverLabels(
  levers: readonly { key: string; label: string }[],
): Map<string, string> {
  return new Map(levers.map((l) => [l.key, l.label]));
}
